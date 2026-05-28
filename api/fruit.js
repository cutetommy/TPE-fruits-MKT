export default async function handler(req, res) {
  try {
    const url = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx';
    const response = await fetch(url);
    const text = await response.text(); // 先拿 text 避免編碼炸掉
    const all = JSON.parse(text);

    // 轉成民國年 114/05/28 格式
    const now = new Date();
    const rocYear = now.getFullYear() - 1911;
    const today = `${rocYear}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`;

    const data = all.filter(d =>
      d.市場名稱 &&
      (d.市場名稱.includes('三重') || d.市場名稱.includes('板橋')) &&
      d.種類代號 === 'N04' &&
      // 新增這行：只保留主品項 A1, B1... 2碼，trim()去空白
      d.作物代號 && d.作物代號.trim().length === 2
      // 先不篩日期，避免今天休市就完全沒資料
    ).map(d => ({
      ...d,
      作物代號: d.作物代號.trim(), // 回傳乾淨代號
      作物名稱: d.作物名稱.trim(),
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
