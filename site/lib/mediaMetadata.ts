import { cache } from "react";
import fs from "fs/promises";
import path from "path";

type ThumbnailSource = {
  format: string;
  path: string;
  size?: number;
};

type ThumbnailEntry = {
  defaultPath: string;
  sources: ThumbnailSource[];
  width?: number;
  height?: number;
};

export type MediaMetadata = {
  width?: number;
  height?: number;
  orientation?: "horizontal" | "vertical" | "square";
  thumbnails?: Record<string, ThumbnailEntry>;
};

export type MediaMetadataRecord = Record<string, MediaMetadata>;

const MEDIA_META_FILE = path.resolve(process.cwd(), "..", "medias", ".media-meta.json");

async function readMetadata(): Promise<MediaMetadataRecord> {
  try {
    const raw = await fs.readFile(MEDIA_META_FILE, "utf-8");
    const parsed = JSON.parse(raw) as MediaMetadataRecord;
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export const getMediaMetadata = cache(readMetadata);
