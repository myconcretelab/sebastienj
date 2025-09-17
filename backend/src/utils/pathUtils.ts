import path from 'path';
import { MEDIA_ROOT } from '../config.js';

export const toPosix = (p: string) => p.split(path.sep).join(path.posix.sep);

export const ensureWithinMedias = (candidate: string) => {
  const resolved = path.resolve(MEDIA_ROOT, candidate);
  if (!resolved.startsWith(path.resolve(MEDIA_ROOT))) {
    throw new Error(`Chemin hors du répertoire médias: ${candidate}`);
  }
  return resolved;
};

export const relativeMediaPath = (absolutePath: string) => {
  const rel = path.relative(MEDIA_ROOT, absolutePath);
  return toPosix(rel);
};

export const buildAbsoluteMediaPath = (relativePath: string) => {
  const sanitized = relativePath.replace(/^\\|^\/+/, '');
  return ensureWithinMedias(sanitized);
};

export const parentFolder = (relativePath: string) => {
  const normalized = relativePath.replace(/\/+$/g, '');
  const parent = path.posix.dirname(normalized);
  return parent === '.' ? '' : parent;
};
