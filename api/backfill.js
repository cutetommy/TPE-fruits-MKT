import { kv } from '@vercel/kv';

function toSlashDate(dateStr) {
  // 2026-05-27 -> 2026/05/27
  return dateStr.replace(/-/g, '/');
}

async function fetchNtpmMarket(market, dateStr) {
  const url = 'https://www.ntpm.com.tw/api/MarketInfo/GetTransInfo';
  const body = new URLSearchParams({
    Market: market, // '三重' 或 '板橋'
    TransDate: toSlashDate(dateStr)
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  
  const data = await res.json();
  // 新北果菜回傳格式：{ Item: [...], TotalCount: 123 }
  return data.Item || [];
}

export default async function handler(req, res) {
  const results = [];
  const dates = req.query.date ? [req.query.date] : ['2026-05-26','2026-05-27','2026-05-28','2026-05-29'];

  for (const dateStr of dates) {
    const key = `fruit:${dateStr}`;
    try {
      // 分別抓三重跟板橋，再合併
      const [sanChong, banQiao] = await Promise.all([
        fetchNtpmMarket('三重', dateStr),
        fetchNtpmMarket('板橋', dateStr)
      ]);

      const data = [
        ...sanChong.map(d => ({ ...d, MarketName: '三重區', MarketCode: '109' })),
        ...banQiao.map(d => ({ ...d, MarketName: '板橋區', MarketCode: '220' }))
      ];

      await kv.set(key, data);
      await kv.expire(key, 60 * 60 * 24 * 200);
      results.push(`✅ ${key}: 三重 ${sanChong.length}筆，板橋 ${banQiao.length}筆`);

    } catch (e) {
      results.push(`✗ ${dateStr}: ${e.message}`);
    }
  }
  res.status(200).json({ results });
}
