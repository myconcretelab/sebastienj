import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { FOLDER_META_FILE, MEDIA_META_FILE, METADATA_ROOT, SETTINGS_FILE } from '../config.js';
import {
  FolderMetadata,
  FolderMetadataRecord,
  MediaMetadata,
  MediaMetadataRecord,
  Settings,
  folderMetadataSchema,
  mediaMetadataSchema,
  settingsSchema
} from '../types/metadata.js';
import { toPosix } from '../utils/pathUtils.js';

interface MetadataBundle {
  folders: FolderMetadataRecord;
  medias: MediaMetadataRecord;
}

const readJsonFile = async <T>(file: string, fallback: T): Promise<T> => {
  try {
    const content = await fs.readFile(file, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify(fallback, null, 2), 'utf-8');
      return fallback;
    }
    throw error;
  }
};

const writeJsonAtomic = async (file: string, data: unknown) => {
  const directory = path.dirname(file);
  await fs.mkdir(directory, { recursive: true });

  const tempFile = path.join(
    directory,
    `${path.basename(file)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`
  );

  const serialized = JSON.stringify(data, null, 2);

  try {
    await fs.writeFile(tempFile, serialized, 'utf-8');
    try {
      await fs.rename(tempFile, file);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EEXIST' || code === 'EPERM') {
        await fs.rm(file, { force: true });
        await fs.rename(tempFile, file);
      } else {
        throw error;
      }
    }
  } catch (error) {
    await fs.rm(tempFile, { force: true }).catch(() => {});
    throw error;
  }
};

export class MetadataStore {
  private folderCache?: FolderMetadataRecord;
  private mediaCache?: MediaMetadataRecord;
  private settingsCache?: Settings;

  async ensureReady() {
    if (!(await this.exists(FOLDER_META_FILE))) {
      await fs.mkdir(METADATA_ROOT, { recursive: true });
      await fs.writeFile(FOLDER_META_FILE, JSON.stringify({}, null, 2), 'utf-8');
    }
    if (!(await this.exists(MEDIA_META_FILE))) {
      await fs.mkdir(path.dirname(MEDIA_META_FILE), { recursive: true });
      await fs.writeFile(MEDIA_META_FILE, JSON.stringify({}, null, 2), 'utf-8');
    }
    if (!(await this.exists(SETTINGS_FILE))) {
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(settingsSchema.parse({}), null, 2), 'utf-8');
    }
  }

  private async exists(file: string) {
    try {
      await fs.access(file);
      return true;
    } catch (error) {
      return false;
    }
  }

  private validateFolderRecord(record: FolderMetadataRecord): FolderMetadataRecord {
    const parsed: FolderMetadataRecord = {};
    for (const [key, value] of Object.entries(record)) {
      parsed[toPosix(key)] = folderMetadataSchema.parse(value);
    }
    return parsed;
  }

  private validateMediaRecord(record: MediaMetadataRecord): MediaMetadataRecord {
    const parsed: MediaMetadataRecord = {};
    for (const [key, value] of Object.entries(record)) {
      parsed[toPosix(key)] = mediaMetadataSchema.parse(value);
    }
    return parsed;
  }

  async readAll(): Promise<MetadataBundle> {
    if (!this.folderCache || !this.mediaCache) {
      const [foldersRaw, mediasRaw] = await Promise.all([
        readJsonFile<FolderMetadataRecord>(FOLDER_META_FILE, {}),
        readJsonFile<MediaMetadataRecord>(MEDIA_META_FILE, {})
      ]);
      this.folderCache = this.validateFolderRecord(foldersRaw);
      this.mediaCache = this.validateMediaRecord(mediasRaw);
    }
    return { folders: this.folderCache, medias: this.mediaCache };
  }

  async getFolderMeta(relativePath: string): Promise<FolderMetadata | undefined> {
    const { folders } = await this.readAll();
    return folders[toPosix(relativePath)];
  }

  async getMediaMeta(relativePath: string): Promise<MediaMetadata | undefined> {
    const { medias } = await this.readAll();
    return medias[toPosix(relativePath)];
  }

  async upsertFolderMeta(
    relativePath: string,
    metadata: Partial<FolderMetadata>,
    options?: { merge?: boolean }
  ) {
    const { folders, medias } = await this.readAll();
    const key = toPosix(relativePath);
    const now = new Date().toISOString();
    const existing = folders[key];
    const merge = options?.merge ?? true;

    const base: Record<string, unknown> = merge && existing ? { ...existing } : {};

    for (const [entryKey, value] of Object.entries(metadata)) {
      if (value === undefined) {
        delete base[entryKey];
      } else {
        base[entryKey] = value;
      }
    }

    const parsed = folderMetadataSchema.parse({
      ...base,
      updatedAt: now,
      createdAt: existing?.createdAt ?? now
    });

    folders[key] = parsed;
    await this.writeBundle({ folders, medias });
  }

  async upsertMediaMeta(relativePath: string, metadata: Partial<MediaMetadata>) {
    const { folders, medias } = await this.readAll();
    const key = toPosix(relativePath);
    const now = new Date().toISOString();
    const existing = medias[key];
    const merged: Partial<MediaMetadata> = {
      ...existing,
      ...metadata,
      updatedAt: now,
      createdAt: existing?.createdAt ?? now
    };
    medias[key] = mediaMetadataSchema.parse(merged);
    await this.writeBundle({ folders, medias });
  }

  async deleteFolderMeta(relativePath: string) {
    const { folders, medias } = await this.readAll();
    const key = toPosix(relativePath);
    delete folders[key];
    const childrenKeys = Object.keys(folders).filter((child) => child.startsWith(`${key}/`));
    childrenKeys.forEach((child) => delete folders[child]);
    const mediaKeys = Object.keys(medias).filter((child) => child.startsWith(`${key}/`));
    mediaKeys.forEach((child) => delete medias[child]);
    await this.writeBundle({ folders, medias });
  }

  async deleteMediaMeta(relativePath: string) {
    const { folders, medias } = await this.readAll();
    const key = toPosix(relativePath);
    delete medias[key];
    await this.writeBundle({ folders, medias });
  }

  async readSettings(): Promise<Settings> {
    if (!this.settingsCache) {
      const raw = await readJsonFile(SETTINGS_FILE, settingsSchema.parse({}));
      this.settingsCache = settingsSchema.parse(raw);
    }
    return this.settingsCache;
  }

  async updateSettings(next: Settings) {
    const parsed = settingsSchema.parse(next);
    await writeJsonAtomic(SETTINGS_FILE, parsed);
    this.settingsCache = parsed;
  }

  async writeBundle(bundle: MetadataBundle) {
    await Promise.all([
      writeJsonAtomic(FOLDER_META_FILE, bundle.folders),
      writeJsonAtomic(MEDIA_META_FILE, bundle.medias)
    ]);
    this.folderCache = bundle.folders;
    this.mediaCache = bundle.medias;
  }

  invalidate() {
    this.folderCache = undefined;
    this.mediaCache = undefined;
    this.settingsCache = undefined;
  }
}

export const metadataStore = new MetadataStore();
