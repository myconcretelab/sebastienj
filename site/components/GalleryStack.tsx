"use client";

import { motion } from "framer-motion";
import clsx from "clsx";
import Image from "next/image";

import type { AttributeRecord } from "@/types/metadata";

import { useLightbox } from "./LightboxProvider";
import paperStyles from "./Paper.module.css";
import styles from "./GalleryStack.module.css";

type GalleryImage = {
  defaultPath: string;
  width?: number;
  height?: number;
  sources: Array<{ format: string; path: string }>;
};

type GalleryMeta = {
  width?: number;
  height?: number;
  orientation?: string;
  createdAt?: string;
};

export type GalleryItem = {
  id: string;
  label: string;
  mediaPath?: string;
  href?: string;
  hints?: string[];
  image?: GalleryImage;
  fullImage?: GalleryImage;
  description?: string;
  attributes?: AttributeRecord;
  tags?: string[];
  meta?: GalleryMeta;
};

type GalleryStackProps = {
  items: GalleryItem[];
};

function ensureMediaPath(path: string) {
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

export function GalleryStack({ items }: GalleryStackProps) {
  const { open } = useLightbox();

  if (items.length === 0) {
    return <p className={styles.empty}>Aucun média pour le moment dans cette alcôve.</p>;
  }

  return (
    <motion.ul className={styles.grid} layout>
      {items.map((item, index) => {
        const rotation = index % 2 === 0 ? -1.6 : 1.4;
        const linkHref = item.href ?? (item.mediaPath ? `/api/media/${item.mediaPath}` : "#");

        const openLightbox = (anchor: HTMLAnchorElement) => {
          const media = item.fullImage ?? item.image;
          const defaultPath = media?.defaultPath
            ? ensureMediaPath(media.defaultPath)
            : item.mediaPath
            ? ensureMediaPath(item.mediaPath)
            : null;

          if (!defaultPath) {
            return;
          }

          const sources = media?.sources?.map((source) => ({
            format: source.format,
            path: ensureMediaPath(source.path),
          }));

          const imageElement = anchor.querySelector("img");
          const rect = imageElement?.getBoundingClientRect();

          const width = media?.width ?? item.meta?.width;
          const height = media?.height ?? item.meta?.height;

          open({
            id: item.id,
            label: item.label,
            alt: item.label,
            fullImage: {
              defaultPath,
              width,
              height,
              sources,
            },
            description: item.description,
            attributes: item.attributes,
            tags: item.tags,
            meta: item.meta,
            origin: rect
              ? {
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                }
              : undefined,
          });
        };

        const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
          }

          if (!item.mediaPath && !item.fullImage && !item.image) {
            return;
          }

          event.preventDefault();
          openLightbox(event.currentTarget);
        };

        const handleKeyDown = (event: React.KeyboardEvent<HTMLAnchorElement>) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }

          if (!item.mediaPath && !item.fullImage && !item.image) {
            return;
          }

          event.preventDefault();
          openLightbox(event.currentTarget);
        };

        return (
          <motion.li
            key={item.id}
            layout
            whileHover={{ rotate: rotation * 0.6, y: -8 }}
            transition={{ type: "spring", stiffness: 180, damping: 18 }}
          >
            <a
              className={clsx(paperStyles.base, paperStyles.gallery, paperStyles.stack, styles.card)}
              href={linkHref}
              onClick={handleClick}
              onKeyDown={handleKeyDown}
              aria-haspopup={item.mediaPath || item.fullImage || item.image ? "dialog" : undefined}
            >
              <div className={styles.frame}>
                {item.image ? (
                  <picture>
                    {item.image.sources.map((source) => (
                        <source
                          key={`${item.id}-${source.format}`}
                          srcSet={ensureMediaPath(source.path)}
                          type={`image/${source.format}`}
                        />
                      ))}
                      <Image
                        src={ensureMediaPath(item.image.defaultPath)}
                        alt={item.label}
                        width={item.image.width ?? 320}
                        height={item.image.height ?? 240}
                        className={styles.image}
                        sizes="(max-width: 900px) 45vw, 320px"
                        priority={index < 4}
                        unoptimized
                      />
                    </picture>
                  ) : item.mediaPath ? (
                    <Image
                      src={ensureMediaPath(item.mediaPath)}
                      alt={item.label}
                      width={320}
                      height={240}
                      className={styles.image}
                      sizes="(max-width: 900px) 45vw, 320px"
                      priority={index < 4}
                      unoptimized
                    />
                  ) : (
                    <div className={paperStyles.muted}>
                      {item.hints?.slice(0, 3).join(" · ") ?? "Fragment à découvrir"}
                    </div>
                  )}
              </div>
              <span className={styles.caption}>{item.label}</span>
            </a>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
