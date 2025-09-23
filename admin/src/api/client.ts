import useSWR, { mutate } from 'swr';
import {
  BlogArticle,
  BlogImageUploadResponse,
  BlogSettings,
  FolderNode,
  Orphans,
  Settings,
  StaticPage,
  ThumbnailSummary
} from './types.js';

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 401) {
      await mutate('/api/auth/session');
      throw new Error('Authentification requise');
    }
    throw new Error(`Erreur ${response.status}`);
  }
  return response.json();
};

export const useTree = () => useSWR<FolderNode>('/api/tree', fetcher, { suspense: false });
export const useSettings = () => useSWR<Settings>('/api/settings', fetcher);
export const useOrphans = () => useSWR<Orphans>('/api/orphans', fetcher, { refreshInterval: 1000 * 60 });
export const useThumbnails = () => useSWR<ThumbnailSummary>('/api/thumbnails', fetcher);
export const useStaticPages = () => useSWR<StaticPage[]>('/api/static-pages', fetcher);
export const useBlogArticles = () => useSWR<BlogArticle[]>('/api/blog/articles', fetcher);
export const useBlogSettings = () => useSWR<BlogSettings>('/api/blog/settings', fetcher);
export const useAdminSession = () =>
  useSWR<{ authenticated: boolean }>('/api/auth/session', fetcher, {
    revalidateOnFocus: true,
    shouldRetryOnError: false
  });

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
    await postJson('/api/orphans/reconcile', {});
    await Promise.all([
      mutate('/api/tree'),
      mutate('/api/orphans')
    ]);
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
  async uploadMedias(path: string, files: File[]) {
    if (!files.length) return { success: true };
    const formData = new FormData();
    formData.append('path', path);
    files.forEach((file) => formData.append('files', file));
    const response = await fetch('/api/medias/upload', {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Erreur lors du téléversement');
    }
    await mutate('/api/tree');
    return response.json();
  },
  async orderMedias(folder: string, order: string[]) {
    await postJson('/api/medias/order', { folder, order });
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
  },
  async refreshStaticPages() {
    await mutate('/api/static-pages');
  },
  async createStaticPage(title?: string) {
    const response = await postJson('/api/static-pages', title ? { title } : {}, 'POST');
    await mutate('/api/static-pages');
    return response as StaticPage;
  },
  async updateStaticPage(id: string, payload: Partial<Pick<StaticPage, 'title' | 'slug' | 'visible' | 'order' | 'sections'>>) {
    const response = await postJson(`/api/static-pages/${id}`, payload, 'PUT');
    await mutate('/api/static-pages');
    return response as StaticPage;
  },
  async deleteStaticPage(id: string) {
    await postJson(`/api/static-pages/${id}`, {}, 'DELETE');
    await mutate('/api/static-pages');
  },
  async createBlogArticle(payload: Partial<Pick<BlogArticle, 'title' | 'content' | 'author' | 'slug' | 'date' | 'categories' | 'images' | 'coverImage' | 'excerpt'>>) {
    const response = await postJson('/api/blog/articles', payload);
    await mutate('/api/blog/articles');
    return response as BlogArticle;
  },
  async updateBlogArticle(slug: string, payload: Partial<Pick<BlogArticle, 'title' | 'content' | 'author' | 'slug' | 'date' | 'categories' | 'images' | 'coverImage' | 'excerpt'>>) {
    const response = await postJson(`/api/blog/articles/${slug}`, payload, 'PUT');
    await mutate('/api/blog/articles');
    return response as BlogArticle;
  },
  async deleteBlogArticle(slug: string) {
    await postJson(`/api/blog/articles/${slug}`, {}, 'DELETE');
    await mutate('/api/blog/articles');
  },
  async uploadBlogImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/blog/images', {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Erreur lors du téléversement');
    }
    const result = (await response.json()) as BlogImageUploadResponse;
    await mutate('/api/blog/articles');
    return result;
  },
  async updateBlogSettings(payload: Partial<BlogSettings>) {
    const response = await postJson('/api/blog/settings', payload, 'PUT');
    await mutate('/api/blog/settings');
    return response as BlogSettings;
  },
  async login(password: string, remember: boolean = false) {
    await postJson('/api/auth/login', { password, remember });
    await mutate('/api/auth/session');
  },
  async logout() {
    await postJson('/api/auth/logout', {}, 'POST');
    await mutate('/api/auth/session');
  },
  async updateAdminPassword(currentPassword: string, newPassword: string) {
    await postJson('/api/auth/password', { currentPassword, newPassword }, 'PUT');
    await mutate('/api/auth/session');
  }
};
