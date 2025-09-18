"use client";

import { useMemo } from "react";
import clsx from "clsx";

import { CategoryList } from "./CategoryList";
import { GalleryStack } from "./GalleryStack";
import { SelectionStack } from "./SelectionStack";
import styles from "./NavigationScene.module.css";

type StackItem = {
  label: string;
  href: string;
};

type CategoryItem = StackItem;

type GalleryItem = {
  id: string;
  label: string;
  mediaPath?: string;
  href?: string;
  hints?: string[];
  image?: {
    defaultPath: string;
    width?: number;
    height?: number;
    sources: Array<{ format: string; path: string }>;
  };
};

type NavigationSceneProps = {
  root: StackItem;
  pathKey: string;
  selected: StackItem[];
  categories: CategoryItem[];
  galleryItems: GalleryItem[];
  rootPreview: GalleryItem[];
  backHref: string | null;
};

export function NavigationScene({
  root,
  pathKey,
  selected,
  categories,
  galleryItems,
  rootPreview,
  backHref,
}: NavigationSceneProps) {
  const poem = useMemo(() => {
    if (selected.length === 0) {
      return "Un souffle de papier vous invite à choisir une porte.";
    }

    const last = selected[selected.length - 1];
    return `Vous cheminez dans « ${last.label.toLowerCase()} ».`;
  }, [selected]);

  const categoriesKey = useMemo(() => {
    if (categories.length === 0) {
      return `${pathKey}-empty`;
    }

    return categories.map((item) => item.href).join("|");
  }, [categories, pathKey]);

  return (
    <div className={styles.scene}>
      <aside className={clsx(styles.selection)}>
        <SelectionStack
          rootHref={root.href}
          rootLabel={root.label}
          items={selected}
          backHref={backHref}
        />
      </aside>
      <section className={styles.main}>
        <p className="poetic-note">{poem}</p>
        <div className={styles.categoryPanel}>
          {categories.length > 0 ? (
            <CategoryList categories={categories} animationKey={categoriesKey} />
          ) : (
            <p className="poetic-note">Ce tiroir est ouvert : plongez dans la galerie.</p>
          )}
        </div>
        <div className={styles.galleryPanel}>
          {selected.length === 0 && rootPreview.length > 0 && (
            <GalleryStack items={rootPreview} />
          )}
          {galleryItems.length > 0 && <GalleryStack items={galleryItems} />}
        </div>
      </section>
    </div>
  );
}
