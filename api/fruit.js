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

    // Debug 模式
    if (req.query.raw === '1') {
      const raw = await kv.mget(...validKeys);
      return res.status(200).json({
        allKeysCount: allKeys.length,
        validKeys,
        rawTypes: raw.map(r => Array.isArray(r)? `array[${r.length}]` : typeof r),
        rawSample: raw[0]?.slice(0, 2)
      });
    }

    if (validKeys.length === 0) return res.status(200).json([]);

    const rawArrays = await kv.mget(...validKeys);

    const seen = new Set();
    const data = rawArrays
   .flat()
   .filter(d => d && d.MarketName && d.CropName && d.TransDate)
   .filter(d => {
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
   .sort((a, b) => b.交易日期.localeCompare(a.交易日期));

    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}
