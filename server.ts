import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './src/server/routes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static assets
app.use('/assets', express.static(path.resolve(__dirname, 'public/assets')));
app.use('/icons', express.static(path.resolve(__dirname, 'public/icons')));

// API routes
app.use('/api', apiRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Sanad POS', timestamp: new Date().toISOString() });
});

// Serve Vite built static files
app.use(express.static(path.resolve(__dirname, 'dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
});

// Export for Vercel serverless (DO NOT call app.listen)
export default app;
