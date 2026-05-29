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

    // Debug 模式：看原始資料長怎樣
    if (req.query.raw === '1') {
      const raw = await kv.mget(...validKeys);
      return res.status(200).json({
        validKeys,
        rawTypes: raw.map(r => Array.isArray(r)? `array[${r.length}]` : typeof r),
        rawSample: raw[0]
      });
    }

    if (validKeys.length === 0) return res.status(200).json([]);

    const rawArrays = await kv.mget(...validKeys);

    const seen = new Set();
    const data = rawArrays
    .flat()
    .filter(d => d && d.市場名稱 && d.作物名稱) // 寬鬆過濾
    .filter(d => {
        const key = String(d.市場名稱).trim() + '_' + String(d.作物名稱).trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
    .map(d => ({
        交易日期: d.交易日期 || '',
        市場名稱: String(d.市場名稱).trim(),
        作物名稱: String(d.作物名稱).trim(),
        上價: +d.上價 || 0,
        中價: +d.中價 || 0,
        下價: +d.下價 || 0,
        平均價: +d.平均價 || 0,
        交易量: +d.交易量 || 0
      }));

    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}
