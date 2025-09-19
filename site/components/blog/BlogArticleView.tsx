import Link from "next/link";
import Image from "next/image";

import type { BlogArticle, BlogSettings } from "@/types/blog";

import { ArticleContent } from "./ArticleContent";

type BlogArticleViewProps = {
  article: BlogArticle;
  listPath: string;
  availableCategories: string[];
  settings: BlogSettings;
};

function ensureMediaPath(path: string | undefined): string | null {
  if (!path) {
    return null;
  }
  if (path.startsWith("http")) {
    return path;
  }
  if (path.startsWith("/api/media")) {
    return path;
  }
  return `/api/media${path.startsWith("/") ? path : `/${path}`}`;
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

export function BlogArticleView({ article, listPath, availableCategories, settings }: BlogArticleViewProps) {
  const backHref = `/${listPath}`;
  const coverPath = ensureMediaPath(article.coverImage?.previewPath || article.coverImage?.path || article.images[0]);

  return (
    <div className="blog-article-layout">
      <article className="blog-article">
        <nav className="blog-article__nav" aria-label="Fil d'Ariane du blog">
          <Link href={backHref}>&larr; Retour aux actualités</Link>
        </nav>

        <header className="blog-article__header">
          <span className="blog-article__label">{settings.heroSubtitle || "Lettre de l'atelier"}</span>
          <h1>{article.title}</h1>
          <div className="blog-article__meta">
            <span>{formatDate(article.date)}</span>
            <span>&bull;</span>
            <span>{article.author}</span>
          </div>
          <div className="blog-article__tags">
            {article.categories.map((category) => (
              <Link key={category} href={`${backHref}?categorie=${encodeURIComponent(category)}`} className="blog-tag">
                #{category}
              </Link>
            ))}
          </div>
        </header>

        {coverPath ? (
          <figure className="blog-article__cover">
            <Image
              src={coverPath}
              alt={article.title}
              width={1200}
              height={780}
              sizes="(max-width: 900px) 95vw, 1200px"
              priority={false}
              unoptimized
            />
          </figure>
        ) : null}

        <ArticleContent html={article.content} title={article.title} />
      </article>

      <aside className="blog-article__aside" aria-label="Navigation blog">
        <div className="blog-article__aside-card">
          <h2>Explorer par catégories</h2>
          <div className="blog-chip-group">
            <Link href={backHref} className="blog-chip">
              Toutes
            </Link>
            {availableCategories
              .filter((category) => !article.categories.includes(category))
              .sort()
              .map((category) => (
                <Link key={category} href={`${backHref}?categorie=${encodeURIComponent(category)}`} className="blog-chip">
                  #{category}
                </Link>
              ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
