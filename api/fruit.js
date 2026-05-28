export default async function handler(req, res) {
  const url = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx';
  const response = await fetch(url);
  const data = await response.json();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300'); // 快取5分鐘
  res.status(200).json(data);
}
