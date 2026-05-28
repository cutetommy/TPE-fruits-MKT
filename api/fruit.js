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
      d.種類代號 === 'N04'
      // 先不篩日期，避免今天休市就完全沒資料
    );

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300');
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({error: e.message});
  }
}
