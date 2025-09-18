import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { createReadStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import mime from 'mime-types';
import { MEDIA_ROOT, THUMBNAILS_ROOT } from '../config.js';

const router = Router();

function sanitizeSegments(raw: string | undefined) {
  if (!raw) {
    return [];
  }
  return raw
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

async function resolveTargetPath(segments: string[]): Promise<string | null> {
  if (segments.length === 0) {
    return null;
  }

  const [rootSegment, ...rest] = segments;
  const isThumbnailRequest = rootSegment === 'thumbnails';
  const base = isThumbnailRequest ? THUMBNAILS_ROOT : MEDIA_ROOT;
  const targetSegments = isThumbnailRequest ? rest : segments;

  if (targetSegments.length === 0) {
    return null;
  }

  const resolvedPath = path.resolve(base, ...targetSegments);
  const relative = path.relative(base, resolvedPath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  try {
    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      return null;
    }
    return resolvedPath;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function handleRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const wildcard = (req.params as { "0"?: string })['0'];
    const segments = sanitizeSegments(wildcard);
    const targetPath = await resolveTargetPath(segments);

    if (!targetPath) {
      res.status(404).end();
      return;
    }

    const contentType = mime.lookup(targetPath) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');

    if (req.method === 'HEAD') {
      res.status(200).end();
      return;
    }

    const stream = createReadStream(targetPath);
    stream.on('error', next);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
}

router.get('/*', handleRequest);
router.head('/*', handleRequest);

export default router;
