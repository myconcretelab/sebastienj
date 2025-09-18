import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import apiRouter from './routes/api.js';
import { metadataStore } from './services/MetadataStore.js';
import { thumbnailService } from './services/ThumbnailService.js';

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.use('/api', apiRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: (err as Error).message || 'Internal server error' });
});

export const startServer = async () => {
  await metadataStore.ensureReady();
  await thumbnailService.ensureReady();
  return app.listen(port, () => {
    console.log(`atelier backend listening on port ${port}`);
  });
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
