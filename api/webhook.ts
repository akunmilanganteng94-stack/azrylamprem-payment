import { setCorsHeaders, parseBody, memoryPaymentStore } from './_shared';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = await parseBody(req);
    const payload = { ...(req.query || {}), ...body };
    console.log('[AZPREM WEBHOOK NOTIFICATION]', JSON.stringify(payload));
    const invoice = payload.invoice || payload.description || payload.order_id || payload.ref_id;
    const event = String(req.headers?.['x-buatqris-event'] || '').toLowerCase();
    const status = String(payload.status || payload.payment_status || '').toLowerCase();
    const amount = Number(payload.amount || payload.total_amount || payload.total || 0);

    const isPaid = event === 'payment.success' || status === 'paid' || status === 'success' || status === 'settlement' || status === 'berhasil';

    if (invoice && isPaid) {
      memoryPaymentStore[invoice] = {
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
}
