import { kv } from '@vercel/kv';

const toMinguo = (date) => {
  const y = date.getFullYear() - 1911;
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
};

async function fetchAgriRange(startDate, endDate) {
  const base = 'https://data.moa.gov.tw/api/v1/AgriProductsTransType';
  let all = [];
  let skip = 0;
  const limit = 5000;

  while (true) {
    const url = `${base}/?Start_time=${startDate}&End_time=${endDate}&TransType=N05&$limit=${limit}&$skip=${skip}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`農業部 HTTP ${res.status}`);
    const data = await res.json();
    if (data.length === 0) break;
    all = all.concat(data);
    if (data.length < limit) break;
    skip += limit;
    await new Promise(r => setTimeout(r, 200)); // 避免打太快被ban
  }
  return all;
}

export default async function handler(req, res) {
  try {
    // 抓過去 90 天
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 90);
    
    const startStr = toMinguo(start);
    const endStr = toMinguo(end);

    // 1. 一次抓 90 天區間，處理分頁
    const all = await fetchAgriRange(startStr, endStr);

    // 2. 只留三重，用名稱 includes，不要用 MarketCode
    const sanChongAll = all.filter(d =>
      d.MarketName &&
      d.MarketName.includes('三重')
    );

    // 3. 按日期分組寫 KV
    const results = [];
    const dateSet = new Set(sanChongAll.map(d => d.TransDate));
    
    for (let i = 0; i < 90; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const queryDate = toMinguo(date);
      
      // 週一休市
      if (date.getDay() === 1) {
        const empty = { 休市: true, 市場名稱: '三重果菜市場', 交易日期: queryDate, data: [] };
        await kv.set(`fruit:sc:${queryDate}`, empty);
        results.push(`${queryDate}: 休市`);
        continue;
      }

      const raw = sanChongAll.filter(d => d.TransDate === queryDate);
      
      const seen = new Set();
      const data = raw.filter(d => {
        const key = d.CropName.trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).map(d => ({
        交易日期: d.TransDate,
        市場名稱: '三重果菜市場',
        作物名稱: d.CropName.trim(),
        上價: +d.Upper_Price || 0,
        中價: +d.Middle_Price || 0,
        下價: +d.Lower_Price || 0,
        平均價: +d.Avg_Price || 0,
        交易量: +d.Trans_Quantity || 0
      }));

      const result = { 
        休市: data.length === 0, 
        市場名稱: '三重果菜市場', 
        交易日期: queryDate, 
        data 
      };

      await kv.set(`fruit:sc:${queryDate}`, result);
      await kv.expire(`fruit:sc:${queryDate}`, 60 * 60 * 24 * 200);
      results.push(`${queryDate}: ${data.length}筆`);
    }

    res.status(200).json({ 
      success: true,
      totalDays: 90,
      totalRecords: all.length,
      sanChongRecords: sanChongAll.length,
      results 
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
