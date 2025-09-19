"use client";

import { useEffect, useRef } from "react";

import { useLightbox } from "@/components/LightboxProvider";

type ArticleContentProps = {
  html: string;
  title: string;
};

function ensureMediaPath(path: string): string {
  if (!path) {
    return path;
  }

  if (path.startsWith("http")) {
    return path;
  }

  if (path.startsWith("/api/media")) {
    return path;
  }

  return `/api/media${path.startsWith("/") ? path : `/${path}`}`;
}

export function ArticleContent({ html, title }: ArticleContentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { open } = useLightbox();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target) return;

      const image = target.closest<HTMLImageElement>("img");
      if (!image) return;

      const src = image.getAttribute("src");
      if (!src) return;

      const normalizedSrc = ensureMediaPath(src);
      const rect = image.getBoundingClientRect();

      event.preventDefault();

      open({
        id: `${normalizedSrc}-${Date.now()}`,
        label: image.getAttribute("title") || title,
        alt: image.getAttribute("alt") || title,
        fullImage: {
          defaultPath: normalizedSrc,
        },
        previewSrc: normalizedSrc,
        origin: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
      });
    };

    container.addEventListener("click", handleClick);
    return () => {
      container.removeEventListener("click", handleClick);
    };
  }, [open, title]);

  return <div ref={containerRef} className="blog-article__content" dangerouslySetInnerHTML={{ __html: html }} />;
}
