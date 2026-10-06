// Universal Master API Gateway for Vercel Serverless & Node.js

const URL_REGEX = /(https?:\/\/|www\.|wa\.me\/|t\.me\/|discord\.gg\/|[a-zA-Z0-9-]+\.(com|id|me|net|org|io|xyz|app|top|biz|info|cc|co))/i;

async function getGlobalSettings() {
  try {
    const fsRes = await fetch(
      'https://firestore.googleapis.com/v1/projects/azrylstore-7f4e2/databases/(default)/documents/settings/global'
    );
    if (fsRes.ok) {
      const fsData: any = await fsRes.json();
      const f = fsData.fields || {};
      return {
        bqAccountId: f.bqAccountId?.stringValue || process.env.BQ_ACCOUNT_ID,
        bqSecretToken: f.bqSecretToken?.stringValue || process.env.BQ_SECRET_TOKEN,
        bqUmkmName: f.bqUmkmName?.stringValue || 'AZPREM STORE',
        staticQrString: f.staticQrString?.stringValue
      };
    }
  } catch {}
  return {
    bqAccountId: process.env.BQ_ACCOUNT_ID,
    bqSecretToken: process.env.BQ_SECRET_TOKEN,
    bqUmkmName: 'AZPREM STORE'
  };
}

export default async function handler(req: any, res: any) {
  // Always set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse body safely
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

  // Bulletproof route identification (Headers, body, query, and URL)
  const rawUrl = req.url || '';
  const detected = String(
    req.headers?.['x-endpoint'] ||
    req.query?.endpoint ||
    req.query?.route ||
    body?.__endpoint ||
    rawUrl.replace(/^\/api\/?/, '').split('?')[0] ||
    ''
  ).toLowerCase();

  // ROUTE 1: AM Send (/api/am/send or /api/am-send)
  if (detected.includes('am/send') || detected.includes('am-send') || detected === 'send') {
    try {
      const { email } = body;
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ status: false, message: 'Email tidak valid' });
      }

      const response = await fetch('https://api.zyvor.my.id/api/am/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AZPREM-App/1.0'
        },
        body: JSON.stringify({ email: email.trim() })
      });

      const data = await response.json().catch(() => ({ status: response.ok, message: response.statusText }));
      return res.status(response.status).json(data);
    } catch (err: any) {
      return res.status(500).json({ status: false, message: err?.message || 'Gagal menghubungi server AM Send' });
    }
  }

  // ROUTE 2: AM Verify (/api/am/verify or /api/am-verify)
  if (detected.includes('am/verify') || detected.includes('am-verify') || detected === 'verify') {
    try {
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

      const data = await response.json().catch(() => ({ status: response.ok, message: response.statusText }));
      return res.status(response.status).json(data);
    } catch (err: any) {
      return res.status(500).json({ status: false, message: err?.message || 'Gagal memverifikasi akun AM' });
    }
  }

  // ROUTE 3: AM Bulk (/api/am/bulk or /api/am-bulk)
  if (detected.includes('am/bulk') || detected.includes('am-bulk') || detected === 'bulk') {
    try {
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

      const data = await response.json().catch(() => ({ status: response.ok, message: response.statusText }));
      return res.status(response.status).json(data);
    } catch (err: any) {
      return res.status(500).json({ status: false, message: err?.message || 'Gagal memproses AM Bulk' });
    }
  }

  // ROUTE 4: Create QRIS (/api/create-qris)
  if (detected.includes('create-qris') || detected === 'create') {
    try {
      const { amount, invoice: clientInvoice } = body;
      const numericAmount = Number(amount);

      if (isNaN(numericAmount) || numericAmount < 1000 || numericAmount > 100000) {
        return res.status(400).json({ status: false, message: 'Nominal deposit harus antara Rp1.000 dan Rp100.000' });
      }

      const invoice = clientInvoice || `AZP-DEP-${Date.now()}`;
      const settings = await getGlobalSettings();
      const accountId = settings.bqAccountId;
      const secretToken = settings.bqSecretToken;
      const umkmName = settings.bqUmkmName || 'AZPREM STORE';

      if (accountId && secretToken) {
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

          return res.status(200).json({ status: true, success: true, data: payloadData, ...payloadData });
        } else {
          return res.status(400).json({ status: false, message: bqData?.message || 'Gagal membuat QRIS' });
        }
      }

      return res.status(400).json({ status: false, message: 'Gateway QRIS belum dikonfigurasi di Admin Panel' });
    } catch (err: any) {
      return res.status(500).json({ status: false, message: err?.message || 'Terjadi kesalahan sistem membuat deposit' });
    }
  }

  // ROUTE 5: Check QRIS Status (/api/check-qris)
  if (detected.includes('check-qris') || detected === 'check') {
    try {
      let { invoice, transactionId, qrUrl } = body;

      // Extract transaction_id from qrUrl if missing
      if (!transactionId && qrUrl) {
        const match = String(qrUrl).match(/\/qris\/([A-Za-z0-9_-]+)/);
        if (match && match[1]) {
          transactionId = match[1].replace('.png', '');
        }
      }

      // If still missing, attempt to fetch deposit doc from Firestore REST
      if (!transactionId && invoice) {
        try {
          const fsDepRes = await fetch(
            `https://firestore.googleapis.com/v1/projects/azrylstore-7f4e2/databases/(default)/documents/deposits/${invoice}`
          );
          if (fsDepRes.ok) {
            const fsDepData: any = await fsDepRes.json();
            const f = fsDepData.fields || {};
            if (f.transactionId?.stringValue) transactionId = f.transactionId.stringValue;
            else if (f.qrUrl?.stringValue) {
              const m = f.qrUrl.stringValue.match(/\/qris\/([A-Za-z0-9_-]+)/);
              if (m && m[1]) transactionId = m[1].replace('.png', '');
            }
          }
        } catch {}
      }

      const settings = await getGlobalSettings();
      const accountId = settings.bqAccountId;
      const secretToken = settings.bqSecretToken;

      if (accountId && secretToken && transactionId) {
        const formData = new URLSearchParams();
        formData.append('action', 'api_check_status');
        formData.append('account_id', accountId.trim());
        formData.append('secret_token', secretToken.trim());
        formData.append('transaction_id', transactionId.trim());

        const bqResponse = await fetch('https://api.buatqris.site', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString()
        });
        const bqData: any = await bqResponse.json();

        const st = String(bqData.status || bqData.data?.status || bqData.payment_status || '').toLowerCase();
        if (st === 'success' || st === 'paid' || st === 'settlement' || st === 'berhasil') {
          return res.status(200).json({ status: true, payment_status: 'paid', transaction_id: transactionId, raw: bqData });
        }
      }

      return res.status(200).json({ status: true, payment_status: 'pending', transaction_id: transactionId || null, message: 'Menunggu pembayaran' });
    } catch (err: any) {
      return res.status(500).json({ status: false, message: err?.message || 'Gagal memeriksa status' });
    }
  }

  // ROUTE 6: Chat Validate (/api/chat/validate)
  if (detected.includes('chat') || detected.includes('validate')) {
    const { text } = body;
    if (text && URL_REGEX.test(text)) {
      return res.status(200).json({
        blocked: true,
        reason: 'Pesan berisi link/URL tidak diperbolehkan.',
        muteMinutes: 30,
        muteUntil: Date.now() + 30 * 60 * 1000
      });
    }
    return res.status(200).json({ blocked: false });
  }

  // ROUTE 7: Test BuatQRIS (/api/test-buatqris)
  if (detected.includes('test-buatqris') || detected === 'test') {
    try {
      const { accountId, secretToken } = body;
      const formData = new URLSearchParams();
      formData.append('action', 'api_check_status');
      formData.append('account_id', (accountId || '').trim());
      formData.append('secret_token', (secretToken || '').trim());
      formData.append('transaction_id', '00000000');

      const bqResponse = await fetch('https://api.buatqris.site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });
      const bqData: any = await bqResponse.json();

      if (bqData && (bqData.success || (bqData.message && bqData.message.toLowerCase().includes('tidak ditemukan')))) {
        return res.status(200).json({ status: true, message: 'Koneksi ke BuatQRIS API Berhasil!' });
      }
      return res.status(200).json({ status: false, message: bqData?.message || 'Gagal validasi BuatQRIS' });
    } catch (err: any) {
      return res.status(500).json({ status: false, message: err?.message || 'Gagal menghubungi server' });
    }
  }

  // ROUTE 8: Webhook / Callback (/api/webhook or /api/callback)
  if (detected.includes('webhook') || detected.includes('callback')) {
    return res.status(200).json({ status: true, message: 'Webhook acknowledged', timestamp: new Date().toISOString() });
  }

  // ROUTE 9: Search Preset AM (/api/am/preset)
  if (detected.includes('preset')) {
    try {
      const rawUrl = (req.query?.url as string) || body?.url;
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
        return res.status(502).json({ ok: false, message: 'Respon dari server preset tidak valid' });
      }

      return res.status(200).json(data);
    } catch (err: any) {
      return res.status(500).json({ ok: false, message: err?.message || 'Gagal mencari preset AM' });
    }
  }

  // DEFAULT ROOT / API HEALTH
  return res.status(200).json({
    status: 'ok',
    app: 'AZPREM Universal API Gateway',
    time: new Date().toISOString()
  });
}
