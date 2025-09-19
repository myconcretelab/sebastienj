import { cache } from "react";
import { promises as fs } from "fs";
import path from "path";

import type { AttributeType } from "@/types/metadata";

export type LightboxSettings = {
  overlayColor: string;
  overlayOpacity: number;
  overlayBlur: number;
  backgroundColor: string;
  borderRadius: number;
  maxWidth: number;
  padding: number;
};

export type SiteSettings = {
  attributeTypes: AttributeType[];
  ui: {
    theme: string;
    accentColor: string;
    paperColor: string;
    texture?: string;
    animation: {
      duration: number;
      easing: string;
    };
    lightbox: LightboxSettings;
  };
};

const SETTINGS_FILE = path.resolve(process.cwd(), "..", "storage", "settings.json");

const defaultLightbox: LightboxSettings = {
  overlayColor: "#ffffff",
  overlayOpacity: 0.92,
  overlayBlur: 16,
  backgroundColor: "#f8f4ef",
  borderRadius: 22,
  maxWidth: 980,
  padding: 32,
};

const defaultSettings: SiteSettings = {
  attributeTypes: [],
  ui: {
    theme: "dawn",
    accentColor: "#8c6b4f",
    paperColor: "#f5ede2",
    animation: {
      duration: 240,
      easing: "ease-in-out",
    },
    lightbox: defaultLightbox,
  },
};

type UnknownRecord = Record<string, unknown>;

function isObject(value: unknown): value is UnknownRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeAttributeTypes(input: unknown): AttributeType[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (!isObject(item)) return null;
      const id = typeof item.id === "string" ? item.id : "";
      const label = typeof item.label === "string" ? item.label : id || "Attribut";
      const inputType =
        typeof item.input === "string"
          ? item.input
          : "text";
      if (!id) return null;
      const options = Array.isArray(item.options)
        ? item.options.filter((value): value is string => typeof value === "string")
        : undefined;
      const description = typeof item.description === "string" ? item.description : undefined;
      return {
        id,
        label,
        input: inputType as AttributeType["input"],
        options,
        description,
      } satisfies AttributeType;
    })
    .filter(Boolean) as AttributeType[];
}

function clampNumber(value: unknown, fallback: number, options?: { min?: number; max?: number }): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const min = options?.min ?? -Infinity;
  const max = options?.max ?? Infinity;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeLightboxSettings(input: unknown): LightboxSettings {
  if (!isObject(input)) {
    return { ...defaultLightbox };
  }

  return {
    overlayColor: typeof input.overlayColor === "string" ? input.overlayColor : defaultLightbox.overlayColor,
    overlayOpacity: clampNumber(input.overlayOpacity, defaultLightbox.overlayOpacity, { min: 0, max: 1 }),
    overlayBlur: clampNumber(input.overlayBlur, defaultLightbox.overlayBlur, { min: 0, max: 48 }),
    backgroundColor:
      typeof input.backgroundColor === "string" ? input.backgroundColor : defaultLightbox.backgroundColor,
    borderRadius: clampNumber(input.borderRadius, defaultLightbox.borderRadius, { min: 0, max: 64 }),
    maxWidth: clampNumber(input.maxWidth, defaultLightbox.maxWidth, { min: 280, max: 1600 }),
    padding: clampNumber(input.padding, defaultLightbox.padding, { min: 12, max: 96 }),
  };
}

function normalizeSettings(value: unknown): SiteSettings {
  if (!isObject(value)) {
    return { ...defaultSettings, ui: { ...defaultSettings.ui, lightbox: { ...defaultLightbox } } };
  }

  const ui = isObject(value.ui) ? value.ui : {};

  return {
    attributeTypes: normalizeAttributeTypes(value.attributeTypes),
    ui: {
      theme: typeof ui.theme === "string" ? ui.theme : defaultSettings.ui.theme,
      accentColor: typeof ui.accentColor === "string" ? ui.accentColor : defaultSettings.ui.accentColor,
      paperColor: typeof ui.paperColor === "string" ? ui.paperColor : defaultSettings.ui.paperColor,
      texture: typeof ui.texture === "string" ? ui.texture : undefined,
      animation: {
        duration: clampNumber(ui.animation && (ui.animation as UnknownRecord).duration, defaultSettings.ui.animation.duration, {
          min: 0,
          max: 10000,
        }),
        easing:
          isObject(ui.animation) && typeof ui.animation.easing === "string"
            ? ui.animation.easing
            : defaultSettings.ui.animation.easing,
      },
      lightbox: normalizeLightboxSettings(ui.lightbox),
    },
  };
}

async function readSettings(): Promise<SiteSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return normalizeSettings(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...defaultSettings, ui: { ...defaultSettings.ui, lightbox: { ...defaultLightbox } } };
    }
    throw error;
  }
}

export const getSettings = cache(readSettings);
