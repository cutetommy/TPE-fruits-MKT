import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const days = parseInt(req.query.days) || 1;
    const allKeys = await kv.keys('fruit:*');

    const validKeys = allKeys
    .filter(k => k.startsWith('fruit:'))
    .sort()
    .reverse()
    .slice(0, days);

    if (validKeys.length === 0) return res.status(200).json([]);

    const rawArrays = await kv.mget(...validKeys);

    const seen = new Set();
    const data = rawArrays
    .flat()
    .filter(d => d && d.MarketName && d.CropName && d.TransDate) // 加上 TransDate 判斷
    .filter(d => {
        // 改這裡：key 加上日期，同一天內才去重
        const key = `${d.TransDate}_${d.MarketName.trim()}_${d.CropName.trim()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
    .map(d => ({
        交易日期: d.TransDate || '',
        市場名稱: String(d.MarketName).trim(),
        作物名稱: String(d.CropName).trim(),
        上價: +d.Upper_Price || 0,
        中價: +d.Middle_Price || 0,
        下價: +d.Lower_Price || 0,
        平均價: +d.Avg_Price || 0,
        交易量: +d.Trans_Quantity || 0
      }))
    .sort((a, b) => b.交易日期.localeCompare(a.交易日期)); // 加個排序，新到舊

    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}
