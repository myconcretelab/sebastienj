import { cache } from "react";
import fs from "fs/promises";
import path from "path";

export type FolderMetadata = {
  mediaOrder?: string[];
};

export type FolderMetadataRecord = Record<string, FolderMetadata>;

const FOLDER_META_FILE = path.resolve(process.cwd(), "..", "storage", ".dossier-meta.json");

async function readFolderMetadata(): Promise<FolderMetadataRecord> {
  try {
    const raw = await fs.readFile(FOLDER_META_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const result: FolderMetadataRecord = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (value && typeof value === "object") {
        const meta = value as Record<string, unknown>;
        const orderValue = meta["mediaOrder"];
        const order = Array.isArray(orderValue)
          ? orderValue.filter((item): item is string => typeof item === "string")
          : undefined;
        result[key] = order ? { mediaOrder: order } : {};
      } else {
        result[key] = {};
      }
    }

    return result;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export const getFolderMetadata = cache(readFolderMetadata);
