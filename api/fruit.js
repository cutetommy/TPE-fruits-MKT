import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    const queryDate = req.query.date; // 115.05.28
    const cacheKey = queryDate? `fruit:sc:${queryDate}` : 'fruit:sc:latest';

    const cached = await kv.get(cacheKey);
    if (cached) return res.status(200).json(cached);

    const url = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx';
    const response = await fetch(url);
    const text = await response.text();
    const all = JSON.parse(text);

    // 只抓三重，不管板橋
    let raw = all.filter(d =>
      d.市場名稱 &&
      d.市場名稱.includes('三重') && // 台北一也可能有三重資料，但大部分是三重區
      d.種類代碼 === 'N05'
    );

    if (queryDate) {
      raw = raw.filter(d => d.交易日期 === queryDate);
    } else {
      const dates = [...new Set(raw.map(d => d.交易日期))].sort().reverse();
      raw = raw.filter(d => d.交易日期 === dates[0]);
    }

    const seen = new Set();
    const data = raw.filter(d => {
      const key = d.作物名稱.trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(d => ({
      交易日期: d.交易日期,
      市場名稱: '三重果菜市場', // 統一正名
      作物名稱: d.作物名稱.trim(),
      上價: +d.上價 || 0,
      中價: +d.中價 || 0,
      下價: +d.下價 || 0,
      平均價: +d.平均價 || 0,
      交易量: +d.交易量 || 0
    }));

    await kv.set(cacheKey, data);
    await kv.expire(cacheKey, 60 * 60 * 6); // 三重資料穩，快取 6 小時

    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
