export default async function handler(req, res) {
  try {
    const url = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx';
    const response = await fetch(url);
    const text = await response.text();
    const all = JSON.parse(text);

    const allMarkets = [...new Set(all.map(d => d.市場名稱))].filter(Boolean);
    const sanChong = all.filter(d => d.市場名稱 && d.市場名稱.includes('三重'));
    const banqiao = all.filter(d => d.市場名稱 && d.市場名稱.includes('板橋'));
    const fruits = all.filter(d => d.種類代號 === 'N04');

    res.status(200).json({
      status: 'raw_check',
      total_rows: all.length,
      total_fruits_N04: fruits.length,
      sanchong_count: sanChong.length,
      banqiao_count: banqiao.length,
      sanchong_dates: [...new Set(sanChong.map(d => d.交易日期))],
      first_5_markets: allMarkets.slice(0, 10),
      sanChong_sample: sanChong.slice(0, 2)
    });
  } catch (e) {
    res.status(500).json({error: e.message, stack: e.stack});
  }
}
