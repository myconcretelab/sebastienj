import { z } from 'zod';

export const staticPageColumnSchema = z.object({
  id: z.string(),
  span: z.number().int().min(1).max(12),
  content: z.string().default('')
});

export type StaticPageColumn = z.infer<typeof staticPageColumnSchema>;

export const staticPageSectionSchema = z.object({
  id: z.string(),
  columns: z.array(staticPageColumnSchema).min(1)
});

export type StaticPageSection = z.infer<typeof staticPageSectionSchema>;

export const staticPageSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  visible: z.boolean(),
  order: z.number().int().nonnegative(),
  sections: z.array(staticPageSectionSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type StaticPage = z.infer<typeof staticPageSchema>;

export const staticPagesFileSchema = z.object({
  pages: z.array(staticPageSchema)
});

export type StaticPagesFile = z.infer<typeof staticPagesFileSchema>;
