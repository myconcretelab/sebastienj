import { notFound } from "next/navigation";

import { NavigationScene } from "@/components/NavigationScene";
import {
  encodeForMediaPath,
  findNodeByPath,
  getMediaTree,
  type MediaNode,
} from "@/lib/mediaTree";
import { getMediaMetadata } from "@/lib/mediaMetadata";

type PageProps = {
  params: {
    slug?: string[];
  };
};

function isDescendant(parent: MediaNode, childName: string) {
  return parent.children.some((child) => child.name === childName);
}

export default async function MediaPage({ params }: PageProps) {
  const slug = params.slug ?? [];
  const [tree, metadata] = await Promise.all([getMediaTree(), getMediaMetadata()]);

  if (slug.length > 0 && !isDescendant(tree, slug[0])) {
    notFound();
  }

  const { selection, current } = findNodeByPath(tree, slug);

  if (slug.length > selection.length) {
    notFound();
  }

  const selectedStack = selection
    .filter((node) => node.type === "directory")
    .map((node) => ({
      label: node.displayName,
      href: node.href,
    }));

  const activeDirectory = current.type === "directory" ? current : selection.at(-2) ?? tree;

  const directories =
    activeDirectory.type === "directory"
      ? activeDirectory.children.filter((child) => child.type === "directory")
      : [];

  const files =
    current.type === "directory"
      ? current.children.filter((child) => child.type === "file")
      : current.type === "file"
      ? [current]
      : [];

  const rootPreview = tree.children
    .filter((child) => child.type === "directory")
    .map((child) => ({
      id: child.href,
      label: child.displayName,
      href: child.href,
      hints: child.children
        .filter((item) => item.type === "directory")
        .map((item) => item.displayName),
    }));

  const galleryItems = files.map((file) => {
    const key = file.pathSegments.join("/");
    const meta = metadata[key];
    const thumbnails = meta?.thumbnails;
    const thumbEntry =
      thumbnails?.thumb ?? thumbnails?.medium ?? (thumbnails ? Object.values(thumbnails)[0] : undefined);
    const image = thumbEntry
      ? {
          defaultPath: thumbEntry.defaultPath,
          width: thumbEntry.width,
          height: thumbEntry.height,
          sources: thumbEntry.sources.map((source) => ({ format: source.format, path: source.path })),
        }
      : undefined;
    const originalPath = encodeForMediaPath(file.pathSegments);
    const fullEntry = thumbnails?.full;
    const fullImage = fullEntry
      ? {
          defaultPath: fullEntry.defaultPath,
          width: fullEntry.width ?? meta?.width,
          height: fullEntry.height ?? meta?.height,
          sources: fullEntry.sources.map((source) => ({ format: source.format, path: source.path })),
        }
      : undefined;
    const fullPath = fullEntry?.defaultPath ? `/api/media${fullEntry.defaultPath}` : `/api/media/${originalPath}`;

    return {
      id: file.href,
      label: file.displayName,
      mediaPath: originalPath,
      href: fullPath,
      image,
      fullImage,
      description: meta?.description,
      attributes: meta?.attributes,
      tags: meta?.tags,
      meta: meta
        ? {
            width: meta.width,
            height: meta.height,
            orientation: meta.orientation,
            createdAt: meta.createdAt,
          }
        : undefined,
    };
  });

  const categoryItems = directories.map((dir) => ({
    label: dir.displayName,
    href: dir.href,
  }));

  const parentNode = selection.length === 0 ? null : selection.length === 1 ? tree : selection.at(-2);

  return (
    <NavigationScene
      root={{ label: tree.displayName, href: tree.href }}
      selected={selectedStack}
      categories={categoryItems}
      galleryItems={galleryItems}
      rootPreview={rootPreview}
      backHref={parentNode ? parentNode.href : null}
      pathKey={slug.join("/")}
    />
  );
}
