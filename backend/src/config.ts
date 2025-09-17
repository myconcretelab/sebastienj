import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BACKEND_ROOT = path.resolve(__dirname, '..');
export const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');

export const MEDIA_ROOT = process.env.MEDIA_ROOT || path.join(PROJECT_ROOT, 'medias');
export const METADATA_ROOT = process.env.METADATA_ROOT || path.join(PROJECT_ROOT, 'storage');

export const FOLDER_META_FILE = path.join(METADATA_ROOT, '.dossier-meta.json');
export const MEDIA_META_FILE = path.join(METADATA_ROOT, '.media-meta.json');
export const SETTINGS_FILE = path.join(METADATA_ROOT, 'settings.json');

export const CACHE_TTL = Number(process.env.CACHE_TTL ?? 5_000);

export const PREVIEW_SECRET = process.env.PREVIEW_SECRET || 'preview-secret-change-me';

export const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.avif',
  '.svg',
  '.mp4',
  '.mov',
  '.m4v',
  '.mp3',
  '.wav',
  '.ogg',
  '.pdf'
]);
