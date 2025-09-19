import type { Metadata } from "next";
import Link from "next/link";
import { Special_Elite } from "next/font/google";

import { LightboxProvider } from "@/components/LightboxProvider";
import { getVisibleStaticPages } from "@/lib/staticPages";
import { getSettings } from "@/lib/settings";
import { getBlogSettings } from "@/lib/blog";

import "./globals.css";

const specialElite = Special_Elite({ subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "Atelier sensible – Carnets et images",
  description:
    "Une promenade poétique dans les peintures, dessins et photographies de l'atelier.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [staticPages, settings, blogSettings] = await Promise.all([
    getVisibleStaticPages(),
    getSettings(),
    getBlogSettings(),
  ]);

  const blogListHref = `/${blogSettings.listPath}`;
  const blogNavLabel = blogSettings.heroTitle || "Actualités";

  return (
    <html lang="fr">
      <body className={specialElite.className}>
        <LightboxProvider lightbox={settings.ui.lightbox} attributeTypes={settings.attributeTypes}>
          <header className="site-header">
            <Link href="/" className="site-logo" aria-label="Retour à l'accueil">
              SJ
            </Link>
            <div className="site-title">
              <h1>Atelier sensible</h1>
              <p>Fragments de couleur, traits rapides, photographies en murmure.</p>
            </div>
            <nav className="site-nav" aria-label="Navigation principale">
              <Link href="/">Explorer</Link>
              <Link href={blogListHref}>{blogNavLabel}</Link>
              {staticPages.map((page) => (
                <Link key={page.id} href={`/pages/${page.slug}`}>
                  {page.title}
                </Link>
              ))}
              <a href="mailto:contact@atelier.example" rel="noreferrer">
                Écrire
              </a>
            </nav>
          </header>
          <main>{children}</main>
        </LightboxProvider>
      </body>
    </html>
  );
}
