// Shared helper for Vercel Serverless Functions & Express Server

export interface GlobalSettings {
  bqAccountId?: string;
  bqSecretToken?: string;
  bqUmkmName?: string;
  staticQrString?: string;
}

// In-memory payment status cache across invocations (in warm lambdas / server)
export const memoryPaymentStore: Record<string, {
  status: string;
  totalPayment: number;
  transactionId?: string;
  paidAt?: string;
}> = {};

// Helper to fetch global settings from Firestore REST API
export async function getGlobalSettings(): Promise<GlobalSettings> {
  try {
    const res = await fetch(
      'https://firestore.googleapis.com/v1/projects/azrylstore-7f4e2/databases/(default)/documents/settings/global'
    );
    if (res.ok) {
      const json: any = await res.json();
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

// CORS & Response helper for Vercel Serverless Functions
export function setCorsHeaders(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

export function parseBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') {
    return Promise.resolve(req.body);
  }
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}
