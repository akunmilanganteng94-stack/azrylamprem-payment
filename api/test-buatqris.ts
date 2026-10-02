// Standalone Vercel Serverless Function for /api/test-buatqris

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

    const { accountId, secretToken } = body;
    if (!accountId || !secretToken) {
      return res.status(400).json({ status: false, message: 'Account ID dan Secret Token diperlukan' });
    }

    const formData = new URLSearchParams();
    formData.append('action', 'api_check_status');
    formData.append('account_id', accountId.trim());
    formData.append('secret_token', secretToken.trim());
    formData.append('transaction_id', '00000000');

    const bqResponse = await fetch('https://api.buatqris.site', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });
    const bqData: any = await bqResponse.json();

    if (bqData && bqData.message && bqData.message.toLowerCase().includes('tidak ditemukan')) {
      return res.status(200).json({
        status: true,
        message: 'Koneksi ke BuatQRIS API Berhasil! Kredensial valid.'
      });
    }

    if (bqData && bqData.success) {
      return res.status(200).json({
        status: true,
        message: 'Koneksi ke BuatQRIS API Berhasil!'
      });
    }

    return res.status(200).json({
      status: false,
      message: bqData?.message || 'Gagal memvalidasi kredensial BuatQRIS'
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: error?.message || 'Gagal menghubungi server BuatQRIS'
    });
  }
}
