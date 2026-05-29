import { kv } from '@vercel/kv';

function getRocDate(date) {
  const y = date.getFullYear() - 1911;
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

export default async function handler(req, res) {
  const results = [];
  const dates = req.query.date ? [req.query.date] : ['2026-05-27','2026-05-28','2026-05-29'];

  for (const dateStr of dates) {
    const d = new Date(dateStr);
    const rocDate = getRocDate(d);
    const key = `fruit:${dateStr}`;

    try {
      // 重點：用 MarketName，不是 MarketCode。中文要用 encodeURIComponent
      const url = `https://data.moa.gov.tw/api/v1/AgriProductsTransType/?Start_time=${rocDate}&End_time=${rocDate}&MarketName=${encodeURIComponent('三重')}&MarketName=${encodeURIComponent('板橋')}`;
      
      const data = await fetch(url).then(r => r.json()).then(j => j.Data || []);

      await kv.set(key, data);
      await kv.expire(key, 60 * 60 * 24 * 200);
      results.push(`✅ ${key}: ${data.length}筆`);

    } catch (e) {
      results.push(`✗ ${dateStr}: ${e.message}`);
    }
  }
  res.status(200).json({ results });
}
