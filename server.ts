import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // JSON and URL-encoded body parsing
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // CORS headers for API routes
  app.use('/api', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'AZRYLPREM Core API',
      timestamp: new Date().toISOString()
    });
  });

  // Proxy for AM PREM VERIF API
  // Target: POST https://api.zyvor.my.id/api/am/bulkv3 with body: { "count": "1" }
  app.post('/api/proxy/am', async (req: Request, res: Response) => {
    try {
      const { count = 1, endpoint } = req.body;
      const targetUrl = endpoint || 'https://api.zyvor.my.id/api/am/bulkv3';
      const requestPayload = { count: String(count) };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AZRYLPREM-Client/1.0',
          'Accept': 'application/json, text/plain, */*'
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal
      });
      clearTimeout(timeout);

      const textResponse = await response.text();
      let jsonResponse;
      try {
        jsonResponse = JSON.parse(textResponse);
      } catch {
        jsonResponse = { raw: textResponse };
      }

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: jsonResponse.message || jsonResponse.error || 'Gagal memproses order AM Prem ke server penyedia.',
          details: jsonResponse
        });
      }

      return res.json({
        success: true,
        data: jsonResponse
      });
    } catch (err: any) {
      console.error('AM Proxy Error:', err);
      const isTimeout = err.name === 'AbortError';
      return res.status(500).json({
        success: false,
        error: isTimeout ? 'Koneksi ke API AM Prem timeout (server penyedia sibuk).' : (err.message || 'Terjadi kesalahan sistem saat menghubungi server AM Prem.')
      });
    }
  });

  // Proxy for HD FOTO Upscale API
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
  });

  app.post('/api/proxy/hd', upload.single('image'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Foto belum dipilih. Silakan upload file gambar.'
        });
      }

      const scale = req.body.scale || '2';
      const endpoint = req.body.endpoint || 'https://api.zyvor.my.id/api/imagehd/upscalev2';

      const formData = new FormData();
      const fileBlob = new Blob([req.file.buffer as any], { type: req.file.mimetype });
      formData.append('image', fileBlob, req.file.originalname || 'upload.jpg');
      formData.append('scale', String(scale));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000); // 90s for image processing

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'User-Agent': 'AZRYLPREM-Client/1.0'
        },
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeout);

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('image/')) {
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const dataUrl = `data:${contentType};base64,${base64}`;
        return res.json({
          success: true,
          data: {
            resultUrl: dataUrl,
            format: contentType,
            message: 'Foto berhasil di-upscale ke HD'
          }
        });
      }

      const textResponse = await response.text();
      let parsed;
      try {
        parsed = JSON.parse(textResponse);
      } catch {
        parsed = { raw: textResponse };
      }

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: parsed.message || parsed.error || 'Server upscale mengembalikan status gagal.',
          details: parsed
        });
      }

      return res.json({
        success: true,
        data: parsed
      });
    } catch (err: any) {
      console.error('HD Proxy Error:', err);
      const isTimeout = err.name === 'AbortError';
      return res.status(500).json({
        success: false,
        error: isTimeout ? 'Proses HD Foto timeout. Server pengolah gambar sedang sibuk.' : (err.message || 'Gagal memproses gambar.')
      });
    }
  });

  // Test API endpoint for Admin Tools
  app.post('/api/admin/test-endpoint', async (req: Request, res: Response) => {
    try {
      const { url, method = 'GET' } = req.body;
      if (!url) {
        return res.status(400).json({ success: false, error: 'URL endpoint wajib diisi.' });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method,
        headers: { 'User-Agent': 'AZRYLPREM-HealthCheck/1.0' },
        signal: controller.signal
      });
      clearTimeout(timeout);

      return res.json({
        success: true,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type')
      });
    } catch (err: any) {
      return res.json({
        success: false,
        error: err.message
      });
    }
  });

  // Mount Vite or serve static dist
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AZRYLPREM Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start AZRYLPREM server:', err);
  process.exit(1);
});
