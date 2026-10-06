import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// In-memory payment status and transaction ID map
const paymentStatusStore: Record<string, { 
  status: string; 
  totalPayment: number; 
  transactionId?: string;
  paidAt?: string 
}> = {};

// Helper to fetch global settings from Firestore REST (allows dynamic gateway credentials without restart)
async function getGlobalSettings() {
  try {
    const res = await fetch('https://firestore.googleapis.com/v1/projects/azrylstore-7f4e2/databases/(default)/documents/settings/global');
    if (res.ok) {
      const json = await res.json();
      const fields = json.fields || {};
      return {
        bqAccountId: fields.bqAccountId?.stringValue || process.env.BQ_ACCOUNT_ID,
        bqSecretToken: fields.bqSecretToken?.stringValue || process.env.BQ_SECRET_TOKEN,
        bqUmkmName: fields.bqUmkmName?.stringValue || 'AZPREM STORE',
        staticQrString: fields.staticQrString?.stringValue
      };
    }
  } catch (err) {
    console.warn('Notice reading settings from Firestore REST:', err);
  }

  return {
    bqAccountId: process.env.BQ_ACCOUNT_ID,
    bqSecretToken: process.env.BQ_SECRET_TOKEN,
    bqUmkmName: 'AZPREM STORE',
    staticQrString: undefined
  };
}

// CRC-16/CCITT-FALSE calculation
function calculateCRC16(data: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= (data.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Chat URL / Link regex detection
const URL_REGEX = /(https?:\/\/|www\.|wa\.me\/|t\.me\/|discord\.gg\/|[a-zA-Z0-9-]+\.(com|id|me|net|org|io|xyz|app|top|biz|info|cc|co))/i;

// 1. Chat Message Validation & Mute
app.post('/api/chat/validate', (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Teks pesan diperlukan' });
  }

  if (URL_REGEX.test(text)) {
    return res.status(200).json({
      blocked: true,
      reason: 'Pesan berisi link/URL tidak diperbolehkan.',
      muteMinutes: 30,
      muteUntil: Date.now() + 30 * 60 * 1000
    });
  }

  return res.status(200).json({
    blocked: false
  });
});

// 2. Order AM: Send Gmail
app.post('/api/am/send', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ status: false, message: 'Email tidak valid' });
    }

    const response = await fetch('https://api.zyvor.my.id/api/am/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AZPREM-App/1.0'
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json().catch(() => ({ status: response.ok, message: response.statusText }));
    return res.status(response.status).json(data);
  } catch (error: any) {
    console.error('Error in /api/am/send:', error);
    return res.status(500).json({
      status: false,
      message: error?.message || 'Gagal menghubungi server AM Send'
    });
  }
});

// 3. Order AM: Verify
app.post('/api/am/verify', async (req: Request, res: Response) => {
  try {
    const { email, link } = req.body;
    if (!email || !link) {
      return res.status(400).json({ status: false, message: 'Email dan link verifikasi diperlukan' });
    }

    const response = await fetch('https://api.zyvor.my.id/api/am/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AZPREM-App/1.0'
      },
      body: JSON.stringify({ email, link })
    });

    const data = await response.json().catch(() => ({ status: response.ok, message: response.statusText }));
    return res.status(response.status).json(data);
  } catch (error: any) {
    console.error('Error in /api/am/verify:', error);
    return res.status(500).json({
      status: false,
      message: error?.message || 'Gagal memverifikasi akun AM'
    });
  }
});

// 4. Order AM: Bulk
app.post('/api/am/bulk', async (req: Request, res: Response) => {
  try {
    const { count } = req.body;
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

    const data = await response.json().catch(() => ({ status: response.ok, message: response.statusText }));
    return res.status(response.status).json(data);
  } catch (error: any) {
    console.error('Error in /api/am/bulk:', error);
    return res.status(500).json({
      status: false,
      message: error?.message || 'Gagal memproses AM Bulk'
    });
  }
});

// 4.1. Search Preset AM (TikTok to Alight Motion 5MB / XML)
app.all(['/api/am/preset', '/api/preset'], async (req: Request, res: Response) => {
  try {
    const rawUrl = (req.query.url as string) || req.body?.url;
    if (!rawUrl || typeof rawUrl !== 'string') {
      return res.status(400).json({ ok: false, message: 'URL video TikTok diperlukan' });
    }

    const apiUrl = `https://api.nexadev.my.id/api/ampreset/?url=${encodeURIComponent(rawUrl.trim())}`;
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    const data = await response.json().catch(() => null);
    if (!data) {
      return res.status(502).json({ ok: false, message: 'Respon dari server preset tidak dapat dibaca' });
    }

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Error in /api/am/preset:', error);
    return res.status(500).json({
      ok: false,
      message: error?.message || 'Gagal mengambil preset AM'
    });
  }
});

// 5. Deposit: Create QRIS
// Sesuai permintaan user:
// - Foto QRIS benar-benar dari API (bisa discan semua bank & e-wallet tanpa error "QR tidak tersedia")
// - Kode unik benar-benar dari API
// - Fee dihapus (hanya ada deposit + kode unik)
app.post('/api/create-qris', async (req: Request, res: Response) => {
  try {
    const { amount, invoice: clientInvoice, userEmail } = req.body;
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

    // METODE UTAMA: BuatQRIS API Gateway (Foto QRIS & Kode Unik Asli Langsung dari API)
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
        formData.append('fee_by', 'merchant'); // Fee ditanggung toko sehingga customer gratis fee
        formData.append('umkm_name', umkmName);
        formData.append('callback_url', callbackUrl);

        console.log(`[BuatQRIS API Call] Requesting QRIS for ${invoice}, amount: ${numericAmount}...`);
        const bqResponse = await fetch('https://api.buatqris.site', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData.toString()
        });

        const bqData = await bqResponse.json();
        console.log('[BuatQRIS API Response]', JSON.stringify(bqData));

        if (bqData && (bqData.success || bqData.status === 'success') && bqData.data) {
          const transactionId = String(bqData.data.transaction_id || '');
          const qrUrl = bqData.data.qr_url || bqData.data.qris_image || '';
          const qrisImage = bqData.data.qris_image || qrUrl;
          // Kode unik BENAR-BENAR dari API BuatQRIS
          const uniqueCode = Number(bqData.data.unique_code || 0);
          // Total amount BENAR-BENAR dari API BuatQRIS
          const totalPayment = Number(bqData.data.total_amount || (numericAmount + uniqueCode));

          paymentStatusStore[invoice] = {
            status: 'pending',
            totalPayment,
            transactionId
          };

          const payloadData = {
            invoice,
            transaction_id: transactionId,
            amount: numericAmount,
            fee: 0, // Tanpa fee
            unique_code: uniqueCode, // Dari API
            total_payment: totalPayment, // Dari API
            qr_url: qrUrl, // Foto QRIS langsung dari API
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
          // Bila BuatQRIS API menolak (misal token salah/kuota)
          return res.status(400).json({
            status: false,
            message: bqData?.message || 'Gagal membuat QRIS dari API BuatQRIS. Periksa Account ID & Secret Token.'
          });
        }
      } catch (bqErr: any) {
        console.error('BuatQRIS API Exception:', bqErr);
        return res.status(500).json({
          status: false,
          message: `Gagal memproses ke BuatQRIS API: ${bqErr?.message || 'Network error'}`
        });
      }
    }

    // METODE ALTERNATIF: Bila Admin memasukkan QRIS Statis Toko Asli (DANA Bisnis, BCA, GoPay, Nobu)
    if (staticQr && staticQr.startsWith('000201')) {
      try {
        const uniqueCode = Math.floor(Math.random() * 80) + 11;
        const totalPayment = numericAmount + uniqueCode;

        const apiRes = await fetch(
          `https://api.zyvor.my.id/api/payment/qris-static?qr=${encodeURIComponent(staticQr)}&amount=${totalPayment}`
        );
        const apiData = await apiRes.json();

        if (apiData && apiData.status && apiData.result?.url) {
          paymentStatusStore[invoice] = {
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

    // Bila belum ada kredensial API yang diisi
    return res.status(400).json({
      status: false,
      message: 'Gateway QRIS belum dikonfigurasi. Masukkan Account ID & Secret Token BuatQRIS di Admin Panel > Setting agar QRIS & kode unik dibuat 100% resmi dari API dan bisa di-scan tanpa kendala.'
    });
  } catch (error: any) {
    console.error('Error in /api/create-qris:', error);
    return res.status(500).json({
      status: false,
      message: error?.message || 'Terjadi kesalahan sistem membuat deposit'
    });
  }
});

// 6. Deposit: Check QRIS Payment Status (Otomatis cek ke BuatQRIS API)
app.post('/api/check-qris', async (req: Request, res: Response) => {
  try {
    let { invoice, transactionId, qrUrl } = req.body;

    if (!transactionId && qrUrl) {
      const match = String(qrUrl).match(/\/qris\/([A-Za-z0-9_-]+)/);
      if (match && match[1]) transactionId = match[1].replace('.png', '');
    }

    if (!invoice && !transactionId) {
      return res.status(400).json({ status: false, message: 'Invoice atau Transaction ID diperlukan' });
    }

    const item = paymentStatusStore[invoice];
    if (item && item.status === 'paid') {
      return res.status(200).json({
        status: true,
        payment_status: 'paid',
        message: 'Pembayaran telah berhasil diterima'
      });
    }

    const validTxId = transactionId || item?.transactionId;

    const settings = await getGlobalSettings();
    const accountId = settings.bqAccountId;
    const secretToken = settings.bqSecretToken;

    // Cek ke API BuatQRIS bila ada validTxId
    if (accountId && secretToken && validTxId) {
      try {
        const formData = new URLSearchParams();
        formData.append('action', 'api_check_status');
        formData.append('account_id', accountId.trim());
        formData.append('secret_token', secretToken.trim());
        formData.append('transaction_id', validTxId);

        const bqResponse = await fetch('https://api.buatqris.site', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString()
        });
        const bqData = await bqResponse.json();

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
    console.error('Error checking QRIS status:', error);
    return res.status(500).json({ status: false, message: 'Gagal mengecek status QRIS' });
  }
});

// Test Connection Endpoint for Admin
app.post('/api/test-buatqris', async (req: Request, res: Response) => {
  try {
    const { accountId, secretToken } = req.body;
    if (!accountId || !secretToken) {
      return res.status(400).json({ status: false, message: 'Account ID dan Secret Token diperlukan' });
    }

    const formData = new URLSearchParams();
    formData.append('action', 'api_check_status');
    formData.append('account_id', accountId.trim());
    formData.append('secret_token', secretToken.trim());
    formData.append('transaction_id', '00000000'); // test dummy ping

    const bqResponse = await fetch('https://api.buatqris.site', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });
    const bqData = await bqResponse.json();

    // If message is "Transaksi tidak ditemukan", it means credentials are valid!
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
});

// 7. Webhook / Callback Handler for BuatQRIS
const handleWebhook = async (req: Request, res: Response) => {
  try {
    const payload = { ...req.query, ...req.body };
    console.log('[AZPREM WEBHOOK NOTIFICATION]', JSON.stringify(payload));
    const invoice = payload.invoice || payload.description || payload.order_id || payload.ref_id;
    const event = String(req.headers['x-buatqris-event'] || '').toLowerCase();
    const status = String(payload.status || payload.payment_status || '').toLowerCase();
    const amount = Number(payload.amount || payload.total_amount || payload.total || 0);

    const isPaid = event === 'payment.success' || status === 'paid' || status === 'success' || status === 'settlement' || status === 'berhasil';

    if (invoice && isPaid) {
      paymentStatusStore[invoice] = {
        status: 'paid',
        totalPayment: amount,
        paidAt: new Date().toISOString()
      };
    }

    return res.status(200).json({
      status: true,
      success: true,
      message: 'Callback / Webhook berhasil diproses',
      invoice: invoice || 'NOT_SPECIFIED',
      isPaid,
      amount,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error in Webhook handler:', error);
    return res.status(200).json({ status: true, message: 'Webhook received' });
  }
};

app.post('/api/webhook', handleWebhook);
app.get('/api/webhook', handleWebhook);
app.post('/api/callback', handleWebhook);
app.get('/api/callback', handleWebhook);
app.post('/api/callback-qris', handleWebhook);
app.get('/api/callback-qris', handleWebhook);

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', app: 'AZPREM API Gateway', time: new Date().toISOString() });
});

// Setup Vite or static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true'
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AZPREM server running on port ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
