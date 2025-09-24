import chokidar from 'chokidar';
import { promises as fs } from 'fs';
import path from 'path';
import sharp, { ResizeOptions } from 'sharp';
import {
  MEDIA_ROOT,
  THUMBNAIL_CONFIG_FILE,
  THUMBNAILS_ROOT
} from '../config.js';
import { metadataStore } from './MetadataStore.js';
import { relativeMediaPath, toPosix } from '../utils/pathUtils.js';
import {
  ThumbnailConfig,
  resolveOutputFormats,
  thumbnailConfigSchema,
  ThumbnailFormat,
  ThumbnailPreset
} from '../types/thumbnails.js';
import { MediaMetadata, MediaThumbnail } from '../types/metadata.js';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif']);
const DEFAULT_CONFIG: ThumbnailConfig = {
  formats: {
    thumb: { width: 320 },
    medium: { width: 800 },
    full: { width: 1200 }
  },
  format: 'webp',
  base: 'auto',
  quality: 82
};

const isHiddenFile = (candidate: string) => path.basename(candidate).startsWith('.');

export interface ThumbnailSummary {
  config: ThumbnailConfig;
  stats: {
    totalFiles: number;
    totalSize: number;
    presets: number;
  };
}

export class ThumbnailService {
  private config: ThumbnailConfig = DEFAULT_CONFIG;
  private watcher?: chokidar.FSWatcher;
  private processing = new Map<string, Promise<void>>();

  async ensureReady() {
    await fs.mkdir(path.dirname(THUMBNAIL_CONFIG_FILE), { recursive: true });
    await fs.mkdir(THUMBNAILS_ROOT, { recursive: true });

    this.config = await this.readConfig();

    if (!this.watcher) {
      this.startWatching();
    }

    await this.syncMissingThumbnails();
  }

  private async readConfig(): Promise<ThumbnailConfig> {
    try {
      const raw = await fs.readFile(THUMBNAIL_CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return thumbnailConfigSchema.parse(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await this.writeConfig(DEFAULT_CONFIG);
        return DEFAULT_CONFIG;
      }
      throw error;
    }
  }

  private async writeConfig(config: ThumbnailConfig) {
    await fs.writeFile(THUMBNAIL_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  }

  private startWatching() {
    this.watcher = chokidar.watch(MEDIA_ROOT, {
      ignoreInitial: false,
      depth: 8,
      awaitWriteFinish: { stabilityThreshold: 750, pollInterval: 120 }
    });

    const queue = async (relative: string, task: () => Promise<void>) => {
      const normalized = toPosix(relative);
      if (this.processing.has(normalized)) return;
      const promise = task()
        .catch((error) => {
          console.error('thumbnail task failed', normalized, error);
        })
        .finally(() => {
          this.processing.delete(normalized);
        });
      this.processing.set(normalized, promise);
    };

    this.watcher.on('add', (file) => {
      if (!this.isImageFile(file)) return;
      const relative = relativeMediaPath(file);
      queue(relative, () => this.generateFor(relative));
    });

    this.watcher.on('change', (file) => {
      if (!this.isImageFile(file)) return;
      const relative = relativeMediaPath(file);
      queue(relative, () => this.generateFor(relative));
    });

    this.watcher.on('unlink', (file) => {
      if (!this.isImageFile(file)) return;
      const relative = relativeMediaPath(file);
      queue(relative, () => this.cleanupFor(relative));
    });
  }

  private async syncMissingThumbnails() {
    const files = await this.collectImageFiles('');
    const { medias } = await metadataStore.readAll();

    for (const file of files) {
      const meta = medias[file];
      if (!meta?.thumbnails) {
        await this.generateFor(file);
      }
    }
  }

  private isImageFile(absolutePath: string) {
    const ext = path.extname(absolutePath).toLowerCase();
    return IMAGE_EXTENSIONS.has(ext);
  }

  async getSummary(): Promise<ThumbnailSummary> {
    const stats = await this.computeStats();
    return {
      config: this.config,
      stats
    };
  }

  async updateConfig(next: ThumbnailConfig) {
    const parsed = thumbnailConfigSchema.parse(next);
    this.config = parsed;
    await this.writeConfig(parsed);
    await this.rebuildAll();
  }

  async rebuildAll() {
    await fs.rm(THUMBNAILS_ROOT, { recursive: true, force: true });
    await fs.mkdir(THUMBNAILS_ROOT, { recursive: true });

    const files = await this.collectImageFiles('');
    for (const file of files) {
      await this.generateFor(file);
    }
  }

  private async collectImageFiles(relative: string): Promise<string[]> {
    const current = relative ? path.join(MEDIA_ROOT, relative) : MEDIA_ROOT;
    const entries = await fs.readdir(current, { withFileTypes: true });
    const result: string[] = [];

    for (const entry of entries) {
      if (isHiddenFile(entry.name)) continue;
      const entryPath = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        result.push(...(await this.collectImageFiles(entryPath)));
      } else if (this.isImageFile(path.join(current, entry.name))) {
        result.push(toPosix(entryPath));
      }
    }

    return result;
  }

  private async computeStats() {
    const stack = [THUMBNAILS_ROOT];
    let totalFiles = 0;
    let totalSize = 0;

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      try {
        const entries = await fs.readdir(current, { withFileTypes: true });
        for (const entry of entries) {
          const absolute = path.join(current, entry.name);
          if (entry.isDirectory()) {
            stack.push(absolute);
          } else {
            totalFiles += 1;
            const { size } = await fs.stat(absolute);
            totalSize += size;
          }
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    }

    return {
      totalFiles,
      totalSize,
      presets: Object.keys(this.config.formats).length
    };
  }

  private buildResizeOptions(preset: ThumbnailPreset, orientation: 'horizontal' | 'vertical' | 'square'): ResizeOptions {
    const options: ResizeOptions = { fit: 'inside', withoutEnlargement: true };

    if (preset.width && preset.height) {
      options.width = preset.width;
      options.height = preset.height;
      options.fit = 'cover';
      return options;
    }

    if (this.config.base === 'width') {
      if (preset.width) options.width = preset.width;
      if (preset.height) options.height = preset.height;
      return options;
    }

    if (this.config.base === 'height') {
      if (preset.height) options.height = preset.height;
      if (preset.width) options.width = preset.width;
      return options;
    }

    // auto behaviour: use width for horizontal, height for vertical, fallback for square
    if (orientation === 'horizontal') {
      if (preset.width) options.width = preset.width;
      if (preset.height) options.height = preset.height;
    } else if (orientation === 'vertical') {
      if (preset.height) options.height = preset.height;
      if (preset.width) options.width = preset.width;
    } else {
      if (preset.width) options.width = preset.width;
      if (preset.height) options.height = preset.height;
    }

    return options;
  }

  private determineOrientation(width?: number, height?: number): 'horizontal' | 'vertical' | 'square' {
    if (!width || !height) return 'horizontal';
    if (Math.abs(width - height) < 8) return 'square';
    return width >= height ? 'horizontal' : 'vertical';
  }

  private async removeExistingThumbnails(relativePath: string) {
    const parsed = path.parse(relativePath);
    const folder = path.join(THUMBNAILS_ROOT, parsed.dir);
    try {
      const entries = await fs.readdir(folder);
      await Promise.all(
        entries
          .filter((name) => name.startsWith(`${parsed.name}_`))
          .map((name) => fs.rm(path.join(folder, name), { force: true }))
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private async generateFor(relativePath: string) {
    try {
      const absolute = path.join(MEDIA_ROOT, relativePath);
      const meta = await sharp(absolute).metadata();
      const width = meta.width;
      const height = meta.height;
      const orientation = this.determineOrientation(width, height);
      const presets = Object.entries(this.config.formats);
      const formats = resolveOutputFormats(this.config);

      await this.removeExistingThumbnails(relativePath);

      const thumbnailEntries: Record<string, MediaThumbnail> = {};

      for (const [presetName, presetConfig] of presets) {
        const resizeOptions = this.buildResizeOptions(presetConfig, orientation);
        if (!resizeOptions.width && !resizeOptions.height) {
          continue;
        }
        const sources: MediaThumbnail['sources'] = [];
        let defaultPath = '';
        let outputWidth: number | undefined;
        let outputHeight: number | undefined;

        for (const format of formats) {
          const info = await this.writeThumbnail(relativePath, presetName, format, resizeOptions);
          const relativeThumbPath = this.buildThumbnailPath(relativePath, presetName, format);
          sources.push({ format, path: relativeThumbPath, size: info.size });
          defaultPath = defaultPath || relativeThumbPath;
          outputWidth = info.width ?? outputWidth;
          outputHeight = info.height ?? outputHeight;
        }

        if (sources.length > 0) {
          thumbnailEntries[presetName] = {
            defaultPath,
            sources,
            width: outputWidth,
            height: outputHeight
          };
        }
      }

      const existing: MediaMetadata =
        (await metadataStore.getMediaMeta(relativePath)) ?? ({ visibility: 'public' } as MediaMetadata);
      const next: MediaMetadata = {
        ...existing,
        visibility: existing.visibility ?? 'public',
        width: width ?? existing.width,
        height: height ?? existing.height,
        orientation,
        thumbnails: Object.keys(thumbnailEntries).length > 0 ? thumbnailEntries : undefined
      };

      await metadataStore.upsertMediaMeta(relativePath, next);
    } catch (error) {
      console.error('Failed to generate thumbnails for', relativePath, error);
    }
  }

  private buildThumbnailPath(relativePath: string, preset: string, format: ThumbnailFormat) {
    const parsed = path.parse(relativePath);
    const fileName = `${parsed.name}_${preset}.${format}`;
    return path.posix.join('/thumbnails', parsed.dir || '', fileName);
  }

  private async writeThumbnail(
    relativePath: string,
    preset: string,
    format: ThumbnailFormat,
    resizeOptions: ResizeOptions
  ) {
    const parsed = path.parse(relativePath);
    const destinationFolder = path.join(THUMBNAILS_ROOT, parsed.dir);
    await fs.mkdir(destinationFolder, { recursive: true });
    const fileName = `${parsed.name}_${preset}.${format}`;
    const destination = path.join(destinationFolder, fileName);

    const pipeline = sharp(path.join(MEDIA_ROOT, relativePath)).rotate().resize(resizeOptions);

    if (format === 'webp') {
      pipeline.webp({ quality: this.config.quality, effort: 4 });
    } else {
      pipeline.avif({ quality: this.config.quality });
    }

    return pipeline.toFile(destination);
  }

  private async cleanupFor(relativePath: string) {
    await this.removeExistingThumbnails(relativePath);
    await metadataStore.deleteMediaMeta(relativePath);
  }
}

export const thumbnailService = new ThumbnailService();
