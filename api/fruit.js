export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  try {
    const queryDate = req.query.date; // 114.05.23
    let all = [];

    if (queryDate) {
      // 有指定日期：直接用歷史資料 API，什麼日期都查得到
      const rocYear = parseInt(queryDate.split('.')[0]);
      const adYear = rocYear + 1911;

      // 農業部歷史資料要按年抓，例：114年 = 2025年
      const url = `https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransDataHistory.aspx?year=${adYear}&$format=json`;
      console.log('歷史API:', url);

      const response = await fetch(url);
      const text = await response.text();
      const yearData = JSON.parse(text);

      // 再自己 filter 指定日期
      all = yearData.filter(d => d.交易日期 === queryDate);
    } else {
      // 沒指定日期：用即時 API 抓最新
      const url = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx?$format=json';
      const response = await fetch(url);
      const text = await response.text();
      all = JSON.parse(text);
    }

    // 後面邏輯不變：只留三重+板橋的果菜 N05
    let raw = all.filter(d =>
      d.市場名稱 &&
      (d.市場名稱.includes('三重') || d.市場名稱.includes('板橋')) &&
      d.種類代碼 === 'N05'
    );

    // 沒指定日期才自己抓最新一天
    if (!queryDate && raw.length > 0) {
      const dates = [...new Set(raw.map(d => d.交易日期))].sort().reverse();
      const latestDate = dates[0];
      raw = raw.filter(d => d.交易日期 === latestDate);
    }

    // 去重
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
