export const config = { runtime: 'edge' };

async function fetchNtpm(market, dateStr) {
  const apiUrl = 'https://www.ntpm.com.tw/api/MarketInfo/GetTransInfo';
  const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`;
  
  const body = new URLSearchParams({
    Market: market,
    TransDate: dateStr.replace(/-/g, '/')
  });

  const res = await fetch(proxy, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  
  if (!res.ok) throw new Error(`NTPM HTTP ${res.status}`);
  const data = await res.json();
  return data.Item || [];
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date') || '2026-05-26';
  
  try {
    const [sanChong, banQiao] = await Promise.all([
      fetchNtpm('三重', dateStr),
      fetchNtpm('板橋', dateStr)
    ]);

    const normalize = arr => arr.map(d => ({
      TransDate: d.TransDate,      // 115.05.26
      CropName: d.CropName,        // 芒果-愛文
      Avg_Price: d.AvgPrice,       // 56.8
      Trans_Quantity: d.TransQuantity,
      Upper_Price: d.UpperPrice,
      Middle_Price: d.MiddlePrice,
      Lower_Price: d.LowerPrice
    }));

    return Response.json({
      date: dateStr,
      weekday: new Date(dateStr).getDay(), // 0=日, 1=一
      三重: { count: sanChong.length, data: normalize(sanChong).slice(0,2) },
      板橋: { count: banQiao.length, data: normalize(banQiao).slice(0,2) },
      休市: sanChong.length === 0 && banQiao.length === 0
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
