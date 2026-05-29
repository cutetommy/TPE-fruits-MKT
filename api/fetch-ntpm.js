export const config = { runtime: 'edge' };

async function fetchNtpm(market, dateStr) {
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent('https://www.ntpm.com.tw/api/MarketInfo/GetTransInfo')}`;
  const body = new URLSearchParams({
    Market: market,
    TransDate: dateStr.replace(/-/g, '/')
  });

  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const data = await res.json();
  return data.Item || [];
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date') || '2026-05-27';
  
  const [sanChong, banQiao] = await Promise.all([
    fetchNtpm('三重', dateStr),
    fetchNtpm('板橋', dateStr)
  ]);

  return Response.json({
    date: dateStr,
    三重: sanChong.length,
    板橋: banQiao.length,
    休市: sanChong.length === 0 && banQiao.length === 0
  });
}
