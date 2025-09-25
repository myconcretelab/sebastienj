import { promises as fs } from 'fs';
import path from 'path';
import { buildAbsoluteMediaPath, parentFolder, toPosix } from '../utils/pathUtils.js';
import { metadataStore } from './MetadataStore.js';
import type { AttributeValue, FolderMetadata, MediaMetadata } from '../types/metadata.js';

const DESCRIPTION_FILE = 'description.md';

export class FileService {
  private normalizeComparablePath(value?: string) {
    if (!value) return undefined;
    return toPosix(value).replace(/^\/+/, '');
  }

  private formatReplacementValue(previous: string, nextRelative: string) {
    if (previous.startsWith('/')) {
      return `/${nextRelative}`;
    }
    return nextRelative;
  }

  private replaceAttributeImageValues(
    attributes: Record<string, AttributeValue> | undefined,
    current: string,
    next: string
  ) {
    if (!attributes) return { changed: false, attributes } as const;
    let changed = false;
    const nextAttributes: Record<string, AttributeValue> = {};

    for (const [key, attribute] of Object.entries(attributes)) {
      if (attribute.type === 'image') {
        const normalized = this.normalizeComparablePath(attribute.value);
        if (normalized === current) {
          nextAttributes[key] = { ...attribute, value: this.formatReplacementValue(attribute.value, next) };
          changed = true;
          continue;
        }
      }
      nextAttributes[key] = attribute;
    }

    if (!changed) {
      return { changed: false, attributes } as const;
    }

    return { changed: true, attributes: nextAttributes } as const;
  }

  private updateMediaSelfMetadata(meta: MediaMetadata, current: string, next: string): MediaMetadata {
    let updated = meta;
    const { changed: attrChanged, attributes } = this.replaceAttributeImageValues(meta.attributes, current, next);
    if (attrChanged) {
      updated = { ...updated, attributes };
    }

    if (updated === meta) {
      return meta;
    }

    return updated;
  }

  private async updateCrossReferences(current: string, next: string) {
    const bundle = await metadataStore.readAll();

    let foldersChanged = false;
    const nextFolders: typeof bundle.folders = { ...bundle.folders };
    for (const [key, folder] of Object.entries(bundle.folders)) {
      let candidate = folder;
      let changed = false;

      if (folder.coverMedia && this.normalizeComparablePath(folder.coverMedia) === current) {
        candidate = { ...candidate, coverMedia: this.formatReplacementValue(folder.coverMedia, next) };
        changed = true;
      }

      const { changed: attrChanged, attributes } = this.replaceAttributeImageValues(folder.attributes, current, next);
      if (attrChanged) {
        candidate = { ...candidate, attributes };
        changed = true;
      }

      if (changed) {
        foldersChanged = true;
        nextFolders[key] = candidate;
      }
    }

    let mediasChanged = false;
    const nextMedias: typeof bundle.medias = { ...bundle.medias };
    if (nextMedias[current]) {
      mediasChanged = true;
      delete nextMedias[current];
    }

    for (const [key, media] of Object.entries(bundle.medias)) {
      if (key === current) continue;
      const { changed: attrChanged, attributes } = this.replaceAttributeImageValues(media.attributes, current, next);
      if (attrChanged) {
        mediasChanged = true;
        nextMedias[key] = { ...media, attributes };
      }
    }

    if (foldersChanged || mediasChanged) {
      await metadataStore.writeBundle({
        folders: foldersChanged ? nextFolders : bundle.folders,
        medias: mediasChanged ? nextMedias : bundle.medias
      });
    }
  }

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
      if ('mediaOrder' in baseMeta) {
        baseMeta.mediaOrder = undefined;
      }
      if ('mediaPositions' in baseMeta) {
        baseMeta.mediaPositions = undefined;
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
    baseMeta.mediaPositions = deduped.reduce<Record<string, number>>((acc, path, index) => {
      acc[path] = index + 1;
      return acc;
    }, {});
    await metadataStore.upsertFolderMeta(folderPath, baseMeta);
  }

  private async updateFolderChildOrder(
    folderPath: string,
    mutate: (order: string[]) => string[] | null | undefined
  ): Promise<void> {
    const normalizedFolder = toPosix(folderPath ?? '').replace(/^\/+/, '');
    const existingMeta = (await metadataStore.getFolderMeta(normalizedFolder)) ?? undefined;
    const baseMeta = { ...(existingMeta ?? {}) } as FolderMetadata;
    const currentOrder = baseMeta.folderOrder ? [...baseMeta.folderOrder] : [];
    const nextOrderRaw = mutate([...currentOrder]);

    if (!nextOrderRaw || nextOrderRaw.length === 0) {
      if (!existingMeta || (!existingMeta.folderOrder && Object.keys(baseMeta).length === 0)) {
        return;
      }
      if ('folderOrder' in baseMeta) {
        baseMeta.folderOrder = undefined;
      }
      if ('folderPositions' in baseMeta) {
        baseMeta.folderPositions = undefined;
      }
      await metadataStore.upsertFolderMeta(normalizedFolder, baseMeta);
      return;
    }

    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const entry of nextOrderRaw) {
      const normalized = toPosix(entry).replace(/^\/+/, '');
      if (!normalized) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      deduped.push(normalized);
    }

    baseMeta.folderOrder = deduped;
    baseMeta.folderPositions = deduped.reduce<Record<string, number>>((acc, path, index) => {
      acc[path] = index + 1;
      return acc;
    }, {});

    await metadataStore.upsertFolderMeta(normalizedFolder, baseMeta);
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
    const normalized = toPosix(relativePath).replace(/^\/+/, '');
    await this.updateFolderChildOrder(parent, (order) => {
      const filtered = order.filter((entry) => entry !== normalized);
      filtered.push(normalized);
      return filtered;
    });
  }

  async deleteFolder(relativePath: string) {
    const absolute = buildAbsoluteMediaPath(relativePath);
    await fs.rm(absolute, { recursive: true, force: true });
    await metadataStore.deleteFolderMeta(relativePath);
    const parent = parentFolder(relativePath);
    const normalized = toPosix(relativePath).replace(/^\/+/, '');
    await this.updateFolderChildOrder(parent, (order) =>
      order.filter((entry) => entry !== normalized)
    );
  }

  async renameFolder(relativePath: string, nextName: string) {
    const absolute = buildAbsoluteMediaPath(relativePath);
    const target = path.join(path.dirname(absolute), nextName);
    await fs.rename(absolute, target);

    const parent = parentFolder(relativePath);
    const oldKey = toPosix(relativePath).replace(/^\/+/, '');
    const newKey = toPosix(path.posix.join(parent, nextName)).replace(/^\/+/, '');
    const bundle = await metadataStore.readAll();

    const remapPath = (value: string) => {
      const normalized = toPosix(value).replace(/^\/+/, '');
      if (normalized === oldKey || normalized.startsWith(`${oldKey}/`)) {
        return `${newKey}${normalized.slice(oldKey.length)}`;
      }
      return normalized;
    };

    const remapFolderMetadata = (meta: FolderMetadata): FolderMetadata => {
      let nextMeta: FolderMetadata = meta;

      const ensureClone = () => {
        if (nextMeta === meta) {
          nextMeta = { ...meta };
        }
      };

      if (meta.folderOrder) {
        const mapped = meta.folderOrder.map(remapPath);
        if (
          mapped.length !== meta.folderOrder.length ||
          mapped.some((entry, index) => entry !== meta.folderOrder![index])
        ) {
          ensureClone();
          nextMeta.folderOrder = mapped;
        }
      }

      if (meta.folderPositions) {
        const mapped: Record<string, number> = {};
        let positionsChanged = false;
        for (const [entry, position] of Object.entries(meta.folderPositions)) {
          const replacement = remapPath(entry);
          mapped[replacement] = position;
          if (replacement !== entry) {
            positionsChanged = true;
          }
        }
        if (positionsChanged) {
          ensureClone();
          nextMeta.folderPositions = mapped;
        }
      }

      if (meta.mediaOrder) {
        const mapped = meta.mediaOrder.map(remapPath);
        if (
          mapped.length !== meta.mediaOrder.length ||
          mapped.some((entry, index) => entry !== meta.mediaOrder![index])
        ) {
          ensureClone();
          nextMeta.mediaOrder = mapped;
        }
      }

      if (meta.mediaPositions) {
        const mapped: Record<string, number> = {};
        let positionsChanged = false;
        for (const [entry, position] of Object.entries(meta.mediaPositions)) {
          const replacement = remapPath(entry);
          mapped[replacement] = position;
          if (replacement !== entry) {
            positionsChanged = true;
          }
        }
        if (positionsChanged) {
          ensureClone();
          nextMeta.mediaPositions = mapped;
        }
      }

      return nextMeta;
    };

    const updatedFolders: typeof bundle.folders = {};
    for (const [key, value] of Object.entries(bundle.folders)) {
      if (key === oldKey || key.startsWith(`${oldKey}/`)) {
        const suffix = key.slice(oldKey.length);
        updatedFolders[`${newKey}${suffix}`] = remapFolderMetadata(value);
      } else {
        updatedFolders[key] = remapFolderMetadata(value);
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

    await this.updateFolderChildOrder(parent, (order) =>
      order.map((entry) => (entry === oldKey ? newKey : entry))
    );
  }

  async orderFolders(parentPath: string, order: string[]) {
    const normalizedParent = toPosix(parentPath ?? '').replace(/^\/+/, '');
    const sanitized = order
      .map((entry) => toPosix(entry).replace(/^\/+/, ''))
      .filter((entry) => parentFolder(entry) === normalizedParent);

    await this.updateFolderChildOrder(normalizedParent, () => sanitized);
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

    const normalizedCurrent = toPosix(relativePath);
    const newRelative = toPosix(path.posix.join(parentFolder(relativePath), nextName));

    const meta = await metadataStore.getMediaMeta(relativePath);
    if (meta) {
      const updatedMeta = this.updateMediaSelfMetadata(meta, normalizedCurrent, newRelative);
      await metadataStore.deleteMediaMeta(relativePath);
      await metadataStore.upsertMediaMeta(newRelative, updatedMeta);
    } else {
      await metadataStore.deleteMediaMeta(relativePath);
    }

    const folder = parentFolder(relativePath);
    await this.updateFolderMediaOrder(folder, (order) => {
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

    await this.updateCrossReferences(normalizedCurrent, newRelative);
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
