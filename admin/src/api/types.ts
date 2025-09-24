export type AttributeValue =
  | { type: 'text'; value: string }
  | { type: 'textarea'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'date'; value: string }
  | { type: 'number'; value: number }
  | { type: 'link'; value: { url: string; label?: string } }
  | { type: 'image'; value: string }
  | { type: 'select'; value: string }
  | { type: 'color'; value: string };

export type FolderNode = {
  type: 'folder';
  name: string;
  path: string;
  title?: string;
  tags?: string[];
  visibility?: 'public' | 'private';
  attributes?: Record<string, AttributeValue>;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  icon?: string;
  coverMedia?: string;
  mediaOrder?: string[];
  mediaPositions?: Record<string, number>;
  children: Array<FolderNode | MediaNode>;
};

export type MediaVariant = {
  format: string;
  path: string;
  size?: number;
};

export type MediaThumbnailSource = {
  format: string;
  path: string;
  size?: number;
};

export type MediaThumbnail = {
  defaultPath: string;
  sources: MediaThumbnailSource[];
  width?: number;
  height?: number;
};

export type MediaNode = {
  type: 'media';
  name: string;
  path: string;
  title?: string;
  tags?: string[];
  visibility?: 'public' | 'private';
  attributes?: Record<string, AttributeValue>;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  mimeType: string | false;
  variants?: MediaVariant[];
  focalPoint?: { x: number; y: number };
  colorPalette?: string[];
  width?: number;
  height?: number;
  orientation?: 'horizontal' | 'vertical' | 'square';
  thumbnails?: Record<string, MediaThumbnail>;
  position?: number;
};

export type Settings = {
  attributeTypes: Array<{
    id: string;
    label: string;
    input:
      | 'text'
      | 'textarea'
      | 'checkbox'
      | 'date'
      | 'number'
      | 'link'
      | 'image'
      | 'select'
      | 'color';
    options?: string[];
    description?: string;
  }>;
  defaultFolderAttributes: Record<string, AttributeValue>;
  defaultMediaAttributes: Record<string, AttributeValue>;
  ui: {
    theme: string;
    accentColor: string;
    paperColor: string;
    texture?: string;
    animation: {
      duration: number;
      easing: string;
    };
    lightbox: {
      overlayColor: string;
      overlayOpacity: number;
      overlayBlur: number;
      backgroundColor: string;
      borderRadius: number;
      maxWidth: number;
      padding: number;
    };
  };
  previews: {
    enabled: boolean;
    tokenExpirationMinutes: number;
  };
};

export type ThumbnailConfig = {
  formats: Record<string, { width?: number; height?: number }>;
  format: 'webp' | 'avif' | 'both';
  base: 'auto' | 'width' | 'height';
  quality: number;
};

export type ThumbnailSummary = {
  config: ThumbnailConfig;
  stats: {
    totalFiles: number;
    totalSize: number;
    presets: number;
  };
};

export type Orphans = {
  metadataWithoutFiles: {
    folders: string[];
    medias: string[];
  };
  filesWithoutMetadata: {
    folders: string[];
    medias: string[];
  };
};

export type StaticPageColumn = {
  id: string;
  span: number;
  content: string;
};

export type StaticPageSection = {
  id: string;
  columns: StaticPageColumn[];
};

export type StaticPage = {
  id: string;
  title: string;
  slug: string;
  visible: boolean;
  order: number;
  sections: StaticPageSection[];
  createdAt: string;
  updatedAt: string;
};

export type BlogImage = {
  path: string;
  previewPath?: string;
  width?: number;
  height?: number;
};

export type BlogArticle = {
  id: string;
  slug: string;
  title: string;
  content: string;
  author: string;
  date: string;
  categories: string[];
  images: string[];
  coverImage?: BlogImage;
  createdAt: string;
  updatedAt: string;
  excerpt?: string;
};

export type BlogSettings = {
  inboundAddress?: string;
  mailgunSigningKey?: string;
  allowedSenders: string[];
  listPath: string;
  articleBasePath: string;
  autoPublish: boolean;
  heroTitle?: string;
  heroSubtitle?: string;
};

export type BlogImageUploadResponse = {
  path: string;
  previewPath?: string;
  width?: number;
  height?: number;
};
