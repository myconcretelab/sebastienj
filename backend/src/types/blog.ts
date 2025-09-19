import { z } from 'zod';

export const blogImageSchema = z.object({
  path: z.string(),
  previewPath: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
});

export type BlogImage = z.infer<typeof blogImageSchema>;

export const blogArticleSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  content: z.string(),
  author: z.string(),
  date: z.string(),
  categories: z.array(z.string()),
  images: z.array(z.string()),
  coverImage: blogImageSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  excerpt: z.string().optional()
});

export type BlogArticle = z.infer<typeof blogArticleSchema>;

export const blogSettingsSchema = z
  .object({
    inboundAddress: z.string().email().optional(),
    mailgunSigningKey: z.string().min(1).optional(),
    allowedSenders: z.array(z.string()).default([]),
    listPath: z.string().default('actu'),
    articleBasePath: z.string().default('blog'),
    autoPublish: z.boolean().default(true),
    heroTitle: z.string().optional(),
    heroSubtitle: z.string().optional()
  })
  .transform((value) => ({
    ...value,
    allowedSenders: value.allowedSenders.map((sender) => sender.trim()).filter(Boolean),
    listPath: value.listPath.replace(/^\/+|\/+$/g, '') || 'actu',
    articleBasePath: value.articleBasePath.replace(/^\/+|\/+$/g, '') || 'blog'
  }));

export type BlogSettings = z.infer<typeof blogSettingsSchema>;

export const blogFileSchema = z.object({
  articles: z.array(blogArticleSchema)
});

export type BlogFile = z.infer<typeof blogFileSchema>;
