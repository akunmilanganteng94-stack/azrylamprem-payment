// Standalone Vercel Serverless Function for /api/am/verify

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

    const { email, link } = body;
    if (!email || !link) {
      return res.status(400).json({ status: false, message: 'Email dan link verifikasi diperlukan' });
    }

    const response = await fetch('https://api.zyvor.my.id/api/am/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AZPREM-App/1.0'
      },
      body: JSON.stringify({ email: email.trim(), link: link.trim() })
    });

    const data: any = await response.json().catch(() => ({ status: response.ok, message: response.statusText }));
    return res.status(response.status).json(data);
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: error?.message || 'Gagal memverifikasi akun AM'
    });
  }
}
