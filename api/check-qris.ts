// Standalone Vercel Serverless Function for /api/check-qris

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

    const { invoice, transactionId } = body;
    if (!invoice && !transactionId) {
      return res.status(400).json({ status: false, message: 'Invoice atau Transaction ID diperlukan' });
    }

    // Get credentials from Firestore REST or env
    let accountId = process.env.BQ_ACCOUNT_ID;
    let secretToken = process.env.BQ_SECRET_TOKEN;

    try {
      const fsRes = await fetch(
        'https://firestore.googleapis.com/v1/projects/azrylstore-7f4e2/databases/(default)/documents/settings/global'
      );
      if (fsRes.ok) {
        const fsData: any = await fsRes.json();
        const f = fsData.fields || {};
        if (f.bqAccountId?.stringValue) accountId = f.bqAccountId.stringValue;
        if (f.bqSecretToken?.stringValue) secretToken = f.bqSecretToken.stringValue;
      }
    } catch {}

    if (accountId && secretToken) {
      try {
        const formData = new URLSearchParams();
        formData.append('action', 'api_check_status');
        formData.append('account_id', accountId.trim());
        formData.append('secret_token', secretToken.trim());
        if (transactionId) {
          formData.append('transaction_id', transactionId);
        } else {
          formData.append('invoice', invoice);
        }

        const bqResponse = await fetch('https://api.buatqris.site', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString()
        });
        const bqData: any = await bqResponse.json();

        const st = String(bqData.status || bqData.data?.status || bqData.payment_status || '').toLowerCase();
        if (st === 'success' || st === 'paid' || st === 'settlement' || st === 'berhasil') {
          return res.status(200).json({
            status: true,
            payment_status: 'paid',
            raw: bqData
          });
        }
      } catch (err) {
        console.warn('Status check notice:', err);
      }
    }

    return res.status(200).json({
      status: true,
      payment_status: 'pending',
      message: 'Menunggu pembayaran'
    });
  } catch (error: any) {
    return res.status(500).json({ status: false, message: error?.message || 'Gagal mengecek status' });
  }
}
