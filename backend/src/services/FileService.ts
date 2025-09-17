import { promises as fs } from 'fs';
import path from 'path';
import { buildAbsoluteMediaPath, parentFolder, toPosix } from '../utils/pathUtils.js';
import { metadataStore } from './MetadataStore.js';

const DESCRIPTION_FILE = 'description.md';

export class FileService {
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
  }

  async deleteMedia(relativePath: string) {
    const absolute = buildAbsoluteMediaPath(relativePath);
    await fs.rm(absolute, { force: true });
    await metadataStore.deleteMediaMeta(relativePath);
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
  }

  async writeFolderDescription(relativePath: string, markdown: string) {
    const absolute = buildAbsoluteMediaPath(relativePath);
    await fs.mkdir(absolute, { recursive: true });
    await fs.writeFile(path.join(absolute, DESCRIPTION_FILE), markdown, 'utf-8');
  }
}

export const fileService = new FileService();
