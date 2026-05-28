export default async function handler(req, res) {
  try {
    const url = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx';
    const response = await fetch(url);
    const text = await response.text();
    const all = JSON.parse(text);

    const now = new Date();
    const rocYear = now.getFullYear() - 1911;
    const today = `${rocYear}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`;

    // 1. 先篩市場 + 水果
    const raw = all.filter(d =>
      d.市場名稱 &&
      (d.市場名稱.includes('三重') || d.市場名稱.includes('板橋')) &&
      d.種類代號 === 'N04'
    );

    // 2. 關鍵：同市場+同品名，只留第一筆 = 官網加總列
    const map = new Map();
    raw.forEach(d => {
      const key = d.市場名稱.trim() + '_' + d.作物名稱.trim();
      if (!map.has(key)) {
        map.set(key, d); // 只存第一筆
      }
    });
    
    const data = Array.from(map.values()).map(d => ({
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
    res.setHeader('Cache-Control', 's-maxage=300');
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({error: e.message});
  }
}
