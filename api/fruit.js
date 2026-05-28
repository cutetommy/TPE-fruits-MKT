export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  try {
    const queryDate = req.query.date;
    let all = [];

    if (queryDate) {
      const rocYear = parseInt(queryDate.split('.')[0]);
      const adYear = rocYear + 1911;

      // 1. 先打歷史庫
      const historyUrl = `https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransDataHistory.aspx?year=${adYear}&$format=json`;
      const historyRes = await fetch(historyUrl);
      const historyType = historyRes.headers.get('content-type');

      if (historyType && historyType.includes('application/json')) {
        const text = await historyRes.text();
        const yearData = JSON.parse(text);
        all = yearData.filter(d => d.交易日期 === queryDate);
      }

      // 2. 歷史庫沒資料，再打即時庫試試
      if (all.length === 0) {
        console.log('歷史庫沒資料，改打即時庫');
        const realtimeUrl = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx?$format=json';
        const realtimeRes = await fetch(realtimeUrl);
        const realtimeText = await realtimeRes.text();
        const realtimeData = JSON.parse(realtimeText);
        all = realtimeData.filter(d => d.交易日期 === queryDate);
      }

    } else {
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
