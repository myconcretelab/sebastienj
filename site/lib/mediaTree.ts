import { cache } from "react";
import fs from "fs/promises";
import path from "path";

import { getFolderMetadata, type FolderMetadataRecord } from "./folderMetadata";

export type MediaNode = {
  name: string;
  displayName: string;
  pathSegments: string[];
  href: string;
  type: "directory" | "file";
  children: MediaNode[];
};

const MEDIA_ROOT = path.resolve(process.cwd(), "..", "medias");

const IGNORED_FILES = new Set([".gitkeep", "description.md"]);

function formatDisplayName(source: string) {
  const withoutExtension = source.replace(/\.[^.]+$/, "");
  return withoutExtension
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildRouteHref(segments: string[]) {
  if (segments.length === 0) {
    return "/";
  }

  return `/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

function joinSegments(segments: string[]) {
  return segments.map((segment) => encodeURIComponent(segment)).join("/");
}

async function buildTree(
  currentPath: string,
  segments: string[],
  folderMetadata: FolderMetadataRecord
): Promise<MediaNode> {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });

  const directories = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const folderKey = segments.join("/");
  const order = folderMetadata[folderKey]?.mediaOrder ?? [];
  const orderMap = new Map(order.map((item, index) => [item, index]));

  const toRelativePath = (name: string) => (folderKey ? `${folderKey}/${name}` : name);

  const files = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        !entry.name.startsWith(".") &&
        !IGNORED_FILES.has(entry.name)
    )
    .sort((a, b) => {
      const aPath = toRelativePath(a.name);
      const bPath = toRelativePath(b.name);
      const aIndex = orderMap.has(aPath) ? orderMap.get(aPath)! : Number.MAX_SAFE_INTEGER;
      const bIndex = orderMap.has(bPath) ? orderMap.get(bPath)! : Number.MAX_SAFE_INTEGER;
      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }
      return a.name.localeCompare(b.name, "fr");
    });

  const children: MediaNode[] = [];

  for (const dir of directories) {
    const nextSegments = [...segments, dir.name];
    children.push(await buildTree(path.join(currentPath, dir.name), nextSegments, folderMetadata));
  }

  for (const file of files) {
    const nextSegments = [...segments, file.name];
    children.push({
      name: file.name,
      displayName: formatDisplayName(file.name),
      pathSegments: nextSegments,
      href: buildRouteHref(nextSegments),
      type: "file",
      children: [],
    });
  }

  const currentName = segments[segments.length - 1] ?? "collection";

  return {
    name: currentName,
    displayName: segments.length === 0 ? "Collection" : formatDisplayName(currentName),
    pathSegments: segments,
    href: buildRouteHref(segments),
    type: "directory",
    children,
  };
}

export const getMediaTree = cache(async () => {
  const folderMetadata = await getFolderMetadata();
  return buildTree(MEDIA_ROOT, [], folderMetadata);
});

export function findNodeByPath(root: MediaNode, segments: string[]) {
  const selection: MediaNode[] = [];
  let current = root;

  for (const segment of segments) {
    const next = current.children.find((child) => child.name === segment);
    if (!next) {
      break;
    }

    selection.push(next);
    current = next;
    if (next.type === "file") {
      break;
    }
  }

  return {
    selection,
    current,
  };
}

export function encodeForMediaPath(segments: string[]) {
  return joinSegments(segments);
}
