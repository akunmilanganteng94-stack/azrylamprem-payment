// Standalone Vercel Serverless Function for /api/create-qris

export default async function handler(req: any, res: any) {
  // Set CORS headers
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

    const { amount, invoice: clientInvoice, userEmail } = body;
    const numericAmount = Number(amount);

    if (isNaN(numericAmount) || numericAmount < 1000 || numericAmount > 100000) {
      return res.status(400).json({
        status: false,
        message: 'Nominal deposit harus antara Rp1.000 dan Rp100.000'
      });
    }

    const invoice = clientInvoice || `AZP-DEP-${Date.now()}`;

    // Get gateway credentials from Firestore REST or env
    let accountId = process.env.BQ_ACCOUNT_ID;
    let secretToken = process.env.BQ_SECRET_TOKEN;
    let umkmName = 'AZPREM STORE';
    let staticQr = '';

    try {
      const fsRes = await fetch(
        'https://firestore.googleapis.com/v1/projects/azrylstore-7f4e2/databases/(default)/documents/settings/global'
      );
      if (fsRes.ok) {
        const fsData: any = await fsRes.json();
        const f = fsData.fields || {};
        if (f.bqAccountId?.stringValue) accountId = f.bqAccountId.stringValue;
        if (f.bqSecretToken?.stringValue) secretToken = f.bqSecretToken.stringValue;
        if (f.bqUmkmName?.stringValue) umkmName = f.bqUmkmName.stringValue;
        if (f.staticQrString?.stringValue) staticQr = f.staticQrString.stringValue;
      }
    } catch (e) {
      console.warn('Notice reading settings from Firestore REST in lambda:', e);
    }

    // Call BuatQRIS API
    if (accountId && secretToken) {
      try {
        const formData = new URLSearchParams();
        formData.append('action', 'api_create_qris');
        formData.append('account_id', accountId.trim());
        formData.append('secret_token', secretToken.trim());
        formData.append('amount', String(numericAmount));
        formData.append('description', invoice);
        formData.append('qris_method', 'qris_two');
        formData.append('fee_by', 'merchant');
        formData.append('umkm_name', umkmName);

        const bqResponse = await fetch('https://api.buatqris.site', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString()
        });

        const bqData: any = await bqResponse.json();

        if (bqData && (bqData.success || bqData.status === 'success') && bqData.data) {
          const transactionId = String(bqData.data.transaction_id || '');
          const qrUrl = bqData.data.qr_url || bqData.data.qris_image || '';
          const qrisImage = bqData.data.qris_image || qrUrl;
          const uniqueCode = Number(bqData.data.unique_code || bqData.data.amount_uniq || 0);
          const totalPayment = Number(bqData.data.total_amount || (numericAmount + uniqueCode));

          const payloadData = {
            invoice,
            transaction_id: transactionId,
            amount: numericAmount,
            fee: 0,
            unique_code: uniqueCode,
            total_payment: totalPayment,
            qr_url: qrUrl,
            qris_url: qrUrl,
            qris_image: qrisImage,
            expired_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          };

          return res.status(200).json({
            status: true,
            success: true,
            data: payloadData,
            ...payloadData
          });
        } else {
          return res.status(400).json({
            status: false,
            message: bqData?.message || 'Gagal membuat QRIS dari API BuatQRIS'
          });
        }
      } catch (bqErr: any) {
        return res.status(500).json({
          status: false,
          message: `Gagal memproses ke BuatQRIS API: ${bqErr?.message || 'Network error'}`
        });
      }
    }

    return res.status(400).json({
      status: false,
      message: 'Gateway QRIS belum dikonfigurasi di Admin Panel'
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      message: error?.message || 'Terjadi kesalahan sistem'
    });
  }
}
