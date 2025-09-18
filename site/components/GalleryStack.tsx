"use client";

import { motion } from "framer-motion";
import clsx from "clsx";

import paperStyles from "./Paper.module.css";
import styles from "./GalleryStack.module.css";

type GalleryItem = {
  id: string;
  label: string;
  mediaPath?: string;
  href?: string;
  hints?: string[];
};

type GalleryStackProps = {
  items: GalleryItem[];
};

export function GalleryStack({ items }: GalleryStackProps) {
  if (items.length === 0) {
    return <p className={styles.empty}>Aucun média pour le moment dans cette alcôve.</p>;
  }

  return (
    <motion.ul className={styles.grid} layout>
      {items.map((item, index) => {
        const rotation = index % 2 === 0 ? -1.6 : 1.4;
        const linkHref = item.href ?? (item.mediaPath ? `/api/media/${item.mediaPath}` : "#");
        const linkProps = item.mediaPath
          ? { target: "_blank" as const, rel: "noreferrer" }
          : {};

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
              {...linkProps}
            >
              <div className={styles.frame}>
                {item.mediaPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/media/${item.mediaPath}`} alt={item.label} loading="lazy" />
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
