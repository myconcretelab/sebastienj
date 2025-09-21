import { z } from 'zod';
import { hashPassword } from '../utils/password.js';

const DEFAULT_ADMIN_PASSWORD = 'tellthem';
const { hash: DEFAULT_ADMIN_PASSWORD_HASH, salt: DEFAULT_ADMIN_PASSWORD_SALT } = hashPassword(DEFAULT_ADMIN_PASSWORD);

export const attributeValueSchema = z.union([
  z.object({ type: z.literal('text'), value: z.string() }),
  z.object({ type: z.literal('boolean'), value: z.boolean() }),
  z.object({ type: z.literal('date'), value: z.string() }),
  z.object({ type: z.literal('number'), value: z.number() }),
  z.object({ type: z.literal('link'), value: z.object({ url: z.string().url(), label: z.string().optional() }) }),
  z.object({ type: z.literal('image'), value: z.string() })
]);

export type AttributeValue = z.infer<typeof attributeValueSchema>;

export const folderMetadataSchema = z.object({
  title: z.string().optional(),
  slug: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  icon: z.string().optional(),
  visibility: z.enum(['public', 'private']).default('public'),
  coverMedia: z.string().optional(),
  attributes: z.record(attributeValueSchema).optional(),
  mediaOrder: z.array(z.string()).optional(),
  updatedAt: z.string().optional(),
  createdAt: z.string().optional()
});

export type FolderMetadata = z.infer<typeof folderMetadataSchema>;

export const mediaVariantSchema = z.object({
  format: z.string(),
  path: z.string(),
  size: z.number().optional()
});

export const mediaThumbnailSourceSchema = z.object({
  format: z.string(),
  path: z.string(),
  size: z.number().optional()
});

export const mediaThumbnailSchema = z.object({
  defaultPath: z.string(),
  sources: z.array(mediaThumbnailSourceSchema).default([]),
  width: z.number().optional(),
  height: z.number().optional()
});

export const mediaMetadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  attributes: z.record(attributeValueSchema).optional(),
  variants: z.array(mediaVariantSchema).optional(),
  visibility: z.enum(['public', 'private']).default('public'),
  focalPoint: z.object({ x: z.number(), y: z.number() }).optional(),
  colorPalette: z.array(z.string()).optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  orientation: z.enum(['horizontal', 'vertical', 'square']).optional(),
  thumbnails: z.record(mediaThumbnailSchema).optional(),
  updatedAt: z.string().optional(),
  createdAt: z.string().optional()
});

export type MediaMetadata = z.infer<typeof mediaMetadataSchema>;
export type MediaThumbnail = z.infer<typeof mediaThumbnailSchema>;
export type MediaThumbnailSource = z.infer<typeof mediaThumbnailSourceSchema>;

export type FolderMetadataRecord = Record<string, FolderMetadata>;
export type MediaMetadataRecord = Record<string, MediaMetadata>;

export const attributeTypeSchema = z.object({
  id: z.string(),
  label: z.string(),
  input: z.enum(['text', 'textarea', 'checkbox', 'date', 'number', 'link', 'image', 'select', 'color']),
  options: z.array(z.string()).optional(),
  description: z.string().optional()
});

export const settingsSchema = z.object({
  attributeTypes: z.array(attributeTypeSchema).default([]),
  defaultFolderAttributes: z.record(attributeValueSchema).default({}),
  defaultMediaAttributes: z.record(attributeValueSchema).default({}),
  ui: z
    .object({
      theme: z.string().default('dawn'),
      accentColor: z.string().default('#8c6b4f'),
      paperColor: z.string().default('#f5ede2'),
      texture: z.string().optional(),
      animation: z
        .object({
          duration: z.number().default(240),
          easing: z.string().default('ease-in-out')
        })
        .default({ duration: 240, easing: 'ease-in-out' }),
      lightbox: z
        .object({
          overlayColor: z.string().default('#ffffff'),
          overlayOpacity: z.number().min(0).max(1).default(0.92),
          overlayBlur: z.number().min(0).max(96).default(16),
          backgroundColor: z.string().default('#f8f4ef'),
          borderRadius: z.number().min(0).max(96).default(22),
          maxWidth: z.number().min(240).max(2000).default(980),
          padding: z.number().min(12).max(160).default(32)
        })
        .default({
          overlayColor: '#ffffff',
          overlayOpacity: 0.92,
          overlayBlur: 16,
          backgroundColor: '#f8f4ef',
          borderRadius: 22,
          maxWidth: 980,
          padding: 32
        })
    })
    .default({
      theme: 'dawn',
      accentColor: '#8c6b4f',
      paperColor: '#f5ede2',
      animation: { duration: 240, easing: 'ease-in-out' },
      lightbox: {
        overlayColor: '#ffffff',
        overlayOpacity: 0.92,
        overlayBlur: 16,
        backgroundColor: '#f8f4ef',
        borderRadius: 22,
        maxWidth: 980,
        padding: 32
      }
    }),
  previews: z
    .object({
      enabled: z.boolean().default(true),
      tokenExpirationMinutes: z.number().default(30)
    })
    .default({ enabled: true, tokenExpirationMinutes: 30 }),
  security: z
    .object({
      adminPasswordHash: z.string().nullable().default(DEFAULT_ADMIN_PASSWORD_HASH),
      adminPasswordSalt: z.string().nullable().default(DEFAULT_ADMIN_PASSWORD_SALT),
      passwordUpdatedAt: z.string().optional()
    })
    .default({
      adminPasswordHash: DEFAULT_ADMIN_PASSWORD_HASH,
      adminPasswordSalt: DEFAULT_ADMIN_PASSWORD_SALT
    })
});

export type Settings = z.infer<typeof settingsSchema>;
