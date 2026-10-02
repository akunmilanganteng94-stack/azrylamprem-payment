// Standalone Vercel Serverless Function for /api/am/bulk

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    } else if (!body) {
      body = {};
    }

    const { count } = body;
    const numCount = parseInt(String(count), 10);
    if (isNaN(numCount) || numCount < 1 || numCount > 5) {
      return res.status(400).json({ status: false, message: 'Jumlah harus antara 1 sampai 5' });
    }

    const response = await fetch('https://api.zyvor.my.id/api/am/bulkv3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AZPREM-App/1.0'
      },
      body: JSON.stringify({ count: String(numCount) })
    });

    const data: any = await response.json().catch(() => ({ status: response.ok, message: response.statusText }));
    return res.status(response.status).json(data);
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: error?.message || 'Gagal memproses AM Bulk'
    });
  }
}
