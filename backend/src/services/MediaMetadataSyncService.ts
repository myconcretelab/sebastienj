import chokidar from 'chokidar';
import path from 'path';
import { MEDIA_ROOT } from '../config.js';
import { metadataStore } from './MetadataStore.js';
import { cacheService } from './CacheService.js';
import { mediaLibrary } from './MediaLibrary.js';
import { parentFolder, relativeMediaPath, toPosix } from '../utils/pathUtils.js';
import type { FolderMetadata } from '../types/metadata.js';

const isHidden = (relativePath: string) =>
  relativePath
    .split(path.posix.sep)
    .filter(Boolean)
    .some((segment) => segment.startsWith('.'));

type QueueTask = () => Promise<void>;

export class MediaMetadataSyncService {
  private watcher?: chokidar.FSWatcher;
  private pending = new Map<string, Promise<void>>();
  private reconcilePromise?: Promise<ReconcileSummary>;

  async ensureReady(): Promise<void> {
    if (!this.watcher) {
      this.watcher = chokidar.watch(MEDIA_ROOT, {
        ignoreInitial: true,
        depth: 12,
        awaitWriteFinish: { stabilityThreshold: 750, pollInterval: 120 }
      });

      this.watcher.on('add', (absolute) => {
        const relative = relativeMediaPath(absolute);
        if (!relative || isHidden(relative)) return;
        this.queue(`file:add:${relative}`, () => this.handleFileAdded(relative));
      });

      this.watcher.on('unlink', (absolute) => {
        const relative = relativeMediaPath(absolute);
        if (!relative || isHidden(relative)) return;
        this.queue(`file:unlink:${relative}`, () => this.handleFileRemoved(relative));
      });

      this.watcher.on('addDir', (absolute) => {
        const relative = relativeMediaPath(absolute);
        if (!relative || relative === '' || isHidden(relative)) return;
        this.queue(`dir:add:${relative}`, () => this.handleFolderAdded(relative));
      });

      this.watcher.on('unlinkDir', (absolute) => {
        const relative = relativeMediaPath(absolute);
        if (!relative || relative === '' || isHidden(relative)) return;
        this.queue(`dir:unlink:${relative}`, () => this.handleFolderRemoved(relative));
      });
    }

    await this.reconcile();
  }

  async reconcile(): Promise<ReconcileSummary> {
    if (this.reconcilePromise) {
      return this.reconcilePromise;
    }

    this.reconcilePromise = this.performReconcile().finally(() => {
      this.reconcilePromise = undefined;
    });

    return this.reconcilePromise;
  }

  private async performReconcile(): Promise<ReconcileSummary> {
    const summary: ReconcileSummary = {
      removedFolderMetadata: 0,
      removedMediaMetadata: 0,
      createdFolderMetadata: 0,
      createdMediaMetadata: 0,
      updatedFolderOrders: 0
    };

    const orphans = await mediaLibrary.findOrphans();

    for (const folder of orphans.metadataWithoutFiles.folders) {
      if (!folder || isHidden(folder)) continue;
      await metadataStore.deleteFolderMeta(folder);
      summary.removedFolderMetadata += 1;
    }

    for (const media of orphans.metadataWithoutFiles.medias) {
      if (!media || isHidden(media)) continue;
      await metadataStore.deleteMediaMeta(media);
      const parent = parentFolder(media);
      if (await this.removeFromFolderOrder(parent, media)) {
        summary.updatedFolderOrders += 1;
      }
      summary.removedMediaMetadata += 1;
    }

    for (const folder of orphans.filesWithoutMetadata.folders) {
      if (!folder || isHidden(folder)) continue;
      const normalized = toPosix(folder);
      const meta = await metadataStore.getFolderMeta(normalized);
      if (!meta) {
        await metadataStore.upsertFolderMeta(normalized, { visibility: 'public' });
        summary.createdFolderMetadata += 1;
      }
    }

    for (const media of orphans.filesWithoutMetadata.medias) {
      if (!media || isHidden(media)) continue;
      const normalized = toPosix(media);
      const meta = await metadataStore.getMediaMeta(normalized);
      if (!meta) {
        await metadataStore.upsertMediaMeta(normalized, { visibility: 'public' });
        summary.createdMediaMetadata += 1;
      }
      const parent = parentFolder(normalized);
      if (await this.ensureFolderOrderContains(parent, normalized)) {
        summary.updatedFolderOrders += 1;
      }
    }

    if (
      summary.removedFolderMetadata > 0 ||
      summary.removedMediaMetadata > 0 ||
      summary.createdFolderMetadata > 0 ||
      summary.createdMediaMetadata > 0 ||
      summary.updatedFolderOrders > 0
    ) {
      cacheService.clear();
    }

    return summary;
  }

  private queue(key: string, task: QueueTask) {
    if (this.pending.has(key)) {
      return;
    }

    const promise = task()
      .catch((error) => {
        console.error('metadata sync task failed', key, error);
      })
      .finally(() => {
        this.pending.delete(key);
      });

    this.pending.set(key, promise);
  }

  private async handleFileAdded(relative: string) {
    const normalized = toPosix(relative);
    const existing = await metadataStore.getMediaMeta(normalized);
    if (!existing) {
      await metadataStore.upsertMediaMeta(normalized, { visibility: 'public' });
    }
    const parent = parentFolder(normalized);
    await this.ensureFolderOrderContains(parent, normalized);
  }

  private async handleFileRemoved(relative: string) {
    const normalized = toPosix(relative);
    await metadataStore.deleteMediaMeta(normalized);
    const parent = parentFolder(normalized);
    await this.removeFromFolderOrder(parent, normalized);
  }

  private async handleFolderAdded(relative: string) {
    const normalized = toPosix(relative.replace(/\/+$/u, ''));
    if (!normalized) return;
    const existing = await metadataStore.getFolderMeta(normalized);
    if (!existing) {
      await metadataStore.upsertFolderMeta(normalized, { visibility: 'public' });
    }
  }

  private async handleFolderRemoved(relative: string) {
    const normalized = toPosix(relative.replace(/\/+$/u, ''));
    if (!normalized) return;
    await metadataStore.deleteFolderMeta(normalized);
  }

  private async ensureFolderOrderContains(folderPath: string, mediaPath: string): Promise<boolean> {
    const normalizedFolder = toPosix(folderPath ?? '');
    const meta = await metadataStore.getFolderMeta(normalizedFolder);
    if (!meta) {
      return false;
    }

    const order = meta.mediaOrder ?? [];
    if (order.includes(mediaPath)) {
      return false;
    }

    const nextOrder = order.filter((entry) => entry !== mediaPath);
    nextOrder.push(mediaPath);

    const nextMeta: FolderMetadata = {
      ...meta,
      mediaOrder: nextOrder,
      mediaPositions: nextOrder.reduce<Record<string, number>>((acc, path, index) => {
        acc[path] = index + 1;
        return acc;
      }, {})
    };
    await metadataStore.upsertFolderMeta(normalizedFolder, nextMeta);
    return true;
  }

  private async removeFromFolderOrder(folderPath: string, mediaPath: string): Promise<boolean> {
    const normalizedFolder = toPosix(folderPath ?? '');
    const meta = await metadataStore.getFolderMeta(normalizedFolder);
    if (!meta?.mediaOrder || !meta.mediaOrder.includes(mediaPath)) {
      return false;
    }

    const nextOrder = meta.mediaOrder.filter((entry) => entry !== mediaPath);
    const nextMeta: FolderMetadata = { ...meta };

    if (nextOrder.length > 0) {
      nextMeta.mediaOrder = nextOrder;
      nextMeta.mediaPositions = nextOrder.reduce<Record<string, number>>((acc, path, index) => {
        acc[path] = index + 1;
        return acc;
      }, {});
    } else {
      nextMeta.mediaOrder = undefined;
      nextMeta.mediaPositions = undefined;
    }

    await metadataStore.upsertFolderMeta(normalizedFolder, nextMeta);
    return true;
  }
}

export type ReconcileSummary = {
  removedFolderMetadata: number;
  removedMediaMetadata: number;
  createdFolderMetadata: number;
  createdMediaMetadata: number;
  updatedFolderOrders: number;
};

export const mediaMetadataSyncService = new MediaMetadataSyncService();
