import { kv } from '@vercel/kv';

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.headers.authorization!== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end('Unauthorized');
  }

  try {
    const isInit = req.query.init === 'true';

    // 第一次初始化：抓今年整年資料
    if (isInit) {
      const year = new Date().getFullYear(); // 2026
      const url = `https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransDataHistory.aspx?year=${year}&$format=json`;
      const response = await fetch(url);
      const all = await response.json();

      const dateMap = {};
      all.forEach(d => {
        if (!d.交易日期) return;
        if (!dateMap[d.交易日期]) dateMap[d.交易日期] = [];
        dateMap[d.交易日期].push(d);
      });

      let count = 0;
      for (const date in dateMap) {
        const raw = dateMap[date].filter(d =>
          d.市場名稱 && (d.市場名稱.includes('三重') || d.市場名稱.includes('板橋')) && d.種類代碼 === 'N05'
        );
        if (raw.length > 0) {
          await kv.set(`fruit:${date}`, raw);
          count++;
        }
      }
      return res.status(200).json({ msg: `初始化完成`, days: count });
    }

    // 平常每天更新：抓昨天
    const today = new Date();
    const yesterday = new Date(today.setDate(today.getDate() - 1));
    const rocYear = yesterday.getFullYear() - 1911;
    const m = String(yesterday.getMonth() + 1).padStart(2, '0');
    const d = String(yesterday.getDate()).padStart(2, '0');
    const queryDate = `${rocYear}.${m}.${d}`;

    const url = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx?$format=json';
    const response = await fetch(url);
    const all = await response.json();
    const dayData = all.filter(d =>
      d.交易日期 === queryDate &&
      d.市場名稱 && (d.市場名稱.includes('三重') || d.市場名稱.includes('板橋')) && d.種類代碼 === 'N05'
    );

    if (dayData.length > 0) {
      await kv.set(`fruit:${queryDate}`, dayData);
      res.status(200).json({ msg: `更新 ${queryDate} 成功`, count: dayData.length });
    } else {
      res.status(200).json({ msg: `${queryDate} 無資料` });
    }

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
