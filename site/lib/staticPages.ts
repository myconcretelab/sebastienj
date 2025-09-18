import { promises as fs } from "fs";
import path from "path";

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

const STATIC_PAGES_FILE = path.resolve(process.cwd(), "..", "storage", "pages.json");

const normalizeColumn = (value: any): StaticPageColumn | null => {
  if (!value || typeof value !== "object") return null;
  const id = typeof value.id === "string" ? value.id : "";
  const span = Number.isFinite(value.span) ? Math.min(12, Math.max(1, Math.round(value.span))) : 12;
  const content = typeof value.content === "string" ? value.content : "";
  if (!id) return null;
  return { id, span, content };
};

const normalizeSection = (value: any): StaticPageSection | null => {
  if (!value || typeof value !== "object" || !Array.isArray(value.columns)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const columns = value.columns.map(normalizeColumn).filter(Boolean) as StaticPageColumn[];
  if (!id || columns.length === 0) return null;
  return { id, columns };
};

const normalizePage = (value: any): StaticPage | null => {
  if (!value || typeof value !== "object" || !Array.isArray(value.sections)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const title = typeof value.title === "string" ? value.title : "Page";
  const slug = typeof value.slug === "string" ? value.slug : "page";
  const visible = typeof value.visible === "boolean" ? value.visible : false;
  const order = Number.isFinite(value.order) ? Number(value.order) : 0;
  const sections = value.sections.map(normalizeSection).filter(Boolean) as StaticPageSection[];
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString();
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : createdAt;
  if (!id || sections.length === 0) return null;
  return { id, title, slug, visible, order, sections, createdAt, updatedAt };
};

async function readStaticPagesFile(): Promise<StaticPage[]> {
  try {
    const raw = await fs.readFile(STATIC_PAGES_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.pages)) {
      return [];
    }
    return (parsed.pages as any[])
      .map(normalizePage)
      .filter(Boolean)
      .map((page, index) => ({ ...(page as StaticPage), order: index })) as StaticPage[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function getStaticPages(): Promise<StaticPage[]> {
  const pages = await readStaticPagesFile();
  return pages.sort((a, b) => a.order - b.order);
}

export async function getVisibleStaticPages(): Promise<StaticPage[]> {
  const pages = await getStaticPages();
  return pages.filter((page) => page.visible);
}

export async function getStaticPageBySlug(slug: string): Promise<StaticPage | null> {
  const pages = await getStaticPages();
  return pages.find((page) => page.slug === slug) ?? null;
}
