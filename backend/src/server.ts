import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import next from 'next';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import type { Server } from 'http';
import apiRouter from './routes/api.js';
import mediaRouter from './routes/media.js';
import authRouter from './routes/auth.js';
import { metadataStore } from './services/MetadataStore.js';
import { blogService } from './services/BlogService.js';
import { staticPageStore } from './services/StaticPageStore.js';
import { thumbnailService } from './services/ThumbnailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const ADMIN_DIST_DIR = path.join(WORKSPACE_ROOT, 'admin', 'dist');
const ADMIN_INDEX_FILE = path.join(ADMIN_DIST_DIR, 'index.html');
const SITE_DIR = path.join(WORKSPACE_ROOT, 'site');

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev, dir: SITE_DIR });
const nextRequestHandler = nextApp.getRequestHandler();

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.use('/api/media', mediaRouter);
app.use('/api/auth', authRouter);
app.use('/api', apiRouter);

if (existsSync(ADMIN_DIST_DIR)) {
  app.use(
    '/admin',
    express.static(ADMIN_DIST_DIR, {
      index: false,
      redirect: false
    })
  );

  if (existsSync(ADMIN_INDEX_FILE)) {
    app.get('/admin*', (_req, res) => {
      res.sendFile(ADMIN_INDEX_FILE);
    });
  } else {
    console.warn(`Admin index not found at ${ADMIN_INDEX_FILE}.`);
  }
} else {
  console.warn(`Admin build directory not found at ${ADMIN_DIST_DIR}.`);
}

app.all('*', (req, res, next) => {
  nextRequestHandler(req, res).catch(next);
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: (err as Error).message || 'Internal server error' });
});

export const startServer = async (): Promise<Server> => {
  await metadataStore.ensureReady();
  await blogService.ensureReady();
  await staticPageStore.ensureReady();
  await thumbnailService.ensureReady();
  await nextApp.prepare();

  return await new Promise<Server>((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`atelier backend listening on port ${port}`);
      resolve(server);
    });

    server.on('error', (error) => {
      reject(error);
    });
  });
};

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((error) => {
    console.error('Failed to start server', error);
    process.exit(1);
  });
}
