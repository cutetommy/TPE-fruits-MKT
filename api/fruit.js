export default async function handler(req, res) {
  try {
    const url = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx';
    const response = await fetch(url);
    const text = await response.text();
    const all = JSON.parse(text);

    // 民國年今天 114/05/28
    const now = new Date();
    const rocYear = now.getFullYear() - 1911;
    const today = `${rocYear}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`;

    const data = all.filter(d => {
      if (!d.市場名稱 || !d.種類代號 || !d.作物代號) return false;
      
      const isMarket = d.市場名稱.includes('三重') || d.市場名稱.includes('板橋');
      const isFruit = d.種類代號 === 'N04';
      // 關鍵：trim()後長度=2，才是A1、B1這種主品項
      const isMain = d.作物代號.trim().length === 2;
      // 只抓今天，避免歷史資料混進來
      const isToday = d.交易日期 === today;

      return isMarket && isFruit && isMain && isToday;
    }).map(d => ({
      交易日期: d.交易日期,
      市場名稱: d.市場名稱.trim(),
      作物代號: d.作物代號.trim(), // 回傳乾淨的代號
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
    res.status(500).json({error: e.message, stack: e.stack});
  }
}
