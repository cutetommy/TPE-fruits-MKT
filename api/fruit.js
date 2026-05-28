export default async function handler(req, res) {
  try {
    const url = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx';
    const response = await fetch(url);
    const text = await response.text();
    const all = JSON.parse(text);

    const now = new Date();
    const rocYear = now.getFullYear() - 1911;
    const today = `${rocYear}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`;

    // 1. 跟你舊版一模一樣，不過濾日期、先不過濾代號
    const raw = all.filter(d =>
      d.市場名稱 &&
      (d.市場名稱.includes('三重') || d.市場名稱.includes('板橋')) &&
      d.種類代號 === 'N04'
    );

    // 2. 只加這段：同市場+同品名，只留第一筆
    const seen = new Set();
    const data = raw.filter(d => {
      const key = d.市場名稱.trim() + '_' + d.作物名稱.trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300');
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({error: e.message});
  }
}
