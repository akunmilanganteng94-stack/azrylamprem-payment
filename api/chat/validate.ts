import { setCorsHeaders, parseBody } from '../_shared';

const URL_REGEX = /(https?:\/\/|www\.|wa\.me\/|t\.me\/|discord\.gg\/|[a-zA-Z0-9-]+\.(com|id|me|net|org|io|xyz|app|top|biz|info|cc|co))/i;

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = await parseBody(req);
    const { text } = body;
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
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
}
