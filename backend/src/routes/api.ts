import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { mediaLibrary } from '../services/MediaLibrary.js';
import { metadataStore } from '../services/MetadataStore.js';
import { fileService } from '../services/FileService.js';
import { cacheService } from '../services/CacheService.js';
import { previewService } from '../services/PreviewService.js';
import { staticPageStore } from '../services/StaticPageStore.js';
import { thumbnailService } from '../services/ThumbnailService.js';
import { mediaMetadataSyncService } from '../services/MediaMetadataSyncService.js';
import { requireAuth } from '../middleware/auth.js';
import type { Settings, FolderMetadata } from '../types/metadata.js';
import { thumbnailConfigSchema } from '../types/thumbnails.js';
import { blogService } from '../services/BlogService.js';
import { parentFolder, toPosix } from '../utils/pathUtils.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 10
  }
});

const sanitizeSettings = (settings: Settings): Omit<Settings, 'security'> => {
  const { security: _security, ...rest } = settings;
  return rest;
};

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.post('/blog/email', upload.any(), async (req, res, next) => {
  try {
    const timestamp = req.header('x-mailgun-timestamp') || (req.body?.timestamp as string | undefined);
    const token = req.header('x-mailgun-token') || (req.body?.token as string | undefined);
    const signature = req.header('x-mailgun-signature') || (req.body?.signature as string | undefined);
    const bodyEntries = Object.entries(req.body ?? {}).reduce<Record<string, string | string[]>>((acc, [key, value]) => {
      if (Array.isArray(value)) {
        acc[key] = value.map((item) => (typeof item === 'string' ? item : String(item)));
      } else if (typeof value === 'string') {
        acc[key] = value;
      }
      return acc;
    }, {});
    const attachments = (req.files as Express.Multer.File[]) ?? [];
    const article = await blogService.createArticleFromMailgun({
      timestamp,
      token,
      signature,
      body: bodyEntries,
      attachments
    });
    res.status(201).json(article);
  } catch (error) {
    next(error);
  }
});

router.get('/sitemap', async (req, res, next) => {
  try {
    const baseUrl = (req.query.baseUrl as string) || 'https://example.com';
    const xml = await mediaLibrary.sitemap(baseUrl);
    res.type('application/xml').send(xml);
  } catch (error) {
    next(error);
  }
});

router.use(requireAuth);

router.get('/tree', async (_req, res, next) => {
  try {
    const tree = await mediaLibrary.tree();
    res.json(tree);
  } catch (error) {
    next(error);
  }
});

const folderQuerySchema = z.object({
  path: z.string().default('')
});

router.get('/folders', async (req, res, next) => {
  try {
    const { path } = folderQuerySchema.parse(req.query);
    const node = await mediaLibrary.walkFolder(path);
    res.json(node);
  } catch (error) {
    next(error);
  }
});

const folderMetaSchema = z.object({
  path: z.string(),
  metadata: z.any()
});

const blogImageInputSchema = z.object({
  path: z.string(),
  previewPath: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
});

const blogArticleInputSchema = z.object({
  title: z.string().min(1),
  content: z.string().optional(),
  author: z.string().optional(),
  slug: z.string().optional(),
  date: z.string().optional(),
  categories: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  coverImage: blogImageInputSchema.nullish(),
  excerpt: z.string().optional()
});

const blogArticleUpdateSchema = blogArticleInputSchema.partial();

const blogSettingsInputSchema = z.object({
  inboundAddress: z.string().email().or(z.literal('')).optional(),
  mailgunSigningKey: z.string().min(1).or(z.literal('')).optional(),
  allowedSenders: z.union([z.array(z.string()), z.string()]).optional(),
  listPath: z.string().optional(),
  articleBasePath: z.string().optional(),
  autoPublish: z.boolean().optional(),
  heroTitle: z.string().optional(),
  heroSubtitle: z.string().optional()
});

router.put('/folders/meta', async (req, res, next) => {
  try {
    const { path, metadata } = folderMetaSchema.parse(req.body);
    await metadataStore.upsertFolderMeta(path, metadata);
    cacheService.clear();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/folders/meta', async (req, res, next) => {
  try {
    const { path } = folderMetaSchema.pick({ path: true }).parse(req.body);
    await metadataStore.deleteFolderMeta(path);
    cacheService.clear();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

const descriptionSchema = z.object({
  path: z.string(),
  markdown: z.string().default('')
});

router.put('/folders/description', async (req, res, next) => {
  try {
    const { path, markdown } = descriptionSchema.parse(req.body);
    await fileService.writeFolderDescription(path, markdown);
    cacheService.clear();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

const createFolderSchema = z.object({
  path: z.string()
});

router.post('/folders', async (req, res, next) => {
  try {
    const { path } = createFolderSchema.parse(req.body);
    await fileService.createFolder(path);
    cacheService.clear();
    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
});

const renameFolderSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1)
});

router.post('/folders/rename', async (req, res, next) => {
  try {
    const { path, name } = renameFolderSchema.parse(req.body);
    await fileService.renameFolder(path, name);
    cacheService.clear();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

const nonRootFolderSchema = z.object({
  path: z.string().min(1)
});

router.delete('/folders', async (req, res, next) => {
  try {
    const { path } = nonRootFolderSchema.parse(req.body);
    await fileService.deleteFolder(path);
    cacheService.clear();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

const mediaMetaSchema = z.object({
  path: z.string(),
  metadata: z.any()
});

router.put('/medias/meta', async (req, res, next) => {
  try {
    const { path, metadata } = mediaMetaSchema.parse(req.body);
    await metadataStore.upsertMediaMeta(path, metadata);
    cacheService.clear();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/medias/meta', async (req, res, next) => {
  try {
    const { path } = mediaMetaSchema.pick({ path: true }).parse(req.body);
    await metadataStore.deleteMediaMeta(path);
    cacheService.clear();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

const moveMediaSchema = z.object({
  path: z.string(),
  destination: z.string()
});

router.post('/medias/move', async (req, res, next) => {
  try {
    const { path, destination } = moveMediaSchema.parse(req.body);
    await fileService.moveMedia(path, destination);
    cacheService.clear();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

const renameMediaSchema = z.object({
  path: z.string(),
  name: z.string().min(1)
});

const uploadMediaSchema = z.object({
  path: z.string().optional()
});

const reorderMediaSchema = z.object({
  folder: z.string().optional(),
  order: z.array(z.string())
});

router.post('/medias/rename', async (req, res, next) => {
  try {
    const { path, name } = renameMediaSchema.parse(req.body);
    await fileService.renameMedia(path, name);
    cacheService.clear();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/medias/upload', upload.array('files'), async (req, res, next) => {
  try {
    const { path } = uploadMediaSchema.parse(req.body ?? {});
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) {
      res.status(400).json({ error: 'Aucun fichier fourni.' });
      return;
    }

    const folderPath = path ?? '';
    const saved = await Promise.all(files.map((file) => fileService.saveMedia(folderPath, file)));
    cacheService.clear();
    res.status(201).json({ success: true, medias: saved });
  } catch (error) {
    next(error);
  }
});

router.post('/medias/order', async (req, res, next) => {
  try {
    const { folder, order } = reorderMediaSchema.parse(req.body ?? {});
    const folderPath = folder ?? '';
    const sanitizedOrder = order
      .map((item) => toPosix(item))
      .filter((item) => parentFolder(item) === folderPath);

    const uniqueOrder: string[] = [];
    const seen = new Set<string>();
    for (const item of sanitizedOrder) {
      if (seen.has(item)) continue;
      seen.add(item);
      uniqueOrder.push(item);
    }

    const existingMeta = (await metadataStore.getFolderMeta(folderPath)) ?? undefined;
    const nextMeta = { ...(existingMeta ?? {}) } as FolderMetadata;
    if (uniqueOrder.length === 0) {
      if (nextMeta.mediaOrder) {
        delete nextMeta.mediaOrder;
        await metadataStore.upsertFolderMeta(folderPath, nextMeta);
      }
    } else {
      nextMeta.mediaOrder = uniqueOrder;
      await metadataStore.upsertFolderMeta(folderPath, nextMeta);
    }

    cacheService.clear();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/medias', async (req, res, next) => {
  try {
    const { path } = mediaMetaSchema.pick({ path: true }).parse(req.body);
    await fileService.deleteMedia(path);
    cacheService.clear();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/blog/articles', async (_req, res, next) => {
  try {
    const articles = await blogService.listArticles();
    res.json(articles);
  } catch (error) {
    next(error);
  }
});

router.get('/blog/articles/:slug', async (req, res, next) => {
  try {
    const article = await blogService.getArticle(req.params.slug);
    if (!article) {
      res.status(404).json({ error: 'Article introuvable' });
      return;
    }
    res.json(article);
  } catch (error) {
    next(error);
  }
});

router.post('/blog/articles', async (req, res, next) => {
  try {
    const payload = blogArticleInputSchema.parse(req.body ?? {});
    const article = await blogService.createArticle({
      title: payload.title,
      content: payload.content ?? '',
      author: payload.author ?? '',
      slug: payload.slug,
      date: payload.date,
      categories: payload.categories,
      images: payload.images,
      coverImage: payload.coverImage ?? undefined,
      excerpt: payload.excerpt
    });
    res.status(201).json(article);
  } catch (error) {
    next(error);
  }
});

router.put('/blog/articles/:slug', async (req, res, next) => {
  try {
    const payload = blogArticleUpdateSchema.parse(req.body ?? {});
    const article = await blogService.updateArticle(req.params.slug, {
      title: payload.title,
      content: payload.content,
      author: payload.author,
      slug: payload.slug,
      date: payload.date,
      categories: payload.categories,
      images: payload.images,
      coverImage: payload.coverImage === null ? null : payload.coverImage ?? undefined,
      excerpt: payload.excerpt
    });
    res.json(article);
  } catch (error) {
    next(error);
  }
});

router.delete('/blog/articles/:slug', async (req, res, next) => {
  try {
    await blogService.deleteArticle(req.params.slug);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/blog/images', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Aucun fichier fourni' });
      return;
    }
    const saved = await blogService.uploadImage(req.file);
    res.status(201).json(saved);
  } catch (error) {
    next(error);
  }
});

router.get('/blog/settings', async (_req, res, next) => {
  try {
    const settings = await blogService.getSettings();
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

router.put('/blog/settings', async (req, res, next) => {
  try {
    const payload = blogSettingsInputSchema.parse(req.body ?? {});
    const updates: Partial<Awaited<ReturnType<typeof blogService.getSettings>>> = {};

    if (payload.inboundAddress !== undefined) {
      const trimmed = payload.inboundAddress.trim();
      updates.inboundAddress = trimmed ? trimmed : undefined;
    }

    if (payload.mailgunSigningKey !== undefined) {
      const trimmed = payload.mailgunSigningKey.trim();
      updates.mailgunSigningKey = trimmed ? trimmed : undefined;
    }

    if (payload.allowedSenders !== undefined) {
      const entries = Array.isArray(payload.allowedSenders)
        ? payload.allowedSenders
        : payload.allowedSenders.split(/[,;\n]+/g);
      updates.allowedSenders = entries;
    }

    if (payload.listPath !== undefined) {
      updates.listPath = payload.listPath;
    }

    if (payload.articleBasePath !== undefined) {
      updates.articleBasePath = payload.articleBasePath;
    }

    if (payload.autoPublish !== undefined) {
      updates.autoPublish = payload.autoPublish;
    }

    if (payload.heroTitle !== undefined) {
      updates.heroTitle = payload.heroTitle?.trim();
    }

    if (payload.heroSubtitle !== undefined) {
      updates.heroSubtitle = payload.heroSubtitle?.trim();
    }

    const settings = await blogService.updateSettings(updates);
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

const staticPageSectionSchema = z.object({
  id: z.string().optional(),
  columns: z
    .array(
      z.object({
        id: z.string().optional(),
        span: z.number().int().min(1).max(12).optional(),
        content: z.string().optional()
      })
    )
    .min(1)
});

const staticPagePayloadSchema = z.object({
  title: z.string().optional(),
  slug: z.string().optional(),
  visible: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  sections: z.array(staticPageSectionSchema).optional()
});

router.get('/static-pages', async (_req, res, next) => {
  try {
    const pages = await staticPageStore.list();
    res.json(pages);
  } catch (error) {
    next(error);
  }
});

router.post('/static-pages', async (req, res, next) => {
  try {
    const payload = staticPagePayloadSchema.partial({ order: true }).parse(req.body ?? {});
    const page = await staticPageStore.create(payload);
    res.status(201).json(page);
  } catch (error) {
    next(error);
  }
});

router.put('/static-pages/:id', async (req, res, next) => {
  try {
    const payload = staticPagePayloadSchema.parse(req.body ?? {});
    const page = await staticPageStore.update(req.params.id, payload);
    res.json(page);
  } catch (error) {
    next(error);
  }
});

router.delete('/static-pages/:id', async (req, res, next) => {
  try {
    await staticPageStore.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/orphans', async (_req, res, next) => {
  try {
    const orphans = await mediaLibrary.findOrphans();
    res.json(orphans);
  } catch (error) {
    next(error);
  }
});

router.post('/orphans/reconcile', async (_req, res, next) => {
  try {
    const summary = await mediaMetadataSyncService.reconcile();
    res.json({ success: true, summary });
  } catch (error) {
    next(error);
  }
});

router.get('/settings', async (_req, res, next) => {
  try {
    const settings = await metadataStore.readSettings();
    res.json(sanitizeSettings(settings));
  } catch (error) {
    next(error);
  }
});

router.get('/thumbnails', async (_req, res, next) => {
  try {
    const summary = await thumbnailService.getSummary();
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

router.put('/thumbnails', async (req, res, next) => {
  try {
    const config = thumbnailConfigSchema.parse(req.body);
    await thumbnailService.updateConfig(config);
    cacheService.clear();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/thumbnails/rebuild', async (_req, res, next) => {
  try {
    await thumbnailService.rebuildAll();
    cacheService.clear();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const current = await metadataStore.readSettings();
    const payload = req.body ?? {};
    const nextSettings: Settings = {
      ...current,
      ...payload,
      security: current.security
    };
    await metadataStore.updateSettings(nextSettings);
    cacheService.clear();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

const previewSchema = z.object({
  secret: z.string(),
  folder: z.string().optional(),
  media: z.string().optional()
});

router.post('/previews', async (req, res, next) => {
  try {
    const payload = previewSchema.parse(req.body);
    const token = await previewService.createToken(payload);
    res.json(token);
  } catch (error) {
    next(error);
  }
});

export default router;
