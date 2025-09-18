import { Router } from 'express';
import { z } from 'zod';
import { mediaLibrary } from '../services/MediaLibrary.js';
import { metadataStore } from '../services/MetadataStore.js';
import { fileService } from '../services/FileService.js';
import { cacheService } from '../services/CacheService.js';
import { previewService } from '../services/PreviewService.js';
import { staticPageStore } from '../services/StaticPageStore.js';
import { thumbnailService } from '../services/ThumbnailService.js';
import { thumbnailConfigSchema } from '../types/thumbnails.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

router.get('/settings', async (_req, res, next) => {
  try {
    const settings = await metadataStore.readSettings();
    res.json(settings);
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
    await metadataStore.updateSettings(req.body);
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

router.get('/sitemap', async (req, res, next) => {
  try {
    const baseUrl = (req.query.baseUrl as string) || 'https://example.com';
    const xml = await mediaLibrary.sitemap(baseUrl);
    res.type('application/xml').send(xml);
  } catch (error) {
    next(error);
  }
});

export default router;
