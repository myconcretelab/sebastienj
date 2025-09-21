import { promises as fs } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import mime from 'mime-types';
import { MEDIA_ROOT } from '../config.js';
import { MediaMetadata } from '../types/metadata.js';
import { metadataStore } from './MetadataStore.js';
import { toPosix } from '../utils/pathUtils.js';
import { cacheService } from './CacheService.js';

export interface MediaNodeBase {
  name: string;
  path: string;
  title?: string;
  tags?: string[];
  visibility?: 'public' | 'private';
  attributes?: Record<string, unknown>;
  description?: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface FolderNode extends MediaNodeBase {
  type: 'folder';
  children: Array<FolderNode | MediaLeaf>;
  icon?: string;
  coverMedia?: string;
  mediaOrder?: string[];
}

export interface MediaLeaf extends MediaNodeBase {
  type: 'media';
  mimeType: string | false;
  variants?: MediaMetadata['variants'];
  focalPoint?: MediaMetadata['focalPoint'];
  colorPalette?: string[];
  width?: number;
  height?: number;
  orientation?: MediaMetadata['orientation'];
  thumbnails?: MediaMetadata['thumbnails'];
}

export type LibraryTree = FolderNode;

const DESCRIPTION_FILE = 'description.md';

const readDescription = async (absoluteFolder: string) => {
  const file = path.join(absoluteFolder, DESCRIPTION_FILE);
  try {
    const raw = await fs.readFile(file, 'utf-8');
    const parsed = matter(raw);
    return {
      excerpt: parsed.data.excerpt as string | undefined,
      content: parsed.content,
      frontmatter: parsed.data
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
};

const isHiddenFile = (name: string) => name.startsWith('.');

const sortNodes = <T extends MediaNodeBase>(nodes: T[]) =>
  nodes.sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name, 'fr'));

const sortMediasWithOrder = <T extends MediaNodeBase & { path: string }>(medias: T[], order?: string[]) => {
  if (!order || order.length === 0) {
    return sortNodes([...medias]);
  }

  const orderMap = new Map(order.map((path, index) => [path, index]));
  return [...medias].sort((a, b) => {
    const aIndex = orderMap.has(a.path) ? orderMap.get(a.path)! : Number.MAX_SAFE_INTEGER;
    const bIndex = orderMap.has(b.path) ? orderMap.get(b.path)! : Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return (a.title || a.name).localeCompare(b.title || b.name, 'fr');
  });
};

export class MediaLibrary {
  async tree(): Promise<LibraryTree> {
    const cached = cacheService.get<LibraryTree>('tree');
    if (cached) return cached;

    const tree = await this.walkFolder('');
    cacheService.set('tree', tree);
    return tree;
  }

  async walkFolder(relative: string): Promise<FolderNode> {
    const absolute = relative ? path.join(MEDIA_ROOT, relative) : MEDIA_ROOT;
    const entries = await fs.readdir(absolute, { withFileTypes: true });

    const { folders, medias } = await metadataStore.readAll();

    const folderChildren: FolderNode[] = [];
    const mediaChildren: MediaLeaf[] = [];

    for (const entry of entries) {
      if (isHiddenFile(entry.name)) continue;
      const entryPath = relative ? `${relative}/${entry.name}` : entry.name;
      const normalized = toPosix(entryPath);

      if (entry.isDirectory()) {
        const folderMeta = folders[normalized];
        const folderNode = await this.walkFolder(normalized);
        folderNode.title = folderMeta?.title || folderNode.name;
        folderNode.tags = folderMeta?.tags;
        folderNode.visibility = folderMeta?.visibility;
        folderNode.attributes = folderMeta?.attributes;
        folderNode.description = folderMeta?.description;
        folderNode.icon = folderMeta?.icon;
        folderNode.coverMedia = folderMeta?.coverMedia;
        folderNode.updatedAt = folderMeta?.updatedAt;
        folderNode.createdAt = folderMeta?.createdAt;

        folderChildren.push(folderNode);
      } else {
        const meta = medias[normalized];
        const absoluteMediaPath = path.join(MEDIA_ROOT, normalized);
        const stats = await fs.stat(absoluteMediaPath);
        const leaf: MediaLeaf = {
          type: 'media',
          name: entry.name,
          path: normalized,
          title: meta?.title || entry.name,
          tags: meta?.tags,
          visibility: meta?.visibility,
          attributes: meta?.attributes,
          description: meta?.description,
          updatedAt: meta?.updatedAt || stats.mtime.toISOString(),
          createdAt: meta?.createdAt || stats.birthtime.toISOString(),
          mimeType: mime.lookup(entry.name) || false,
          variants: meta?.variants,
          focalPoint: meta?.focalPoint,
          colorPalette: meta?.colorPalette,
          width: meta?.width,
          height: meta?.height,
          orientation: meta?.orientation,
          thumbnails: meta?.thumbnails
        };
        mediaChildren.push(leaf);
      }
    }

    const folderAbsolute = relative ? path.join(MEDIA_ROOT, relative) : MEDIA_ROOT;
    const description = await readDescription(folderAbsolute);
    const folderMeta = folders[toPosix(relative)] || undefined;

    const orderedFolders = sortNodes(folderChildren);
    const orderedMedias = sortMediasWithOrder(mediaChildren, folderMeta?.mediaOrder);
    const children: Array<FolderNode | MediaLeaf> = [...orderedFolders, ...orderedMedias];

    const node: FolderNode = {
      type: 'folder',
      name: relative ? path.basename(relative) : path.basename(MEDIA_ROOT),
      path: toPosix(relative),
      title: folderMeta?.title || (relative ? path.basename(relative) : path.basename(MEDIA_ROOT)),
      children,
      tags: folderMeta?.tags,
      visibility: folderMeta?.visibility,
      attributes: folderMeta?.attributes,
      description: description?.content || folderMeta?.description,
      updatedAt: folderMeta?.updatedAt,
      createdAt: folderMeta?.createdAt,
      icon: folderMeta?.icon,
      coverMedia: folderMeta?.coverMedia,
      mediaOrder: folderMeta?.mediaOrder
    };

    return node;
  }

  async findOrphans() {
    const { folders, medias } = await metadataStore.readAll();
    const existingFolders = new Set<string>();
    const existingMedias = new Set<string>();

    const walk = async (relative: string) => {
      const absolute = relative ? path.join(MEDIA_ROOT, relative) : MEDIA_ROOT;
      const entries = await fs.readdir(absolute, { withFileTypes: true });
      for (const entry of entries) {
        if (isHiddenFile(entry.name)) continue;
        const entryPath = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          const normalized = toPosix(entryPath);
          existingFolders.add(normalized);
          await walk(normalized);
        } else {
          existingMedias.add(toPosix(entryPath));
        }
      }
    };

    await walk('');

    const orphanFoldersMeta = Object.keys(folders).filter((key) => key && !existingFolders.has(key));
    const orphanMediasMeta = Object.keys(medias).filter((key) => !existingMedias.has(key));

    const orphanFoldersFiles: string[] = [];
    const orphanMediasFiles: string[] = [];

    const scan = async (relative: string) => {
      const absolute = relative ? path.join(MEDIA_ROOT, relative) : MEDIA_ROOT;
      const entries = await fs.readdir(absolute, { withFileTypes: true });
      for (const entry of entries) {
        if (isHiddenFile(entry.name)) continue;
        const entryPath = relative ? `${relative}/${entry.name}` : entry.name;
        const normalized = toPosix(entryPath);
        if (entry.isDirectory()) {
          if (!folders[normalized]) {
            orphanFoldersFiles.push(normalized);
          }
          await scan(normalized);
        } else if (!medias[normalized]) {
          orphanMediasFiles.push(normalized);
        }
      }
    };

    await scan('');

    return {
      metadataWithoutFiles: {
        folders: orphanFoldersMeta,
        medias: orphanMediasMeta
      },
      filesWithoutMetadata: {
        folders: orphanFoldersFiles,
        medias: orphanMediasFiles
      }
    };
  }

  async sitemap(baseUrl: string) {
    const tree = await this.tree();
    const urls: string[] = [];

    const traverse = (node: FolderNode) => {
      const slug = node.path ? `/${node.path}` : '';
      urls.push(`${baseUrl}${slug}`);
      for (const child of node.children) {
        if (child.type === 'folder') {
          traverse(child);
        } else {
          urls.push(`${baseUrl}${slug}/${path.parse(child.name).name}`);
        }
      }
    };

    traverse(tree);

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((url) => `  <url><loc>${url}</loc></url>`)
      .join('\n')}\n</urlset>`;
  }
}

export const mediaLibrary = new MediaLibrary();
