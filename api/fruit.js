export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  try {
    const queryDate = req.query.date; // 115.05.23
    let all = [];

    if (queryDate) {
      const rocYear = parseInt(queryDate.split('.')[0]);
      const adYear = rocYear + 1911;

      // 用歷史資料 API，2026年的資料也在這
      const url = `https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransDataHistory.aspx?year=${adYear}&$format=json`;
      console.log('歷史API:', url);

      const response = await fetch(url);
      const contentType = response.headers.get('content-type');

      // 農業部沒資料會回 HTML，直接當空陣列
      if (!contentType ||!contentType.includes('application/json')) {
        console.log('農業部回非JSON，日期:', queryDate);
        return res.status(200).json([]);
      }

      const text = await response.text();
      let yearData = [];
      try {
        yearData = JSON.parse(text);
      } catch (e) {
        return res.status(200).json([]);
      }

      all = yearData.filter(d => d.交易日期 === queryDate);

    } else {
      // 沒指定日期用即時 API
      const url = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx?$format=json';
      const response = await fetch(url);
      const text = await response.text();
      all = JSON.parse(text);
    }

    let raw = all.filter(d =>
      d.市場名稱 &&
      (d.市場名稱.includes('三重') || d.市場名稱.includes('板橋')) &&
      d.種類代碼 === 'N05'
    );

    if (!queryDate && raw.length > 0) {
      const dates = [...new Set(raw.map(d => d.交易日期))].sort().reverse();
      const latestDate = dates[0];
      raw = raw.filter(d => d.交易日期 === latestDate);
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
    res.status(500).json({error: e.message});
  }
}
