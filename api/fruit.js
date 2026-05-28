export default async function handler(req, res) {
  try {
    const url = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx';
    const response = await fetch(url);
    const text = await response.text();
    const all = JSON.parse(text);

    // 1. 先篩三重+板橋水果
    const raw = all.filter(d =>
      d.市場名稱 &&
      (d.市場名稱.includes('三重') || d.市場名稱.includes('板橋')) &&
      d.種類代號 === 'N04'
    );

    // 2. 只保留主品項：作物代號長度 = 2，例如 A1, B1, C1
    // 子品項 A11, A12, B21 會被濾掉
    const data = raw.filter(d => d.作物代號 && d.作物代號.length === 2)
      .map(d => ({
        交易日期: d.交易日期,
        市場名稱: d.市場名稱,
        作物代號: d.作物代號,
        作物名稱: d.作物名稱,
        上價: +d.上價 || 0,
        中價: +d.中價 || 0,
        下價: +d.下價 || 0,
        平均價: +d.平均價 || 0,
        交易量: +d.交易量 || 0
      }));

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300');
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({error: e.message});
  }
}
