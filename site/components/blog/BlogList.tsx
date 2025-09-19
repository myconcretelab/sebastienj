import Link from "next/link";
import Image from "next/image";

import type { BlogArticle, BlogSettings } from "@/types/blog";

type BlogListProps = {
  articles: BlogArticle[];
  selectedCategory?: string;
  query?: string;
  listPath: string;
  articleBasePath: string;
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

function buildExcerpt(article: BlogArticle): string {
  if (article.excerpt) {
    return article.excerpt;
  }
  const plain = article.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!plain) return "";
  return plain.length > 220 ? `${plain.slice(0, 217).trim()}…` : plain;
}

function normalizeCategory(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.toLowerCase();
}

export function BlogList({
  articles,
  selectedCategory,
  query,
  listPath,
  articleBasePath,
  settings,
}: BlogListProps) {
  const normalizedCategory = normalizeCategory(selectedCategory);
  const normalizedQuery = query?.toLowerCase().trim();
  const categories = new Set<string>();
  articles.forEach((article) => article.categories.forEach((category) => categories.add(category)));

  const filteredArticles = articles.filter((article) => {
    const categoryMatch = normalizedCategory ? article.categories.includes(normalizedCategory) : true;
    const queryMatch = normalizedQuery
      ? article.title.toLowerCase().includes(normalizedQuery) || buildExcerpt(article).toLowerCase().includes(normalizedQuery)
      : true;
    return categoryMatch && queryMatch;
  });

  const listHref = `/${listPath}`;
  const articleBase = `/${articleBasePath}`;

  return (
    <div className="blog-wrapper">
      <header className="blog-hero">
        <span className="blog-hero__label">{settings.heroSubtitle || "Histoires en mouvement"}</span>
        <h1>{settings.heroTitle || "Actualités"}</h1>
        <p>
          {`Découvrir les derniers fragments écrits de l'atelier. ${articles.length > 0 ? `${articles.length} article(s) soigneusement rangés.` : "Rien n'a encore été publié."}`}
        </p>
      </header>

      <section className="blog-filters" aria-label="Filtres des articles">
        <form className="blog-filters__search" method="get" action={listHref}>
          <label htmlFor="blog-search">Rechercher</label>
          <input id="blog-search" name="q" placeholder="Mots-clés, auteur…" defaultValue={query ?? ""} />
          {normalizedCategory ? <input type="hidden" name="categorie" value={normalizedCategory} /> : null}
        </form>

        <div className="blog-filters__categories">
          <span>Catégories</span>
          <div className="blog-chip-group">
            <Link href={listHref} className={`blog-chip${!normalizedCategory ? " blog-chip--active" : ""}`}>
              Toutes
            </Link>
            {Array.from(categories)
              .sort()
              .map((category) => {
                const isActive = normalizedCategory === category;
                const href = `${listHref}?categorie=${encodeURIComponent(category)}${normalizedQuery ? `&q=${encodeURIComponent(normalizedQuery)}` : ""}`;
                return (
                  <Link key={category} href={href} className={`blog-chip${isActive ? " blog-chip--active" : ""}`}>
                    #{category}
                  </Link>
                );
              })}
          </div>
        </div>
      </section>

      <section className="blog-list" aria-label="Liste des articles">
        {filteredArticles.length === 0 ? (
          <p className="blog-empty">Aucun article ne correspond à cette sélection.</p>
        ) : (
          filteredArticles.map((article) => {
            const coverPath = ensureMediaPath(article.coverImage?.previewPath || article.coverImage?.path || article.images[0]);
            const articleHref = `${articleBase}/${article.slug}`.replace(/\/+/g, "/");
            const excerpt = buildExcerpt(article);

            return (
              <article key={article.id} className="blog-card">
                <Link href={articleHref}>
                  {coverPath ? (
                    <div className="blog-card__media">
                      <Image
                        src={coverPath}
                        alt={article.title}
                        width={640}
                        height={420}
                        sizes="(max-width: 900px) 90vw, 640px"
                        className="blog-card__image"
                        priority={false}
                        unoptimized
                      />
                    </div>
                  ) : null}
                  <div className="blog-card__body">
                    <span className="blog-card__date">{formatDate(article.date)}</span>
                    <h2 className="blog-card__title">{article.title}</h2>
                    {excerpt ? <p className="blog-card__excerpt">{excerpt}</p> : null}
                    <div className="blog-card__footer">
                      <span className="blog-card__author">{article.author}</span>
                      <div className="blog-card__categories">
                        {article.categories.map((category) => {
                          const href = `${listHref}?categorie=${encodeURIComponent(category)}`;
                          return (
                            <Link key={`${article.id}-${category}`} href={href} className="blog-tag">
                              #{category}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </Link>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
