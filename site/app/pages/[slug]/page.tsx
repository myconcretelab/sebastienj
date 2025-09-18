import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getStaticPageBySlug } from "@/lib/staticPages";

export const dynamic = "force-dynamic";

type PageProps = {
  params: {
    slug: string;
  };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const page = await getStaticPageBySlug(params.slug);
  if (!page || !page.visible) {
    return {
      title: "Page introuvable – Atelier sensible",
    };
  }

  return {
    title: `${page.title} – Atelier sensible`,
    description: `Page statique de l'atelier : ${page.title}`,
  };
}

export default async function StaticPageView({ params }: PageProps) {
  const page = await getStaticPageBySlug(params.slug);

  if (!page || !page.visible) {
    notFound();
  }

  return (
    <article className="static-page">
      <header className="static-page__header">
        <h1>{page.title}</h1>
      </header>
      {page.sections.map((section) => {
        const totalSpan = section.columns.reduce((sum, column) => sum + column.span, 0) || 12;
        const template = section.columns
          .map((column) => `${Math.round((column.span / totalSpan) * 10000) / 100}%`)
          .join(" ");
        return (
          <section key={section.id} className="static-page__section">
            <div className="static-page__columns" style={{ gridTemplateColumns: template }}>
              {section.columns.map((column) => (
                <div
                  key={column.id}
                  className="static-page__column"
                  dangerouslySetInnerHTML={{ __html: column.content }}
                />
              ))}
            </div>
          </section>
        );
      })}
    </article>
  );
}
