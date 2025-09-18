"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";

import paperStyles from "./Paper.module.css";
import styles from "./SelectionStack.module.css";

type StackItem = {
  label: string;
  href: string;
};

type SelectionStackProps = {
  rootLabel: string;
  rootHref: string;
  items: StackItem[];
  backHref: string | null;
};

export function SelectionStack({
  rootHref,
  rootLabel,
  items,
  backHref,
}: SelectionStackProps) {
  const note =
    items.length === 0
      ? "Choisissez un papier pour entrer dans l'atelier."
      : "Chaque papier ajoute un souvenir : cliquez pour remonter.";

  return (
    <div className={styles.stack}>
      <Link href={rootHref} className={clsx(paperStyles.base, paperStyles.stack, styles.home)}>
        {rootLabel}
      </Link>
      <div className={styles.items}>
        <AnimatePresence>
          {items.map((item, index) => (
            <motion.div
              key={item.href}
              layout
              className={styles.itemWrapper}
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <Link
                href={item.href}
                className={clsx(
                  paperStyles.base,
                  paperStyles.selected,
                  paperStyles.stack,
                  styles.itemLink
                )}
                style={{
                  transform: `rotate(${index % 2 === 0 ? "-1.2deg" : "1.2deg"})`,
                }}
              >
                {item.label}
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <p className={styles.note}>{note}</p>
      {backHref && items.length > 0 && (
        <Link href={backHref} className={styles.backLink}>
          ⟵ Revenir
        </Link>
      )}
    </div>
  );
}
