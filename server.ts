import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './src/server/routes.ts';
import { db } from './src/server/db.ts';
import { isDbEnabled } from './src/server/pg.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  /* ------------------------------------------------------------------ */
  /*  Database lifecycle middleware                                      */
  /*                                                                     */
  /*  Each request starts from a fresh snapshot, and any mutation is      */
  /*  written back *before* the response is sent — on Vercel a lambda     */
  /*  can be frozen the moment the response leaves, so flushing after     */
  /*  the response would silently lose data.                             */
  /* ------------------------------------------------------------------ */
  app.use('/api', async (req, res, next) => {
    if (!isDbEnabled()) {
      return next();
    }

    const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);

    try {
      await db.init();
      await db.refresh();
    } catch (err) {
      console.error('[DB] Request bootstrap failed:', (err as Error).message);
      // Keep serving from the in-memory snapshot rather than returning 500.
      return next();
    }

    if (isMutation) {
      const originalJson = res.json.bind(res);
      let flushed = false;

      res.json = ((body: any) => {
        if (flushed) return originalJson(body);
        flushed = true;

        db.flush()
          .catch((err) => console.error('[DB] Flush failed:', (err as Error).message))
          .finally(() => originalJson(body));

        return res;
      }) as typeof res.json;
    }

    next();
  });

  // API routes (must come first)
  app.use('/api', apiRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Sanad POS', timestamp: new Date().toISOString() });
  });

  // Static assets from public/
  app.use('/assets', express.static(path.resolve(__dirname, 'public/assets')));
  app.use('/icons', express.static(path.resolve(__dirname, 'public/icons')));

  // Serve Vite built static files
  app.use(express.static(path.resolve(__dirname, 'dist')));

  // SPA fallback - everything else returns index.html
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });

  return app;
}

// Vercel serverless export
export default async function handler(req: any, res: any) {
  const app = createApp();
  return new Promise<void>((resolve) => {
    app(req, res, () => resolve());
  });
}
