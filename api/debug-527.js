export default async function handler(req, res) {
  const rocDate = '115.05.27';
  let allData = [];
  let offset = 0;

  while (true) {
    const url = `https://data.moa.gov.tw/api/v1/AgriProductsTransType/?Start_time=${rocDate}&End_time=${rocDate}&TransType=N05&Limit=1000&Offset=${offset}`;
    const data = await fetch(url).then(r => r.json()).then(j => j.Data || []);
    allData.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
    if (offset > 20000) break;
  }

  // 把所有市場名稱 + 代碼列出來
  const marketMap = {};
  allData.forEach(d => {
    const key = `${d.MarketName} (${d.MarketCode || '無代碼'})`;
    marketMap[key] = (marketMap[key] || 0) + 1;
  });

  // 找出可能是三重的可疑資料
  const suspect = allData.filter(d =>
    d.CropName?.includes('芒果') || // 三重 5月芒果最多
    d.MarketCode === '109' ||
    d.MarketName?.includes('三') ||
    d.MarketName?.includes('新北')
  ).slice(0, 10);

  res.status(200).json({
    total: allData.length,
    marketMap, // 看這裡，三重到底被叫什麼
    suspectSample: suspect // 看這裡，找三重的線索
  });
}
