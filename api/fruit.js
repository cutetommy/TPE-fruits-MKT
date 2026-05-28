export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  try {
    const queryDate = req.query.date; // 114.05.23

    // 農業部 OData 語法：欄位名是 交易日期，值要加單引號
    let url = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx?$format=json';
    if (queryDate) {
      // 重點：交易日期 eq '114.05.23'，欄位名+單引號都要
      url += `&$filter=交易日期 eq '${encodeURIComponent(queryDate)}'`;
    }

    console.log('Vercel fetch:', url);
    const response = await fetch(url);
    const text = await response.text();
    const all = JSON.parse(text);

    // 只留三重+板橋的果菜 N05
    let raw = all.filter(d =>
      d.市場名稱 &&
      (d.市場名稱.includes('三重') || d.市場名稱.includes('板橋')) &&
      d.種類代碼 === 'N05'
    );

    // 沒指定日期才自己抓最新一天。有帶日期的話農業部已經篩好了
    if (!queryDate && raw.length > 0) {
      const dates = [...new Set(raw.map(d => d.交易日期))].sort().reverse();
      const latestDate = dates[0];
      raw = raw.filter(d => d.交易日期 === latestDate);
    }

    // 同市場+同品名去重
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
