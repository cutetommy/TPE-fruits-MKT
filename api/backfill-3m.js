import { kv } from '@vercel/kv';

// 民國轉西元
const toAD = (mDate) => {
  const [y, m, d] = mDate.split('.');
  return `${parseInt(y) + 1911}-${m}-${d}`;
};

// 西元轉民國
const toMinguo = (date) => {
  const y = date.getFullYear() - 1911;
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
};

// 取得過去 N 天的日期陣列，民國年格式
const getPastDates = (days) => {
  const dates = [];
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(toMinguo(date));
  }
  return dates;
};

export default async function handler(req, res) {
  try {
    const days = parseInt(req.query.days) || 90; // 預設 90 天
    const dates = getPastDates(days);
    const results = [];

    // 1. 一次抓全部歷史資料
    const url = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx';
    const response = await fetch(url);
    if (!response.ok) throw new Error(`農業部 HTTP ${response.status}`);
    const text = await response.text();
    const all = JSON.parse(text);

    // 2. 先把三重 + N05 全部篩出來
    const sanChongAll = all.filter(d =>
      d.市場名稱 &&
      d.市場名稱.includes('三重') &&
      d.種類代碼 === 'N05'
    );

    // 3. 按日期分組寫入 KV
    for (const queryDate of dates) {
      const [y, m, d] = queryDate.split('.');
      const dateObj = new Date(`${parseInt(y) + 1911}-${m}-${d}`);
      
      // 週一休市
      if (dateObj.getDay() === 1) {
        const empty = { 休市: true, 市場名稱: '三重果菜市場', 交易日期: queryDate, data: [] };
        await kv.set(`fruit:sc:${queryDate}`, empty);
        await kv.expire(`fruit:sc:${queryDate}`, 60 * 60 * 24 * 200);
        results.push(`${queryDate}: 休市`);
        continue;
      }

      const raw = sanChongAll.filter(d => d.交易日期 === queryDate);

      const seen = new Set();
      const data = raw.filter(d => {
        const key = d.作物名稱.trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).map(d => ({
        交易日期: d.交易日期,
        市場名稱: '三重果菜市場',
        作物名稱: d.作物名稱.trim(),
        上價: +d.上價 || 0,
        中價: +d.中價 || 0,
        下價: +d.下價 || 0,
        平均價: +d.平均價 || 0,
        交易量: +d.交易量 || 0
      }));

      const result = { 
        休市: data.length === 0, 
        市場名稱: '三重果菜市場', 
        交易日期: queryDate, 
        data 
      };

      await kv.set(`fruit:sc:${queryDate}`, result);
      await kv.expire(`fruit:sc:${queryDate}`, 60 * 60 * 24 * 200); // 存 200 天
      results.push(`${queryDate}: ${data.length}筆`);
    }

    res.status(200).json({ 
      success: true,
      totalDays: dates.length,
      results 
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
