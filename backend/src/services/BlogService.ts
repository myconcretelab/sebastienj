import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID, createHmac } from 'crypto';
import sanitizeHtml from 'sanitize-html';
import sharp from 'sharp';
import { BLOG_ARTICLES_FILE, BLOG_SETTINGS_FILE } from '../config.js';
import {
  BlogArticle,
  BlogSettings,
  blogArticleSchema,
  blogFileSchema,
  blogImageSchema,
  blogSettingsSchema
} from '../types/blog.js';
import { buildAbsoluteMediaPath, relativeMediaPath, toPosix } from '../utils/pathUtils.js';

interface ArticleInput {
  title: string;
  content: string;
  author: string;
  slug?: string;
  date?: string;
  categories?: string[];
  images?: string[];
  coverImage?: BlogArticle['coverImage'];
  excerpt?: string;
}

type ArticleUpdateInput = Partial<Omit<ArticleInput, 'coverImage'>> & {
  coverImage?: BlogArticle['coverImage'] | null;
};

interface SavedImage {
  path: string;
  previewPath?: string;
  width?: number;
  height?: number;
}

interface MailgunPayload {
  timestamp?: string;
  token?: string;
  signature?: string;
  body: Record<string, string | string[]>;
  attachments: Express.Multer.File[];
}

const CATEGORY_REGEX = /#([\p{L}0-9_-]+)/gu;
const HTML_TEXT_REGEX = /<[^>]*>/g;
const DEFAULT_SETTINGS = blogSettingsSchema.parse({});

const ensureDirectory = async (target: string) => {
  await fs.mkdir(path.dirname(target), { recursive: true });
};

const slugify = (value: string, fallback: string = 'article'): string => {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
};

const slugifyCategory = (value: string): string => {
  const normalized = slugify(value, '').replace(/^-+|-+$/g, '');
  return normalized;
};

const escapeHtml = (input: string): string =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const defaultSanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    'a',
    'abbr',
    'b',
    'blockquote',
    'br',
    'code',
    'em',
    'figcaption',
    'figure',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'img',
    'li',
    'ol',
    'p',
    'pre',
    'strong',
    'sub',
    'sup',
    'u',
    'ul'
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'loading', 'data-lightbox'],
    '*': ['style']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' })
  },
  parser: {
    lowerCaseAttributeNames: true
  }
};

export class BlogService {
  private articles?: BlogArticle[];
  private settings?: BlogSettings;

  async ensureReady() {
    await Promise.all([
      ensureDirectory(BLOG_ARTICLES_FILE),
      ensureDirectory(BLOG_SETTINGS_FILE)
    ]);

    try {
      await fs.access(BLOG_ARTICLES_FILE);
    } catch (error) {
      await fs.writeFile(BLOG_ARTICLES_FILE, JSON.stringify({ articles: [] }, null, 2), 'utf-8');
    }

    try {
      await fs.access(BLOG_SETTINGS_FILE);
    } catch (error) {
      await fs.writeFile(BLOG_SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf-8');
    }
  }

  private async readArticlesFile(): Promise<BlogArticle[]> {
    if (!this.articles) {
      await this.ensureReady();
      const raw = await fs.readFile(BLOG_ARTICLES_FILE, 'utf-8');
      const parsed = blogFileSchema.parse(JSON.parse(raw));
      this.articles = parsed.articles.sort((a, b) => (a.date > b.date ? -1 : 1));
    }
    return this.articles.map((article) => ({
      ...article,
      categories: [...article.categories],
      images: [...article.images],
      coverImage: article.coverImage ? { ...article.coverImage } : undefined
    }));
  }

  private async writeArticlesFile(articles: BlogArticle[]) {
    const sanitized = articles
      .map((article) => blogArticleSchema.parse(article))
      .sort((a, b) => (a.date > b.date ? -1 : 1));
    await fs.writeFile(BLOG_ARTICLES_FILE, JSON.stringify({ articles: sanitized }, null, 2), 'utf-8');
    this.articles = sanitized;
  }

  private sanitizeContent(html: string): string {
    return sanitizeHtml(html, defaultSanitizeOptions);
  }

  private normalizeCategories(manual: string[] | undefined, ...sources: string[]): string[] {
    const collected = new Map<string, string>();

    const ingest = (raw: string) => {
      const normalized = slugifyCategory(raw);
      if (!normalized) return;
      if (!collected.has(normalized)) {
        collected.set(normalized, normalized);
      }
    };

    for (const item of manual ?? []) {
      ingest(item.replace(/^#+/, ''));
    }

    for (const source of sources) {
      const matches = source.match(CATEGORY_REGEX) ?? [];
      matches.forEach((match) => ingest(match.slice(1)));
    }

    return Array.from(collected.values());
  }

  private extractPlainText(html: string): string {
    return this.sanitizeContent(html)
      .replace(HTML_TEXT_REGEX, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private computeExcerpt(content: string, fallbackText?: string): string | undefined {
    const plain = (fallbackText || this.extractPlainText(content)).trim();
    if (!plain) return undefined;
    const maxLength = 280;
    return plain.length > maxLength ? `${plain.slice(0, maxLength - 1).trim()}…` : plain;
  }

  private ensureUniqueSlug(base: string, currentId?: string): string {
    const candidateBase = slugify(base);
    let candidate = candidateBase;
    let index = 1;
    const existingArticles = this.articles ?? [];
    const existing = new Set(existingArticles.filter((article) => article.id !== currentId).map((article) => article.slug));
    while (existing.has(candidate)) {
      candidate = `${candidateBase}-${index++}`;
    }
    return candidate;
  }

  private async saveImage(file: Express.Multer.File): Promise<SavedImage | null> {
    if (!file.mimetype.startsWith('image/')) {
      return null;
    }

    const now = new Date();
    const year = `${now.getFullYear()}`;
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const baseFolder = path.posix.join('blog', year, month);
    const absoluteFolder = buildAbsoluteMediaPath(baseFolder);
    await fs.mkdir(absoluteFolder, { recursive: true });

    const extension = path.extname(file.originalname || '').toLowerCase();
    const safeExt = extension && extension.match(/^\.[a-z0-9]+$/) ? extension : '.jpg';
    const baseName = slugify(path.basename(file.originalname || 'image', extension || undefined));
    const uniqueId = randomUUID().slice(0, 8);
    const fileName = `${baseName || 'image'}-${uniqueId}${safeExt}`;
    const absolutePath = path.join(absoluteFolder, fileName);
    await fs.writeFile(absolutePath, file.buffer);

    const relativePath = toPosix(path.posix.join(baseFolder, fileName));

    let previewPath: string | undefined;
    let width: number | undefined;
    let height: number | undefined;

    try {
      const image = sharp(file.buffer);
      const metadata = await image.metadata();
      width = metadata.width ?? undefined;
      height = metadata.height ?? undefined;
      if (metadata.width && metadata.width > 1600) {
        const previewName = `${baseName || 'image'}-${uniqueId}-preview.webp`;
        const previewAbsolute = path.join(absoluteFolder, previewName);
        await image
          .clone()
          .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toFile(previewAbsolute);
        previewPath = toPosix(path.posix.join(baseFolder, previewName));
      }
    } catch (error) {
      console.warn('Impossible de générer l’aperçu pour une image de blog', error);
    }

    return {
      path: relativeMediaPath(absolutePath),
      previewPath,
      width,
      height
    };
  }

  async listArticles(): Promise<BlogArticle[]> {
    return this.readArticlesFile();
  }

  async getArticle(slug: string): Promise<BlogArticle | undefined> {
    const articles = await this.readArticlesFile();
    return articles.find((article) => article.slug === slug);
  }

  async createArticle(input: ArticleInput): Promise<BlogArticle> {
    const articles = await this.readArticlesFile();
    const nowIso = new Date().toISOString();
    const slug = this.ensureUniqueSlug(input.slug ?? input.title, undefined);
    const sanitizedContent = this.sanitizeContent(input.content);
    const plainText = this.extractPlainText(sanitizedContent);
    const categories = this.normalizeCategories(input.categories, sanitizedContent, plainText);
    const images = (input.images ?? []).map((image) => toPosix(image));
    const coverImage = input.coverImage ? blogImageSchema.parse(input.coverImage) : undefined;
    const article: BlogArticle = blogArticleSchema.parse({
      id: randomUUID(),
      slug,
      title: input.title.trim() || 'Article sans titre',
      content: sanitizedContent,
      author: input.author.trim() || 'Anonyme',
      date: input.date ? new Date(input.date).toISOString() : nowIso,
      categories,
      images,
      coverImage,
      createdAt: nowIso,
      updatedAt: nowIso,
      excerpt: input.excerpt ?? this.computeExcerpt(sanitizedContent, plainText)
    });
    await this.writeArticlesFile([article, ...articles]);
    return article;
  }

  async updateArticle(currentSlug: string, input: ArticleUpdateInput): Promise<BlogArticle> {
    const articles = await this.readArticlesFile();
    const index = articles.findIndex((article) => article.slug === currentSlug);
    if (index === -1) {
      throw new Error('Article introuvable');
    }

    const current = articles[index];
    const nextTitle = input.title?.trim() || current.title;
    const nextSlug = this.ensureUniqueSlug(input.slug ?? nextTitle, current.id);
    const rawContent = input.content ?? current.content;
    const sanitizedContent = this.sanitizeContent(rawContent);
    const plainText = this.extractPlainText(sanitizedContent);
    const categories = this.normalizeCategories(input.categories ?? current.categories, sanitizedContent, plainText);
    const images = (input.images ?? current.images).map((image) => toPosix(image));
    const coverImage =
      input.coverImage === null ? undefined : input.coverImage ? blogImageSchema.parse(input.coverImage) : current.coverImage;

    const updated: BlogArticle = blogArticleSchema.parse({
      ...current,
      slug: nextSlug,
      title: nextTitle,
      content: sanitizedContent,
      author: input.author?.trim() || current.author,
      date: input.date ? new Date(input.date).toISOString() : current.date,
      categories,
      images,
      coverImage,
      updatedAt: new Date().toISOString(),
      excerpt: input.excerpt ?? this.computeExcerpt(sanitizedContent, plainText)
    });

    const nextArticles = [...articles];
    nextArticles[index] = updated;
    await this.writeArticlesFile(nextArticles);
    const refreshed = await this.getArticle(updated.slug);
    if (!refreshed) {
      throw new Error('Échec de la mise à jour de l’article');
    }
    return refreshed;
  }

  async deleteArticle(slug: string) {
    const articles = await this.readArticlesFile();
    const filtered = articles.filter((article) => article.slug !== slug);
    if (filtered.length === articles.length) {
      throw new Error('Article introuvable');
    }
    await this.writeArticlesFile(filtered);
  }

  async uploadImage(file: Express.Multer.File): Promise<SavedImage> {
    const saved = await this.saveImage(file);
    if (!saved) {
      throw new Error("Le fichier n'est pas une image supportée");
    }
    return saved;
  }

  async getSettings(): Promise<BlogSettings> {
    if (!this.settings) {
      await this.ensureReady();
      const raw = await fs.readFile(BLOG_SETTINGS_FILE, 'utf-8');
      this.settings = blogSettingsSchema.parse(JSON.parse(raw));
    }
    return this.settings;
  }

  async updateSettings(next: Partial<BlogSettings>): Promise<BlogSettings> {
    const current = await this.getSettings();
    const parsed = blogSettingsSchema.parse({ ...current, ...next });
    await fs.writeFile(BLOG_SETTINGS_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    this.settings = parsed;
    return parsed;
  }

  private isSenderAllowed(sender: string, settings: BlogSettings): boolean {
    if (!settings.allowedSenders || settings.allowedSenders.length === 0) {
      return true;
    }
    const emailMatch = sender.match(/<([^>]+)>/);
    const email = (emailMatch ? emailMatch[1] : sender).trim().toLowerCase();
    return settings.allowedSenders.some((allowed) => allowed.toLowerCase() === email);
  }

  private renderTextAsHtml(text: string): string {
    const paragraphs = text
      .split(/\r?\n\s*\r?\n/g)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
    if (paragraphs.length === 0) {
      return '';
    }
    return paragraphs
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join('\n');
  }

  async createArticleFromMailgun(payload: MailgunPayload): Promise<BlogArticle> {
    const settings = await this.getSettings();
    if (!settings.mailgunSigningKey) {
      throw new Error('Clé de signature Mailgun non configurée');
    }
    const { timestamp, token, signature } = payload;
    if (!timestamp || !token || !signature) {
      throw new Error('Signature Mailgun absente');
    }

    const hmac = createHmac('sha256', settings.mailgunSigningKey);
    const digest = hmac.update(`${timestamp}${token}`).digest('hex');
    if (digest !== signature) {
      throw new Error('Signature Mailgun invalide');
    }

    const body = payload.body;
    const subject = typeof body.subject === 'string' && body.subject.trim() ? body.subject.trim() : 'Article sans titre';
    const sender = (typeof body.from === 'string' && body.from.trim()) || settings.inboundAddress || 'Expéditeur inconnu';

    if (!this.isSenderAllowed(sender, settings)) {
      throw new Error("L'expéditeur n'est pas autorisé à publier");
    }

    const htmlBody =
      (typeof body['stripped-html'] === 'string' && body['stripped-html']) ||
      (typeof body['body-html'] === 'string' && body['body-html']) ||
      '';
    const textBody =
      (typeof body['stripped-text'] === 'string' && body['stripped-text']) ||
      (typeof body['body-plain'] === 'string' && body['body-plain']) ||
      '';

    const savedImages: SavedImage[] = [];
    for (const file of payload.attachments) {
      const saved = await this.saveImage(file);
      if (saved) {
        savedImages.push(saved);
      }
    }

    const imageHtml = savedImages
      .map((image) => `<figure><img src="/api/media/${image.path}" alt="" loading="lazy" data-lightbox="article" /></figure>`)
      .join('\n');

    const combinedHtml = htmlBody ? `${htmlBody}\n${imageHtml}` : `${this.renderTextAsHtml(textBody)}\n${imageHtml}`;

    const article = await this.createArticle({
      title: subject,
      author: sender,
      content: combinedHtml,
      categories: undefined,
      images: savedImages.map((image) => image.path),
      coverImage: savedImages.length > 0 ? blogImageSchema.parse(savedImages[0]) : undefined
    });

    return article;
  }
}

export const blogService = new BlogService();
