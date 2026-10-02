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
    const { amount, invoice: clientInvoice, userEmail } = body;
    const numericAmount = Number(amount);

    if (isNaN(numericAmount) || numericAmount < 1000 || numericAmount > 100000) {
      return res.status(400).json({
        status: false,
        message: 'Nominal deposit harus antara Rp1.000 dan Rp100.000'
      });
    }

    const invoice = clientInvoice || `AZP-DEP-${Date.now()}`;
    const settings = await getGlobalSettings();
    const accountId = settings.bqAccountId;
    const secretToken = settings.bqSecretToken;
    const umkmName = settings.bqUmkmName || 'AZPREM STORE';
    const staticQr = settings.staticQrString;

    // METODE 1: BuatQRIS API Gateway (Foto QRIS & Kode Unik Asli Langsung dari API)
    if (accountId && secretToken) {
      try {
        const callbackUrl = process.env.APP_URL 
          ? `${process.env.APP_URL}/api/webhook` 
          : 'https://azprem.vercel.app/api/webhook';

        const formData = new URLSearchParams();
        formData.append('action', 'api_create_qris');
        formData.append('account_id', accountId.trim());
        formData.append('secret_token', secretToken.trim());
        formData.append('amount', String(numericAmount));
        formData.append('description', invoice);
        formData.append('qris_method', 'qris_two');
        formData.append('fee_by', 'merchant');
        formData.append('umkm_name', umkmName);
        formData.append('callback_url', callbackUrl);

        const bqResponse = await fetch('https://api.buatqris.site', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData.toString()
        });

        const bqData: any = await bqResponse.json();

        if (bqData && (bqData.success || bqData.status === 'success') && bqData.data) {
          const transactionId = String(bqData.data.transaction_id || '');
          const qrUrl = bqData.data.qr_url || bqData.data.qris_image || '';
          const qrisImage = bqData.data.qris_image || qrUrl;
          const uniqueCode = Number(bqData.data.unique_code || 0);
          const totalPayment = Number(bqData.data.total_amount || (numericAmount + uniqueCode));

          memoryPaymentStore[invoice] = {
            status: 'pending',
            totalPayment,
            transactionId
          };

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
            message: bqData?.message || 'Gagal membuat QRIS dari API BuatQRIS. Periksa Account ID & Secret Token.'
          });
        }
      } catch (bqErr: any) {
        console.error('BuatQRIS API Error:', bqErr);
        return res.status(500).json({
          status: false,
          message: `Gagal memproses ke BuatQRIS API: ${bqErr?.message || 'Network error'}`
        });
      }
    }

    // METODE 2: String QRIS Toko Statis Asli
    if (staticQr && staticQr.startsWith('000201')) {
      try {
        const uniqueCode = Math.floor(Math.random() * 80) + 11;
        const totalPayment = numericAmount + uniqueCode;

        const apiRes = await fetch(
          `https://api.zyvor.my.id/api/payment/qris-static?qr=${encodeURIComponent(staticQr)}&amount=${totalPayment}`
        );
        const apiData: any = await apiRes.json();

        if (apiData && apiData.status && apiData.result?.url) {
          memoryPaymentStore[invoice] = {
            status: 'pending',
            totalPayment
          };

          const payloadData = {
            invoice,
            amount: numericAmount,
            fee: 0,
            unique_code: uniqueCode,
            total_payment: totalPayment,
            qris_content: apiData.result.qr_string,
            qr_url: apiData.result.url,
            qris_url: apiData.result.url,
            qris_image: apiData.result.url,
            expired_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          };

          return res.status(200).json({
            status: true,
            success: true,
            data: payloadData,
            ...payloadData
          });
        }
      } catch (staticErr) {
        console.warn('Static QR conversion error:', staticErr);
      }
    }

    return res.status(400).json({
      status: false,
      message: 'Gateway QRIS belum dikonfigurasi. Masukkan Account ID & Secret Token BuatQRIS di Admin Panel > Setting agar QRIS & kode unik dibuat 100% resmi dari API dan bisa di-scan tanpa kendala.'
    });
  } catch (error: any) {
    console.error('Error in /api/create-qris handler:', error);
    return res.status(500).json({
      status: false,
      message: error?.message || 'Terjadi kesalahan sistem membuat deposit'
    });
  }
}
