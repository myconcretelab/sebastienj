import { promises as fs } from "fs";
import path from "path";

import type { BlogArticle, BlogImage, BlogSettings } from "@/types/blog";

const BLOG_ROOT = path.resolve(process.cwd(), "..", "storage", "blog");
const ARTICLES_FILE = path.join(BLOG_ROOT, "articles.json");
const SETTINGS_FILE = path.join(BLOG_ROOT, "settings.json");

const DEFAULT_SETTINGS: BlogSettings = {
  allowedSenders: [],
  listPath: "actu",
  articleBasePath: "blog",
  autoPublish: true,
  heroTitle: "Actualités",
  heroSubtitle: undefined,
};

function sanitizePath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/^\/+|\/+$/g, "");
}

function ensureMediaPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("http")) return value;
  return value;
}

function normalizeImage(value: any): BlogImage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const pathValue = typeof value.path === "string" ? value.path : undefined;
  if (!pathValue) return undefined;
  const previewPath = ensureMediaPath(typeof value.previewPath === "string" ? value.previewPath : undefined);
  const width = Number.isFinite(value.width) ? Number(value.width) : undefined;
  const height = Number.isFinite(value.height) ? Number(value.height) : undefined;
  return {
    path: pathValue,
    previewPath,
    width,
    height,
  };
}

function normalizeArticle(value: any): BlogArticle | null {
  if (!value || typeof value !== "object") return null;

  const slug = typeof value.slug === "string" ? value.slug : "";
  const title = typeof value.title === "string" ? value.title : "Article";
  const content = typeof value.content === "string" ? value.content : "";
  const author = typeof value.author === "string" ? value.author : "Anonyme";
  const date = typeof value.date === "string" ? value.date : new Date().toISOString();
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : date;
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : createdAt;
  const categories = Array.isArray(value.categories)
    ? (value.categories as any[]).map((category) => (typeof category === "string" ? category : "")).filter(Boolean)
    : [];
  const images = Array.isArray(value.images)
    ? (value.images as any[]).map((image) => (typeof image === "string" ? image : "")).filter(Boolean)
    : [];
  const coverImage = normalizeImage(value.coverImage);
  const excerpt = typeof value.excerpt === "string" ? value.excerpt : undefined;
  const id = typeof value.id === "string" ? value.id : slug || `${Date.now()}`;

  if (!slug) return null;

  return {
    id,
    slug,
    title,
    content,
    author,
    date,
    categories,
    images,
    coverImage,
    createdAt,
    updatedAt,
    excerpt,
  };
}

function normalizeSettings(value: any): BlogSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_SETTINGS;
  }

  const inboundAddress = typeof value.inboundAddress === "string" && value.inboundAddress.trim().length > 0 ? value.inboundAddress.trim() : undefined;
  const mailgunSigningKey =
    typeof value.mailgunSigningKey === "string" && value.mailgunSigningKey.trim().length > 0 ? value.mailgunSigningKey.trim() : undefined;
  const allowedSenders = Array.isArray(value.allowedSenders)
    ? (value.allowedSenders as any[]).map((sender) => (typeof sender === "string" ? sender.trim() : "")).filter(Boolean)
    : DEFAULT_SETTINGS.allowedSenders;
  const listPathRaw = typeof value.listPath === "string" ? value.listPath : DEFAULT_SETTINGS.listPath;
  const articleBaseRaw = typeof value.articleBasePath === "string" ? value.articleBasePath : DEFAULT_SETTINGS.articleBasePath;
  const listPath = sanitizePath(listPathRaw) || DEFAULT_SETTINGS.listPath;
  const articleBasePath = sanitizePath(articleBaseRaw) || DEFAULT_SETTINGS.articleBasePath;
  const autoPublish = typeof value.autoPublish === "boolean" ? value.autoPublish : DEFAULT_SETTINGS.autoPublish;
  const heroTitle = typeof value.heroTitle === "string" && value.heroTitle.trim().length > 0 ? value.heroTitle.trim() : DEFAULT_SETTINGS.heroTitle;
  const heroSubtitle =
    typeof value.heroSubtitle === "string" && value.heroSubtitle.trim().length > 0 ? value.heroSubtitle.trim() : DEFAULT_SETTINGS.heroSubtitle;

  return {
    inboundAddress,
    mailgunSigningKey,
    allowedSenders,
    listPath,
    articleBasePath,
    autoPublish,
    heroTitle,
    heroSubtitle,
  };
}

async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

export async function getBlogArticles(): Promise<BlogArticle[]> {
  const data = await readJsonFile(ARTICLES_FILE, { articles: [] as unknown as BlogArticle[] });
  const rawArticles = Array.isArray((data as any).articles) ? ((data as any).articles as any[]) : [];
  const articles = rawArticles.map(normalizeArticle).filter((article): article is BlogArticle => Boolean(article));
  return articles.sort((a, b) => (a.date > b.date ? -1 : 1));
}

export async function getBlogArticleBySlug(slug: string): Promise<BlogArticle | null> {
  const articles = await getBlogArticles();
  return articles.find((article) => article.slug === slug) ?? null;
}

export async function getBlogSettings(): Promise<BlogSettings> {
  const data = await readJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS);
  return normalizeSettings(data);
}
