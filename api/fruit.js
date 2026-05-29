import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const days = parseInt(req.query.days) || 1;

    const allKeys = await kv.keys('fruit:*');

    // debug: 先回傳全部 key 看格式
    if (req.query.debug === '1') {
      return res.status(200).json({
        total: allKeys.length,
        keys: allKeys.slice(0, 20), // 只顯示前20個
        sample: allKeys[0]
      });
    }

    // 改寬鬆一點的正則，只要是 fruit:開頭就抓
    const validKeys = allKeys
     .filter(k => k.startsWith('fruit:'))
     .sort()
     .reverse()
     .slice(0, days);

    if (validKeys.length === 0) {
      return res.status(200).json({ msg: 'no valid keys', allKeys });
    }

    const rawArrays = await kv.mget(...validKeys);

    const seen = new Set();
    const data = rawArrays
     .filter(Array.isArray)
     .flat()
     .filter(d => d && d.市場名稱 && d.作物名稱)
     .filter(d => {
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
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}
