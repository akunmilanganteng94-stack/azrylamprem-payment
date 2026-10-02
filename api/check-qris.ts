import { setCorsHeaders, parseBody, getGlobalSettings, memoryPaymentStore } from './_shared';

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
    const { invoice } = body;
    if (!invoice) {
      return res.status(400).json({ status: false, message: 'Invoice diperlukan' });
    }

    const item = memoryPaymentStore[invoice];
    if (item && item.status === 'paid') {
      return res.status(200).json({
        status: true,
        payment_status: 'paid',
        message: 'Pembayaran telah berhasil diterima'
      });
    }

    const settings = await getGlobalSettings();
    const accountId = settings.bqAccountId;
    const secretToken = settings.bqSecretToken;

    if (accountId && secretToken) {
      try {
        const formData = new URLSearchParams();
        formData.append('action', 'api_check_status');
        formData.append('account_id', accountId.trim());
        formData.append('secret_token', secretToken.trim());
        if (item?.transactionId) {
          formData.append('transaction_id', item.transactionId);
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
          if (item) item.status = 'paid';
          return res.status(200).json({
            status: true,
            payment_status: 'paid',
            raw: bqData
          });
        }
      } catch (err) {
        console.warn('BuatQRIS status check notice:', err);
      }
    }

    return res.status(200).json({
      status: true,
      payment_status: item?.status || 'pending',
      message: 'Menunggu pembayaran'
    });
  } catch (error: any) {
    console.error('Error in /api/check-qris:', error);
    return res.status(500).json({ status: false, message: 'Gagal mengecek status QRIS' });
  }
}
