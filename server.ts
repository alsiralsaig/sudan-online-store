import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './src/server/routes.ts';
import { db } from './src/server/db.ts';
import { isDbEnabled, dbTarget, lastDbError, recordDbError } from './src/server/pg.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Process-level mutex.
 *
 * A single Lambda instance serves concurrent requests on one shared in-memory
 * snapshot: request B's `refresh()` can wipe a row that request A just created
 * before A has flushed it. Row-level diffing fixes cross-instance races, but
 * within one process the read-modify-write cycle must be serialised.
 *
 * Requests are short (~0.3s), so the throughput cost is negligible.
 */
let tail: Promise<void> = Promise.resolve();
const MAX_HOLD_MS = 25_000;

function withInstanceLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn);
  tail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

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
    // Media is stored in its own table and never enters the in-memory
    // snapshot, so it does not need the refresh/flush cycle.
    if (req.path === '/media' || req.path.startsWith('/media/')) {
      return next();
    }

    if (!isDbEnabled()) {
      return next();
    }

    const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);

    if (isMutation) {
      const originalJson = res.json.bind(res);
      let flushed = false;

      res.json = ((body: any) => {
        if (flushed) return originalJson(body);
        flushed = true;

        db.flush({ lock: false })
          .then(() => originalJson(body))
          .catch((err) => {
            // Never report success for a write that did not reach Postgres:
            // the POS keeps unsynced sales in IndexedDB and will retry.
            const message = (err as Error).message;
            console.error('[DB] Flush failed:', message);
            recordDbError(err);

            res.status(/timeout/i.test(message) ? 503 : 500);
            originalJson({
              error: 'DB_WRITE_FAILED',
              message: 'تعذر حفظ البيانات في قاعدة البيانات، يرجى إعادة المحاولة.',
              detail: message,
            });
          });

        return res;
      }) as typeof res.json;
    }

    // The critical section covers refresh → handler → flush → response.
    // Everything inside shares one in-memory snapshot, so it must not overlap
    // with another request in this process.
    withInstanceLock(async () => {
      try {
        await db.init();
        await db.refresh();
      } catch (err) {
        recordDbError(err);
        console.error('[DB] Request bootstrap failed:', (err as Error).message);
      }

      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(guard);
          resolve();
        };

        const guard = setTimeout(finish, MAX_HOLD_MS);
        if (typeof guard.unref === 'function') guard.unref();

        res.on('finish', finish);
        res.on('close', finish);

        next();
      });
    }).catch((err) => {
      console.error('[API] Request failed:', (err as Error).message);
      if (!res.headersSent) next(err);
    });
  });

  // API routes (must come first)
  app.use('/api', apiRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Sanad POS',
      timestamp: new Date().toISOString(),
      database: {
        enabled: isDbEnabled(),
        target: dbTarget(),
        tables: db.tableCount(),
        persisted: db.isPersisting(),
        lastError: lastDbError,
      },
    });
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
