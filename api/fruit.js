import { kv } from '@vercel/kv'; 

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  try {
    const queryDate = req.query.date;
    let raw = [];

    if (queryDate) {
      raw = await kv.get(`fruit:${queryDate}`) || [];
    } else {
      const keys = await kv.keys('fruit:*');
      const dates = keys.map(k => k.replace('fruit:', '')).sort().reverse();
      const latestDate = dates[0];
      if (latestDate) {
        raw = await kv.get(`fruit:${latestDate}`) || [];
      }
    }

    const seen = new Set();
    const data = raw.filter(d => {
      const key = d.市場名稱.trim() + '_' + d.作物名稱.trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(d => ({
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
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
