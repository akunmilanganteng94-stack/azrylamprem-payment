import { setCorsHeaders, parseBody } from '../_shared';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method Not Allowed' });
  }

  try {
    const body = await parseBody(req);
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
    console.error('Error in /api/am/verify:', error);
    return res.status(500).json({
      status: false,
      message: error?.message || 'Gagal memverifikasi akun AM'
    });
  }
}
