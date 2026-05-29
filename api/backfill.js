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
    if (offset > 10000) break;
  }
  return allData;
}

export default async function handler(req, res) {
  const results = [];
  const dateStr = req.query.date || '2026-05-27';
  const d = new Date(dateStr);
  const rocDate = getRocDate(d);
  const key = `fruit:${dateStr}`;

  try {
    const allData = await fetchAllFruit(rocDate);

    // 1. 印出當天所有市場名稱，看三重到底叫什麼
    const allMarkets = [...new Set(allData.map(i => i.MarketName))].sort();

    // 2. 寬鬆比對，只要包含三重或板橋就抓
    const data = allData.filter(item => 
      item.MarketName?.includes('三重') || item.MarketName?.includes('板橋')
    );

    await kv.set(key, data);
    await kv.expire(key, 60 * 60 * 24 * 200);
    
    results.push(`✅ ${key}: 水果全市場 ${allData.length}筆 → 三重板橋 ${data.length}筆`);
    results.push(`當天所有市場: ${allMarkets.join(', ')}`); // 重點看這行

  } catch (e) {
    results.push(`✗ ${dateStr}: ${e.message}`);
  }

  res.status(200).json({ results });
}
