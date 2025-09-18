import { z } from 'zod';

export const thumbnailPresetSchema = z
  .object({
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional()
  })
  .refine((value) => value.width !== undefined || value.height !== undefined, {
    message: 'Un format doit définir une largeur ou une hauteur.'
  });

export const thumbnailConfigSchema = z
  .object({
    formats: z.record(thumbnailPresetSchema).default({}),
    format: z.enum(['webp', 'avif', 'both']).default('webp'),
    base: z.enum(['auto', 'width', 'height']).default('auto'),
    quality: z.number().int().min(1).max(100).default(82)
  })
  .passthrough();

export type ThumbnailPreset = z.infer<typeof thumbnailPresetSchema>;
export type ThumbnailConfig = z.infer<typeof thumbnailConfigSchema>;

export type ThumbnailFormat = 'webp' | 'avif';

export const resolveOutputFormats = (config: ThumbnailConfig): ThumbnailFormat[] =>
  config.format === 'both' ? ['webp', 'avif'] : [config.format];
