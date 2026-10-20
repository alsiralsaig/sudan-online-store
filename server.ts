import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './src/server/routes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
