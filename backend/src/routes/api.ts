import { Router } from 'express';
import { z } from 'zod';
import { mediaLibrary } from '../services/MediaLibrary.js';
import { metadataStore } from '../services/MetadataStore.js';
import { fileService } from '../services/FileService.js';
import { cacheService } from '../services/CacheService.js';
import { previewService } from '../services/PreviewService.js';

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
