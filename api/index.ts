import { setCorsHeaders } from './_shared';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  return res.status(200).json({
    status: 'ok',
    app: 'AZPREM API Gateway',
    time: new Date().toISOString()
  });
}
