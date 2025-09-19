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
