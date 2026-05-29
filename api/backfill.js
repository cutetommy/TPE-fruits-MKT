import { kv } from '@vercel/kv';

function toSlashDate(dateStr) {
  return dateStr.replace(/-/g, '/');
}

async function fetchNtpmMarket(market, dateStr) {
  const url = 'https://www.ntpm.com.tw/api/MarketInfo/GetTransInfo';
  const body = new URLSearchParams({
    Market: market,
    TransDate: toSlashDate(dateStr)
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Referer': 'https://www.ntpm.com.tw/MarketInfo',
      'Origin': 'https://www.ntpm.com.tw'
    },
    body
  });
  
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.Item || [];
}

export default async function handler(req, res) {
  const results = [];
  const dates = req.query.date ? [req.query.date] : ['2026-05-26','2026-05-27','2026-05-28'];

  for (const dateStr of dates) {
    const key = `fruit:${dateStr}`;
    try {
      const [sanChong, banQiao] = await Promise.all([
        fetchNtpmMarket('三重', dateStr),
        fetchNtpmMarket('板橋', dateStr)
      ]);

      // 新北果菜回傳欄位要對應一下
      const normalize = (arr, marketName, code) => arr.map(d => ({
        TransDate: d.TransDate, // 民國年 115.05.27
        CropName: d.CropName,
        CropCode: d.CropCode,
        MarketName: marketName,
        MarketCode: code,
        Upper_Price: d.UpperPrice,
        Middle_Price: d.MiddlePrice,
        Lower_Price: d.LowerPrice,
        Avg_Price: d.AvgPrice,
        Trans_Quantity: d.TransQuantity
      }));

      const data = [
        ...normalize(sanChong, '三重區', '109'),
        ...normalize(banQiao, '板橋區', '220')
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
