import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const days = parseInt(req.query.days) || 1;
    
    // 只抓 YYYY-MM-DD 格式的 key，過濾掉 115.xx 舊格式
    const allKeys = await kv.keys('fruit:*');
    const validKeys = allKeys
      .filter(k => /^fruit:\d{4}-\d{2}-\d{2}$/.test(k))
      .sort()
      .reverse()
      .slice(0, days);
    
    if (validKeys.length === 0) {
      return res.status(200).json([]);
    }
    
    const rawArrays = await kv.mget(...validKeys);
    
    const seen = new Set();
    const data = rawArrays
      .filter(Array.isArray)
      .flat()
      .filter(d => {
        if (!d?.市場名稱 || !d?.作物名稱) return false;
        const key = d.市場名稱.trim() + '_' + d.作物名稱.trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(d => ({
        交易日期: d.交易日期,
        市場名稱: d.市場名稱.trim(),
        作物名稱: d.作物名稱.trim(),
        上價: +d.上價 || 0,
        中價: +d.中價 || 0,
        下價: +d.下價 || 0,
        平均價: +d.平均價 || 0,
        交易量: +d.交易量 || 0
      }));

    res.status(200).json(data);
  } catch (e) {
    console.error('Fruit API Error:', e);
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}
