import useSWR, { mutate } from 'swr';
import { FolderNode, Orphans, Settings, ThumbnailSummary } from './types.js';

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }
  return response.json();
};

export const useTree = () => useSWR<FolderNode>('/api/tree', fetcher, { suspense: false });
export const useSettings = () => useSWR<Settings>('/api/settings', fetcher);
export const useOrphans = () => useSWR<Orphans>('/api/orphans', fetcher, { refreshInterval: 1000 * 60 });
export const useThumbnails = () => useSWR<ThumbnailSummary>('/api/thumbnails', fetcher);

const postJson = async (url: string, body: unknown, method: string = 'POST') => {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Erreur serveur');
  }
  return response.json();
};

export const api = {
  async refreshTree() {
    await mutate('/api/tree');
  },
  async saveFolderMeta(path: string, metadata: unknown) {
    await postJson('/api/folders/meta', { path, metadata }, 'PUT');
    await mutate('/api/tree');
  },
  async saveFolderDescription(path: string, markdown: string) {
    await postJson('/api/folders/description', { path, markdown }, 'PUT');
    await mutate('/api/tree');
  },
  async saveMediaMeta(path: string, metadata: unknown) {
    await postJson('/api/medias/meta', { path, metadata }, 'PUT');
    await mutate('/api/tree');
  },
  async createFolder(path: string) {
    await postJson('/api/folders', { path });
    await mutate('/api/tree');
  },
  async renameFolder(path: string, name: string) {
    await postJson('/api/folders/rename', { path, name });
    await mutate('/api/tree');
  },
  async deleteFolder(path: string) {
    await postJson('/api/folders', { path }, 'DELETE');
    await mutate('/api/tree');
  },
  async moveMedia(path: string, destination: string) {
    await postJson('/api/medias/move', { path, destination });
    await mutate('/api/tree');
  },
  async renameMedia(path: string, name: string) {
    await postJson('/api/medias/rename', { path, name });
    await mutate('/api/tree');
  },
  async deleteMedia(path: string) {
    await postJson('/api/medias', { path }, 'DELETE');
    await mutate('/api/tree');
  },
  async updateSettings(settings: Settings) {
    await postJson('/api/settings', settings, 'PUT');
    await mutate('/api/settings');
  },
  async updateThumbnails(config: ThumbnailSummary['config']) {
    await postJson('/api/thumbnails', config, 'PUT');
    await mutate('/api/thumbnails');
    await mutate('/api/tree');
  },
  async rebuildThumbnails() {
    await postJson('/api/thumbnails/rebuild', {}, 'POST');
    await mutate('/api/thumbnails');
    await mutate('/api/tree');
  },
  async requestPreview(secret: string, folder?: string, media?: string) {
    return postJson('/api/previews', { secret, folder, media });
  }
};
