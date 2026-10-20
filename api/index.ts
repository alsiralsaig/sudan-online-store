import express from 'express';
import { apiRouter } from '../src/server/routes.ts';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount API Router
app.use('/api', apiRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Sanad POS Multi-Tenant SaaS Server', 
    timestamp: new Date().toISOString() 
  });
});

// Vercel serverless function handler
export default async function handler(req, res) {
  return new Promise((resolve) => {
    app(req, res, () => {
      resolve(undefined);
    });
  });
}
