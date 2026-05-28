export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  try {
    const queryDate = req.query.date; // 114.05.23

    // 直接帶日期問農業部，不要先抓全部
    let url = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx?$format=json';
    if (queryDate) {
      url += `&$filter=date eq ${queryDate}`;
    }

    console.log('Fetching:', url);
    const response = await fetch(url);
    const text = await response.text();
    const all = JSON.parse(text);

    // 1. 只留三重+板橋的果菜 N05
    let raw = all.filter(d =>
      d.市場名稱 &&
      (d.市場名稱.includes('三重') || d.市場名稱.includes('板橋')) &&
      d.種類代碼 === 'N05'
    );

    // 2. 沒指定日期就拿最新一天，有指定就不用再 filter 了
    if (!queryDate && raw.length > 0) {
      const dates = [...new Set(raw.map(d => d.交易日期))].sort().reverse();
      const latestDate = dates[0];
      raw = raw.filter(d => d.交易日期 === latestDate);
    }

    // 3. 同市場+同品名去重
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
