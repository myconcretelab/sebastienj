"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";

import paperStyles from "./Paper.module.css";
import styles from "./CategoryList.module.css";

type Category = {
  label: string;
  href: string;
};

type CategoryListProps = {
  categories: Category[];
  animationKey: string;
};

export function CategoryList({ categories, animationKey }: CategoryListProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.ul
        key={animationKey}
        className={styles.list}
        initial={{ x: 80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -80, opacity: 0 }}
        transition={{ duration: 0.55, ease: "easeInOut" }}
      >
        {categories.map((category, index) => {
          const rotationStyle = {
            "--rotation": `${index % 2 === 0 ? -2 : 2}deg`,
          } as CSSProperties;

          return (
            <motion.li
              key={category.href}
              layout
              whileHover={{ y: -6, rotate: index % 2 === 0 ? -1.4 : 1.4 }}
              transition={{ type: "spring", stiffness: 180, damping: 18 }}
            >
              <Link
                href={category.href}
                className={clsx(paperStyles.base, paperStyles.stack, paperStyles.interactive, styles.paper)}
                style={rotationStyle}
              >
                <span>{category.label}</span>
              </Link>
            </motion.li>
          );
        })}
      </motion.ul>
    </AnimatePresence>
  );
}
