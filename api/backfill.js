import { kv } from '@vercel/kv';

function getRocDate(date) {
  const y = date.getFullYear() - 1911;
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

export default async function handler(req, res) {
  // 避免被亂打，加個密鑰
  if (req.query.key !== 'your-secret-key') {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const results = [];
  const today = new Date();
  
  // Vercel 免費版最多跑10秒，pro是60秒
  // 一次最多跑20天，跑不完就分多次打
  const daysToFetch = parseInt(req.query.days) || 20;
  const offset = parseInt(req.query.offset) || 0;
  
  for (let i = offset; i < offset + daysToFetch && i < 180; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const rocDate = getRocDate(date);
    
    try {
      const url = `https://data.moa.gov.tw/api/v1/AgriProductsTransType/?Start_time=${rocDate}&End_time=${rocDate}`;
      const data = await fetch(url).then(r => r.json()).then(j => j.Data || []);
      
      if (data.length > 0) {
        const key = `fruit:${date.toISOString().slice(0, 10)}`;
        await kv.set(key, data);
        await kv.expire(key, 60 * 60 * 24 * 200);
        results.push(`✓ ${rocDate}: ${data.length}筆`);
      } else {
        results.push(`- ${rocDate}: 沒資料`);
      }
    } catch (e) {
      results.push(`✗ ${rocDate}: ${e.message}`);
    }
  }

  res.status(200).json({ 
    done: offset + daysToFetch >= 180,
    nextOffset: offset + daysToFetch,
    results 
  });
}
