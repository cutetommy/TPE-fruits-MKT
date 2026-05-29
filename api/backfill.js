import { kv } from '@vercel/kv';

function getRocDate(date) {
  const y = date.getFullYear() - 1911;
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

// 只抓三重 + 板橋
const MARKETS = [
  { code: '109', name: '三重' },
  { code: '220', name: '板橋' },
];

export default async function handler(req, res) {
  const results = [];
  // 預設補近7天，要補特定日期就用 ?date=2026-05-27
  const dates = req.query.date ? [req.query.date] : Array.from({length: 7}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });

  for (const dateStr of dates) {
    const d = new Date(dateStr);
    const rocDate = getRocDate(d);
    const key = `fruit:${dateStr}`;
    let dayData = [];

    try {
      for (const m of MARKETS) {
        const url = `https://data.moa.gov.tw/api/v1/AgriProductsTransType/?Start_time=${rocDate}&End_time=${rocDate}&MarketCode=${m.code}`;
        const data = await fetch(url).then(r => r.json()).then(j => j.Data || []);
        dayData.push(...data);
        results.push(`✓ ${dateStr} ${m.name}: ${data.length}筆`);
      }

      await kv.set(key, dayData);
      await kv.expire(key, 60 * 60 * 24 * 200);
      results.push(`✅ ${key}: 總共 ${dayData.length}筆`);

    } catch (e) {
      results.push(`✗ ${dateStr}: ${e.message}`);
    }
  }
  res.status(200).json({ results });
}
