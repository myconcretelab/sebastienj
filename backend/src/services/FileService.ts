import { promises as fs } from 'fs';
import path from 'path';
import { buildAbsoluteMediaPath, parentFolder, toPosix } from '../utils/pathUtils.js';
import { metadataStore } from './MetadataStore.js';
import type { FolderMetadata } from '../types/metadata.js';

const DESCRIPTION_FILE = 'description.md';

export class FileService {
  private async updateFolderMediaOrder(
    folderPath: string,
    mutate: (order: string[]) => string[] | null | undefined
  ): Promise<void> {
    const existingMeta = (await metadataStore.getFolderMeta(folderPath)) ?? undefined;
    const baseMeta = { ...(existingMeta ?? {}) } as FolderMetadata;
    const currentOrder = baseMeta.mediaOrder ? [...baseMeta.mediaOrder] : [];
    const nextOrderRaw = mutate([...currentOrder]);

    if (!nextOrderRaw || nextOrderRaw.length === 0) {
      if (!existingMeta || (!existingMeta.mediaOrder && Object.keys(baseMeta).length === 0)) {
        return;
      }
      if (baseMeta.mediaOrder) {
        delete baseMeta.mediaOrder;
      }
      await metadataStore.upsertFolderMeta(folderPath, baseMeta);
      return;
    }

    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const entry of nextOrderRaw) {
      const normalized = toPosix(entry);
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      deduped.push(normalized);
    }
    baseMeta.mediaOrder = deduped;
    await metadataStore.upsertFolderMeta(folderPath, baseMeta);
  }

  async createFolder(relativePath: string) {
    const absolute = buildAbsoluteMediaPath(relativePath);
    await fs.mkdir(absolute, { recursive: true });
    const parent = parentFolder(relativePath);
    if (parent) {
      const parentMeta = await metadataStore.getFolderMeta(parent);
      if (!parentMeta?.createdAt) {
        await metadataStore.upsertFolderMeta(parent, parentMeta ?? { visibility: 'public' });
      }
    }
  }

  async deleteFolder(relativePath: string) {
    const absolute = buildAbsoluteMediaPath(relativePath);
    await fs.rm(absolute, { recursive: true, force: true });
    await metadataStore.deleteFolderMeta(relativePath);
  }

  async renameFolder(relativePath: string, nextName: string) {
    const absolute = buildAbsoluteMediaPath(relativePath);
    const target = path.join(path.dirname(absolute), nextName);
    await fs.rename(absolute, target);

    const oldKey = toPosix(relativePath);
    const newKey = toPosix(path.posix.join(parentFolder(relativePath), nextName));
    const bundle = await metadataStore.readAll();

    const updatedFolders: typeof bundle.folders = {};
    for (const [key, value] of Object.entries(bundle.folders)) {
      if (key === oldKey || key.startsWith(`${oldKey}/`)) {
        const suffix = key.slice(oldKey.length);
        updatedFolders[`${newKey}${suffix}`] = value;
      } else {
        updatedFolders[key] = value;
      }
    }

    const updatedMedias: typeof bundle.medias = {};
    for (const [key, value] of Object.entries(bundle.medias)) {
      if (key.startsWith(`${oldKey}/`)) {
        const suffix = key.slice(oldKey.length);
        updatedMedias[`${newKey}${suffix}`] = value;
      } else {
        updatedMedias[key] = value;
      }
    }

    await metadataStore.writeBundle({ folders: updatedFolders, medias: updatedMedias });
  }

  async moveMedia(currentPath: string, nextFolder: string) {
    const absoluteSource = buildAbsoluteMediaPath(currentPath);
    const fileName = path.basename(currentPath);
    const destinationFolder = buildAbsoluteMediaPath(nextFolder);
    await fs.mkdir(destinationFolder, { recursive: true });
    const absoluteDestination = path.join(destinationFolder, fileName);
    await fs.rename(absoluteSource, absoluteDestination);

    const newRelative = toPosix(path.posix.join(nextFolder, fileName));

    const meta = await metadataStore.getMediaMeta(currentPath);
    if (meta) {
      await metadataStore.deleteMediaMeta(currentPath);
      await metadataStore.upsertMediaMeta(newRelative, meta);
    }

    const sourceFolder = parentFolder(currentPath);
    await this.updateFolderMediaOrder(sourceFolder, (order) => order.filter((item) => item !== toPosix(currentPath)));
    await this.updateFolderMediaOrder(nextFolder, (order) => {
      const filtered = order.filter((item) => item !== newRelative);
      filtered.push(newRelative);
      return filtered;
    });
  }

  async deleteMedia(relativePath: string) {
    const absolute = buildAbsoluteMediaPath(relativePath);
    await fs.rm(absolute, { force: true });
    await metadataStore.deleteMediaMeta(relativePath);
    const folder = parentFolder(relativePath);
    await this.updateFolderMediaOrder(folder, (order) => order.filter((item) => item !== toPosix(relativePath)));
  }

  async renameMedia(relativePath: string, nextName: string) {
    const absolute = buildAbsoluteMediaPath(relativePath);
    const target = path.join(path.dirname(absolute), nextName);
    await fs.rename(absolute, target);

    const newRelative = toPosix(path.posix.join(parentFolder(relativePath), nextName));

    const meta = await metadataStore.getMediaMeta(relativePath);
    if (meta) {
      await metadataStore.deleteMediaMeta(relativePath);
      await metadataStore.upsertMediaMeta(newRelative, meta);
    }

    const folder = parentFolder(relativePath);
    await this.updateFolderMediaOrder(folder, (order) => {
      const normalizedCurrent = toPosix(relativePath);
      let replaced = false;
      const mapped = order.map((item) => {
        if (item === normalizedCurrent) {
          replaced = true;
          return newRelative;
        }
        return item;
      });
      if (!replaced) {
        mapped.push(newRelative);
      }
      return mapped;
    });
  }

  async writeFolderDescription(relativePath: string, markdown: string) {
    const absolute = buildAbsoluteMediaPath(relativePath);
    await fs.mkdir(absolute, { recursive: true });
    await fs.writeFile(path.join(absolute, DESCRIPTION_FILE), markdown, 'utf-8');
  }

  async saveMedia(folderPath: string, file: Express.Multer.File) {
    const normalizedFolder = folderPath.trim().replace(/^[\\/]+/, '');
    const destinationFolder = buildAbsoluteMediaPath(normalizedFolder);
    await fs.mkdir(destinationFolder, { recursive: true });

    const original = path.basename(file.originalname || 'media');
    const sanitized = original.replace(/\s+/g, '-');
    const parsed = path.parse(sanitized || 'media');
    const baseName = parsed.name || 'media';
    const extension = parsed.ext || '';

    let attempt = 0;
    let candidate = `${baseName}${extension}`;
    let target = path.join(destinationFolder, candidate);

    while (true) {
      try {
        await fs.access(target);
        attempt += 1;
        candidate = `${baseName}-${attempt}${extension}`;
        target = path.join(destinationFolder, candidate);
      } catch {
        break;
      }
    }

    await fs.writeFile(target, file.buffer);
    const relative = toPosix(path.posix.join(normalizedFolder, path.basename(target))); // normalizedFolder peut être vide
    await this.updateFolderMediaOrder(normalizedFolder, (order) => {
      const filtered = order.filter((item) => item !== relative);
      filtered.push(relative);
      return filtered;
    });
    return relative.replace(/^\/+/, '');
  }
}

export const fileService = new FileService();
