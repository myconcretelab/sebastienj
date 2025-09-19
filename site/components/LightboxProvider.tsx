"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import clsx from "clsx";

import type { AttributeRecord, AttributeType, AttributeValue } from "@/types/metadata";
import type { LightboxSettings } from "@/lib/settings";
import styles from "./Lightbox.module.css";

type LightboxImageSource = {
  format: string;
  path: string;
};

type LightboxImage = {
  defaultPath: string;
  width?: number;
  height?: number;
  sources?: LightboxImageSource[];
};

type LightboxMeta = {
  width?: number;
  height?: number;
  orientation?: string;
  createdAt?: string;
};

type LightboxPayload = {
  id: string;
  label: string;
  alt: string;
  fullImage: LightboxImage;
  previewSrc?: string;
  description?: string;
  attributes?: AttributeRecord;
  tags?: string[];
  meta?: LightboxMeta;
  origin?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};

type LightboxContextValue = {
  open: (payload: LightboxPayload) => void;
  close: () => void;
};

const LightboxContext = createContext<LightboxContextValue | null>(null);

export function useLightbox() {
  const context = useContext(LightboxContext);
  if (!context) {
    throw new Error("useLightbox must be used within a LightboxProvider");
  }
  return context;
}

type LightboxProviderProps = {
  children: ReactNode;
  lightbox: LightboxSettings;
  attributeTypes: AttributeType[];
};

type DisplayAttribute = {
  id: string;
  label: string;
  content: ReactNode;
};

function withOpacity(color: string, opacity: number) {
  const normalized = Math.min(1, Math.max(0, opacity));

  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const size = hex.length === 3 ? 1 : 2;
    const parse = (offset: number) => {
      const chunk = hex.slice(offset * size, offset * size + size);
      const value = size === 1 ? parseInt(chunk.repeat(2), 16) : parseInt(chunk, 16);
      return Number.isFinite(value) ? value : 255;
    };
    const r = parse(0);
    const g = parse(1);
    const b = parse(2);
    return `rgba(${r}, ${g}, ${b}, ${normalized})`;
  }

  const rgbMatch = color.match(/rgb\s*\(([^)]+)\)/i) || color.match(/rgba\s*\(([^)]+)\)/i);
  if (rgbMatch) {
    const [r = "255", g = "255", b = "255"] = rgbMatch[1]
      .split(",")
      .map((value) => value.trim());
    return `rgba(${Number(r)}, ${Number(g)}, ${Number(b)}, ${normalized})`;
  }

  return `rgba(255, 255, 255, ${normalized})`;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

function renderAttributeValue(value: AttributeValue): ReactNode {
  switch (value.type) {
    case "text":
      return <span>{value.value}</span>;
    case "textarea":
      return <span className={styles.multiline}>{value.value}</span>;
    case "boolean":
      return <span>{value.value ? "Oui" : "Non"}</span>;
    case "date":
      return <span>{formatDate(value.value)}</span>;
    case "number":
      return <span>{Number(value.value).toLocaleString("fr-FR")}</span>;
    case "link":
      return (
        <a className={styles.link} href={value.value.url} target="_blank" rel="noreferrer">
          {value.value.label ?? value.value.url}
        </a>
      );
    case "image":
      return (
        <a className={styles.link} href={`/api/media/${value.value}`} target="_blank" rel="noreferrer">
          Voir l’image
        </a>
      );
    case "select":
      return <span>{value.value}</span>;
    case "color":
      return (
        <span className={styles.colorSwatch}>
          <span className={styles.colorPreview} style={{ background: value.value }} />
          <span>{value.value}</span>
        </span>
      );
    default:
      return <span>{String((value as AttributeValue & { value: unknown }).value ?? "")}</span>;
  }
}

function buildAttributes(
  attributes: AttributeRecord | undefined,
  labelMap: Record<string, AttributeType>,
  meta: LightboxMeta | undefined,
  tags: string[] | undefined,
): DisplayAttribute[] {
  const entries: DisplayAttribute[] = [];

  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      const label = labelMap[key]?.label ?? key;
      entries.push({
        id: key,
        label,
        content: renderAttributeValue(value),
      });
    }
  }

  if (meta?.width && meta?.height) {
    entries.push({
      id: "dimensions",
      label: "Dimensions",
      content: `${meta.width.toLocaleString("fr-FR")} × ${meta.height.toLocaleString("fr-FR")} px`,
    });
  }

  if (meta?.orientation) {
    const orientationLabels: Record<string, string> = {
      horizontal: "Paysage",
      vertical: "Portrait",
      square: "Carré",
    };
    entries.push({
      id: "orientation",
      label: "Orientation",
      content: orientationLabels[meta.orientation] ?? meta.orientation,
    });
  }

  if (meta?.createdAt) {
    entries.push({
      id: "createdAt",
      label: "Créé",
      content: formatDate(meta.createdAt),
    });
  }

  if (tags && tags.length > 0) {
    entries.push({
      id: "tags",
      label: "Mots-clés",
      content: (
        <span className={styles.tags}>
          {tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </span>
      ),
    });
  }

  return entries;
}

export function LightboxProvider({ children, lightbox, attributeTypes }: LightboxProviderProps) {
  const [item, setItem] = useState<LightboxPayload | null>(null);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    setPortalNode(document.body);
  }, []);

  const open = useCallback((payload: LightboxPayload) => {
    setItem(payload);
  }, []);

  const close = useCallback(() => {
    setItem(null);
  }, []);

  useEffect(() => {
    if (!item) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    setImageLoaded(false);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateViewport);
      document.body.style.overflow = previousOverflow;
    };
  }, [item, close]);

  useEffect(() => {
    if (item && closeButtonRef.current) {
      closeButtonRef.current.focus({ preventScroll: true });
    }
  }, [item]);

  useEffect(() => {
    if (!item) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setImageLoaded(true);
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [item]);

  const overlayStyle = useMemo(() => {
    const style: CSSProperties = {
      ["--lightbox-overlay" as string]: withOpacity(lightbox.overlayColor, lightbox.overlayOpacity),
      ["--lightbox-blur" as string]: `${lightbox.overlayBlur}px`,
      ["--lightbox-background" as string]: lightbox.backgroundColor,
      ["--lightbox-radius" as string]: `${lightbox.borderRadius}px`,
      ["--lightbox-max-width" as string]: `${lightbox.maxWidth}px`,
      ["--lightbox-padding" as string]: `${lightbox.padding}px`,
    };
    return style;
  }, [lightbox]);

  const animationTarget = useMemo(() => {
    if (!item || viewport.width === 0 || viewport.height === 0) {
      return null;
    }

    const padding = lightbox.padding * 2;
    const maxWidth = Math.min(lightbox.maxWidth, viewport.width - padding);
    const aspectRatio =
      item.fullImage.width && item.fullImage.height
        ? item.fullImage.width / item.fullImage.height
        : null;

    let width = Math.max(240, maxWidth);
    let height = aspectRatio ? width / aspectRatio : width * 0.75;

    const maxHeight = viewport.height - padding - 160;
    if (height > maxHeight) {
      height = maxHeight;
      width = aspectRatio ? height * aspectRatio : width;
    }

    return { width, height };
  }, [item, viewport, lightbox]);

  const figureAnimation = useMemo(() => {
    if (!item || shouldReduceMotion) {
      return {
        initial: { opacity: 0, scale: 0.92 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.92 },
      } as const;
    }

    if (!item.origin || !animationTarget) {
      return {
        initial: { opacity: 0, scale: 0.92 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.92 },
      } as const;
    }

    const centerX = item.origin.left + item.origin.width / 2 - viewport.width / 2;
    const centerY = item.origin.top + item.origin.height / 2 - viewport.height / 2;
    const scaleX = item.origin.width / animationTarget.width;
    const scaleY = item.origin.height / animationTarget.height;

    return {
      initial: { opacity: 0, x: centerX, y: centerY, scaleX, scaleY },
      animate: { opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1 },
      exit: { opacity: 0, x: centerX * 0.6, y: centerY * 0.6, scaleX: scaleX * 0.9, scaleY: scaleY * 0.9 },
    } as const;
  }, [item, animationTarget, viewport, shouldReduceMotion]);

  const attributeLabelMap = useMemo(() => {
    return attributeTypes.reduce<Record<string, AttributeType>>((acc, type) => {
      acc[type.id] = type;
      return acc;
    }, {});
  }, [attributeTypes]);

  const attributeEntries = useMemo(() => {
    if (!item) {
      return [];
    }
    return buildAttributes(item.attributes, attributeLabelMap, item.meta, item.tags);
  }, [item, attributeLabelMap]);

  const contextValue = useMemo(() => ({ open, close }), [open, close]);

  if (!portalNode) {
    return <LightboxContext.Provider value={contextValue}>{children}</LightboxContext.Provider>;
  }

  return (
    <LightboxContext.Provider value={contextValue}>
      {children}
      {createPortal(
        <AnimatePresence>
          {item && (
            <motion.div
              className={styles.overlay}
              style={overlayStyle}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: "easeOut" }}
              onClick={close}
            >
              <motion.div
                className={styles.container}
                role="dialog"
                aria-modal="true"
                aria-label={item.label}
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: shouldReduceMotion ? 0 : 18 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: "easeOut" }}
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  ref={closeButtonRef}
                  type="button"
                  className={styles.closeButton}
                  aria-label="Fermer la visionneuse"
                  onClick={close}
                >
                  ×
                </button>
                <div className={styles.figureWrapper}>
                  <motion.figure
                    className={styles.figure}
                    initial={figureAnimation.initial}
                    animate={figureAnimation.animate}
                    exit={figureAnimation.exit}
                    transition={{ type: "spring", stiffness: 220, damping: 26 }}
                    onClick={close}
                  >
                    <picture className={styles.picture}>
                      {item.fullImage.sources?.map((source) => (
                        <source key={`${item.id}-${source.format}`} srcSet={source.path} type={`image/${source.format}`} />
                      ))}
                      <img
                        src={item.fullImage.defaultPath}
                        alt={item.alt}
                        className={styles.image}
                        width={item.fullImage.width}
                        height={item.fullImage.height}
                        onLoad={() => setImageLoaded(true)}
                        loading="eager"
                        draggable={false}
                      />
                    </picture>
                    <div
                      className={clsx(styles.loadingOverlay, imageLoaded && styles.loadingHidden)}
                      aria-hidden={imageLoaded}
                    >
                      <span>Chargement…</span>
                    </div>
                  </motion.figure>
                  <p className={styles.caption}>{item.label}</p>
                </div>
                {(item.description || attributeEntries.length > 0) && (
                  <div className={styles.detailsPaper}>
                    {item.description && <p className={styles.description}>{item.description}</p>}
                    {attributeEntries.length > 0 && (
                      <div className={styles.attributes}>
                        {attributeEntries.map((entry) => (
                          <div key={entry.id} className={styles.attribute}>
                            <span className={styles.attributeTitle}>{entry.label}</span>
                            <span className={styles.attributeValue}>{entry.content}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        portalNode,
      )}
    </LightboxContext.Provider>
  );
}
