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

// 5. Deposit: Create QRIS
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
    const accountId = process.env.BQ_ACCOUNT_ID;
    const secretToken = process.env.BQ_SECRET_TOKEN;

    // If real BuatQRIS credentials exist, call BuatQRIS API
    if (accountId && secretToken) {
      try {
        const callbackUrl = process.env.APP_URL 
          ? `${process.env.APP_URL}/api/webhook` 
          : 'https://azprem.vercel.app/api/webhook';

        const formData = new URLSearchParams();
        formData.append('action', 'api_create_qris');
        formData.append('account_id', accountId);
        formData.append('secret_token', secretToken);
        formData.append('amount', String(numericAmount));
        formData.append('description', invoice);
        formData.append('qris_method', 'qris_two');
        formData.append('fee_by', 'customer');
        formData.append('callback_url', callbackUrl);

        const bqResponse = await fetch('https://api.buatqris.site', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData.toString()
        });

        const bqData = await bqResponse.json();
        if (bqData && (bqData.status === 'success' || bqData.qris_content || bqData.qris_url || bqData.qr_url)) {
          const qrUrl = bqData.qr_url || bqData.qris_url || bqData.qr_image || `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(bqData.qris_content || invoice)}`;
          const qrImage = bqData.qris_image || bqData.qr_image || qrUrl;
          const fee = Number(bqData.fee || bqData.admin_fee || 0);
          const uniqueCode = Number(bqData.unique_code || bqData.kode_unik || 0);
          const totalPayment = Number(bqData.total_amount || bqData.total || (numericAmount + fee + uniqueCode));

          const payloadData = {
            invoice,
            amount: numericAmount,
            fee,
            unique_code: uniqueCode,
            total_payment: totalPayment,
            qris_content: bqData.qris_content || bqData.qr_content,
            qr_url: qrUrl,
            qris_url: qrUrl,
            qris_image: qrImage,
            expired_at: bqData.expired_at || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            raw: bqData
          };

          return res.status(200).json({
            status: true,
            success: true,
            data: payloadData,
            ...payloadData
          });
        }
      } catch (bqErr) {
        console.warn('BuatQRIS API call failed, falling back to simulated QRIS gateway:', bqErr);
      }
    }

    // Dynamic standard fallback QRIS for development / demo mode
    const fee = 150;
    const uniqueCode = Math.floor(Math.random() * 80) + 11;
    const totalPayment = numericAmount + fee + uniqueCode;

    const simulatedQrPayload = `00020101021226670014ID.LINKAJA.WWW01189360091438901234560215AZPREM0010303UME51440014ID.CO.QRIS.WWW0215ID10200889912340303UME520459995303360540${String(totalPayment).length}${totalPayment}5802ID5906AZPREM6007JAKARTA62070703A016304`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(simulatedQrPayload)}&color=0f172a&margin=10`;

    const payloadData = {
      invoice,
      amount: numericAmount,
      fee,
      unique_code: uniqueCode,
      total_payment: totalPayment,
      qris_content: simulatedQrPayload,
      qr_url: qrImageUrl,
      qris_url: qrImageUrl,
      qris_image: qrImageUrl,
      expired_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      is_simulated: !Boolean(accountId && secretToken)
    };

    return res.status(200).json({
      status: true,
      success: true,
      data: payloadData,
      ...payloadData
    });
  } catch (error: any) {
    console.error('Error in /api/create-qris:', error);
    return res.status(500).json({
      status: false,
      message: error?.message || 'Gagal membuat QRIS'
    });
  }
});

// 6. Deposit: Check QRIS Payment Status
app.post('/api/check-qris', async (req: Request, res: Response) => {
  try {
    const { invoice } = req.body;
    if (!invoice) {
      return res.status(400).json({ status: false, message: 'Invoice diperlukan' });
    }

    const accountId = process.env.BQ_ACCOUNT_ID;
    const secretToken = process.env.BQ_SECRET_TOKEN;

    if (accountId && secretToken) {
      try {
        const formData = new URLSearchParams();
        formData.append('action', 'api_check_status');
        formData.append('account_id', accountId);
        formData.append('secret_token', secretToken);
        formData.append('invoice', invoice);

        const bqResponse = await fetch('https://api.buatqris.site', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString()
        });
        const bqData = await bqResponse.json();
        return res.status(200).json({
          status: true,
          payment_status: bqData.status === 'paid' || bqData.payment_status === 'paid' ? 'paid' : 'pending',
          raw: bqData
        });
      } catch (err) {
        console.warn('BuatQRIS status check error:', err);
      }
    }

    return res.status(200).json({
      status: true,
      payment_status: 'pending',
      message: 'Menunggu pembayaran'
    });
  } catch (error: any) {
    console.error('Error checking QRIS status:', error);
    return res.status(500).json({ status: false, message: 'Gagal mengecek status QRIS' });
  }
});

// 7. Webhook / Callback Handler for BuatQRIS & Payment Gateway
const handleWebhook = async (req: Request, res: Response) => {
  try {
    const payload = { ...req.query, ...req.body };
    console.log('[AZPREM WEBHOOK NOTIFICATION]', JSON.stringify(payload));

    const invoice = payload.invoice || payload.description || payload.order_id || payload.ref_id;
    const status = String(payload.status || payload.payment_status || '').toLowerCase();
    const amount = Number(payload.amount || payload.total || 0);

    const isPaid = status === 'paid' || status === 'success' || status === 'settlement' || status === 'berhasil';

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
