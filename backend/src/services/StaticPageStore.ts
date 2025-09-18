import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { STATIC_PAGES_FILE } from '../config.js';
import {
  StaticPage,
  StaticPageColumn,
  StaticPageSection,
  staticPageSchema,
  staticPagesFileSchema
} from '../types/staticPages.js';

const DEFAULT_SECTION = (): StaticPageSection => ({
  id: randomUUID(),
  columns: [
    {
      id: randomUUID(),
      span: 12,
      content: ''
    }
  ]
});

const clonePage = (page: StaticPage): StaticPage => ({
  ...page,
  sections: page.sections.map((section) => ({
    ...section,
    columns: section.columns.map((column) => ({ ...column }))
  }))
});

const slugify = (value: string): string => {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'page';
};

interface SectionInput {
  id?: string;
  columns?: Array<ColumnInput>;
}

interface ColumnInput {
  id?: string;
  span?: number;
  content?: string;
}

interface StaticPageInput {
  title?: string;
  slug?: string;
  visible?: boolean;
  order?: number;
  sections?: SectionInput[];
}

export class StaticPageStore {
  private cache?: StaticPage[];

  async ensureReady() {
    try {
      await fs.access(STATIC_PAGES_FILE);
    } catch (error) {
      await fs.mkdir(path.dirname(STATIC_PAGES_FILE), { recursive: true });
      await fs.writeFile(STATIC_PAGES_FILE, JSON.stringify({ pages: [] }, null, 2), 'utf-8');
    }
  }

  private async readFile(): Promise<StaticPage[]> {
    if (!this.cache) {
      await this.ensureReady();
      const content = await fs.readFile(STATIC_PAGES_FILE, 'utf-8');
      const parsed = staticPagesFileSchema.parse(JSON.parse(content));
      const sorted = [...parsed.pages]
        .sort((a, b) => a.order - b.order)
        .map((page, index) =>
          staticPageSchema.parse({
            ...page,
            order: index,
            sections: page.sections.length > 0 ? page.sections : [DEFAULT_SECTION()]
          })
        );
      this.cache = sorted;
    }
    return this.cache.map(clonePage);
  }

  private async writeFile(pages: StaticPage[]) {
    const sorted = [...pages]
      .sort((a, b) => a.order - b.order)
      .map((page, index) => staticPageSchema.parse({ ...page, order: index }));
    await fs.writeFile(STATIC_PAGES_FILE, JSON.stringify({ pages: sorted }, null, 2), 'utf-8');
    this.cache = sorted;
  }

  private normalizeColumns(columns?: ColumnInput[]): StaticPageColumn[] {
    const safeColumns = (columns ?? []).map((column) => ({
      id: column.id ?? randomUUID(),
      span: Math.min(12, Math.max(1, Math.round(column.span ?? 12))),
      content: column.content ?? ''
    }));

    return safeColumns.length > 0 ? safeColumns : DEFAULT_SECTION().columns;
  }

  private normalizeSections(sections?: SectionInput[]): StaticPageSection[] {
    const safeSections = (sections ?? []).map((section) => ({
      id: section.id ?? randomUUID(),
      columns: this.normalizeColumns(section.columns)
    }));

    return safeSections.length > 0 ? safeSections : [DEFAULT_SECTION()];
  }

  private ensureUniqueSlug(slug: string, pages: StaticPage[], excludeId?: string): string {
    const base = slugify(slug);
    let candidate = base;
    let suffix = 1;
    const existing = new Set(pages.filter((page) => page.id !== excludeId).map((page) => page.slug));
    while (existing.has(candidate)) {
      candidate = `${base}-${suffix++}`;
    }
    return candidate;
  }

  async list(): Promise<StaticPage[]> {
    return this.readFile();
  }

  async get(id: string): Promise<StaticPage | undefined> {
    const pages = await this.readFile();
    return pages.find((page) => page.id === id);
  }

  async create(input: StaticPageInput = {}): Promise<StaticPage> {
    const pages = await this.readFile();
    const now = new Date().toISOString();
    const title = input.title?.trim() || 'Nouvelle page';
    const slug = this.ensureUniqueSlug(input.slug?.trim() || slugify(title), pages);

    const page: StaticPage = staticPageSchema.parse({
      id: randomUUID(),
      title,
      slug,
      visible: input.visible ?? false,
      order: pages.length,
      sections: this.normalizeSections(input.sections),
      createdAt: now,
      updatedAt: now
    });

    await this.writeFile([...pages, page]);
    return clonePage(page);
  }

  async update(id: string, input: StaticPageInput): Promise<StaticPage> {
    const pages = await this.readFile();
    const index = pages.findIndex((page) => page.id === id);
    if (index === -1) {
      throw new Error('Page introuvable');
    }

    const now = new Date().toISOString();
    const current = pages[index];

    const nextTitle = input.title?.trim() || current.title;
    const requestedSlug = input.slug?.trim();
    const slug = requestedSlug
      ? this.ensureUniqueSlug(requestedSlug, pages, id)
      : input.title
      ? this.ensureUniqueSlug(slugify(nextTitle), pages, id)
      : current.slug;

    const targetIndex = input.order ?? current.order;

    const nextPage: StaticPage = staticPageSchema.parse({
      ...current,
      title: nextTitle,
      slug,
      visible: input.visible ?? current.visible,
      sections: input.sections ? this.normalizeSections(input.sections) : current.sections,
      order: targetIndex,
      updatedAt: now
    });

    const nextPages = [...pages];
    nextPages.splice(index, 1);
    const safeIndex = Math.max(0, Math.min(targetIndex, nextPages.length));
    nextPages.splice(safeIndex, 0, nextPage);
    await this.writeFile(nextPages);
    const refreshed = await this.get(id);
    if (!refreshed) {
      throw new Error('Page introuvable après mise à jour');
    }
    return refreshed;
  }

  async delete(id: string) {
    const pages = await this.readFile();
    const filtered = pages.filter((page) => page.id !== id);
    await this.writeFile(filtered);
  }
}

export const staticPageStore = new StaticPageStore();
