export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  try {
    const url = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx';
    const response = await fetch(url);
    const text = await response.text();
    const all = JSON.parse(text);

    // 1. 接前端傳的日期，格式 115.05.28。沒傳就自動抓資料裡最新一天
    const queryDate = req.query.date;

    let raw = all.filter(d =>
      d.市場名稱 &&
      (d.市場名稱.includes('三重') || d.市場名稱.includes('板橋')) &&
      d.種類代碼 === 'N05'
    );

    // 2. 如果有指定日期就篩日期，沒指定就拿最新一天
    if (queryDate) {
      raw = raw.filter(d => d.交易日期 === queryDate);
    } else {
      const dates = [...new Set(raw.map(d => d.交易日期))].sort().reverse();
      const latestDate = dates[0];
      raw = raw.filter(d => d.交易日期 === latestDate);
    }

    // 3. 同市場+同品名，只留第一筆去重
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

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=60'); // 快取縮短，方便切換日期
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({error: e.message});
  }
}
