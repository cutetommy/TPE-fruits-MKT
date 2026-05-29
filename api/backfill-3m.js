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
    await new Promise(r => setTimeout(r, 300));
  }
  return all;
}

export default async function handler(req, res) {
  try {
    // 用 from=115.05.20&to=115.05.29 這樣控制區間，一次最多 10 天
    const from = req.query.from;
    const to = req.query.to;
    if (!from || !to) {
      return res.status(400).json({ error: '需要 from 跟 to，格式 115.05.20' });
    }

    const results = [];
    const all = await fetchAgriRange(from, to);

    const sanChongAll = all.filter(d =>
      d.MarketName && d.MarketName.includes('三重')
    );

    // 算出 from ~ to 的所有日期
    const [fy, fm, fd] = from.split('.');
    const [ty, tm, td] = to.split('.');
    const startDate = new Date(`${parseInt(fy) + 1911}-${fm}-${fd}`);
    const endDate = new Date(`${parseInt(ty) + 1911}-${tm}-${td}`);
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const queryDate = toMinguo(d);
      
      if (d.getDay() === 1) {
        const empty = { 休市: true, 市場名稱: '三重果菜市場', 交易日期: queryDate, data: [] };
        await kv.set(`fruit:sc:${queryDate}`, empty);
        results.push(`${queryDate}: 休市`);
        continue;
      }

      const raw = sanChongAll.filter(item => item.TransDate === queryDate);
      
      const seen = new Set();
      const data = raw.filter(item => {
        const key = item.CropName.trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).map(item => ({
        交易日期: item.TransDate,
        市場名稱: '三重果菜市場',
        作物名稱: item.CropName.trim(),
        上價: +item.Upper_Price || 0,
        中價: +item.Middle_Price || 0,
        下價: +item.Lower_Price || 0,
        平均價: +item.Avg_Price || 0,
        交易量: +item.Trans_Quantity || 0
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
      range: `${from} ~ ${to}`,
      totalRecords: all.length,
      sanChongRecords: sanChongAll.length,
      results 
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
