import chokidar from 'chokidar';
import {
  CACHE_TTL,
  FOLDER_META_FILE,
  MEDIA_META_FILE,
  MEDIA_ROOT,
  SETTINGS_FILE,
  THUMBNAIL_CONFIG_FILE
} from '../config.js';
import { metadataStore } from './MetadataStore.js';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class CacheService {
  private store = new Map<string, CacheEntry<unknown>>();
  private watcher: chokidar.FSWatcher;

  constructor() {
    this.watcher = chokidar.watch(
      [MEDIA_ROOT, FOLDER_META_FILE, MEDIA_META_FILE, SETTINGS_FILE, THUMBNAIL_CONFIG_FILE],
      {
        ignoreInitial: true,
        depth: 6
      }
    );

    this.watcher.on('all', () => {
      this.clear();
      metadataStore.invalidate();
    });
  }

  async close() {
    await this.watcher.close();
  }

  set<T>(key: string, value: T, ttl = CACHE_TTL) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl
    });
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  clear() {
    this.store.clear();
  }
}

export const cacheService = new CacheService();
