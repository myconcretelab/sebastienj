import { notFound } from "next/navigation";

import { NavigationScene } from "@/components/NavigationScene";
import {
  encodeForMediaPath,
  findNodeByPath,
  getMediaTree,
  type MediaNode,
} from "@/lib/mediaTree";

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
  const tree = await getMediaTree();

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

  const galleryItems = files.map((file) => ({
    id: file.href,
    label: file.displayName,
    mediaPath: encodeForMediaPath(file.pathSegments),
  }));

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
