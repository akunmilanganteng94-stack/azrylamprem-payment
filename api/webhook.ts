// Standalone Vercel Serverless Function for /api/webhook

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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

    const payload = { ...(req.query || {}), ...body };
    const invoice = payload.invoice || payload.description || payload.order_id || payload.ref_id;
    const event = String(req.headers?.['x-buatqris-event'] || '').toLowerCase();
    const status = String(payload.status || payload.payment_status || '').toLowerCase();
    const amount = Number(payload.amount || payload.total_amount || payload.total || 0);

    const isPaid = event === 'payment.success' || status === 'paid' || status === 'success' || status === 'settlement' || status === 'berhasil';

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
    return res.status(200).json({ status: true, message: 'Webhook received' });
  }
}
