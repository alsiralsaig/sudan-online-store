import express from 'express';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import routes dynamically
let apiRouter;
try {
  const routesModule = await import('../dist/server/routes.js');
  apiRouter = routesModule.apiRouter;
} catch (err) {
  console.error('Failed to load routes:', err);
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', error: 'Routes not loaded' });
  });
}

if (apiRouter) {
  app.use('/api', apiRouter);
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Sanad POS', timestamp: new Date().toISOString() });
});

export default app;
