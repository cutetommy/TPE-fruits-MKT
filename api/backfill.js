import { kv } from '@vercel/kv';

function getRocDate(date) {
  const y = date.getFullYear() - 1911;
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

async function fetchAllFruit(rocDate) {
  let allData = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = `https://data.moa.gov.tw/api/v1/AgriProductsTransType/?Start_time=${rocDate}&End_time=${rocDate}&TransType=N05&Limit=${limit}&Offset=${offset}`;
    const res = await fetch(url).then(r => r.json());
    const data = res.Data || [];
    allData.push(...data);
    if (data.length < limit) break;
    offset += limit;
    if (offset > 30000) break;
  }
  return allData;
}

export default async function handler(req, res) {
  const results = [];
  const dates = req.query.date ? [req.query.date] : ['2026-05-26','2026-05-27','2026-05-28','2026-05-29'];

  for (const dateStr of dates) {
    const d = new Date(dateStr);
    const rocDate = getRocDate(d);
    const key = `fruit:${dateStr}`;

    try {
      const allData = await fetchAllFruit(rocDate);

      // 只用 MarketCode 篩，109=三重，220=板橋
      const data = allData.filter(item => 
        item.MarketCode === '109' || item.MarketCode === '220'
      ).map(d => ({
        ...d,
        // 把錯的名稱蓋掉，統一顯示
        MarketName: d.MarketCode === '109' ? '三重區' : '板橋區'
      }));

      await kv.set(key, data);
      await kv.expire(key, 60 * 60 * 24 * 200);
      
      const code109 = allData.filter(i => i.MarketCode === '109').length;
      const code220 = allData.filter(i => i.MarketCode === '220').length;
      results.push(`✅ ${key}: 三重(109) ${code109}筆，板橋(220) ${code220}筆`);

    } catch (e) {
      results.push(`✗ ${dateStr}: ${e.message}`);
    }
  }
  res.status(200).json({ results });
}
