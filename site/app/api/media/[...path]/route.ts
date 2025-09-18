import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import mime from "mime-types";

const MEDIA_ROOT = path.resolve(process.cwd(), "..", "medias");
const THUMBNAILS_ROOT = path.resolve(process.cwd(), "..", "thumbnails");

export async function GET(
  _request: Request,
  { params }: { params: { path: string[] } }
) {
  const requestedSegments = params.path ?? [];
  const [rootSegment, ...rest] = requestedSegments;
  const isThumbnailRequest = rootSegment === "thumbnails";
  const base = isThumbnailRequest ? THUMBNAILS_ROOT : MEDIA_ROOT;
  const segments = isThumbnailRequest ? rest : requestedSegments;

  if (segments.length === 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const targetPath = path.resolve(base, ...segments);

    if (!targetPath.startsWith(base)) {
      return new NextResponse("Not found", { status: 404 });
    }

    const stats = await fs.stat(targetPath);
    if (!stats.isFile()) {
      return new NextResponse("Not found", { status: 404 });
    }

    const file = await fs.readFile(targetPath);
    const arrayBuffer = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength
    ) as ArrayBuffer;
    const contentType = mime.lookup(targetPath) || "application/octet-stream";

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch (error) {
    console.error("Failed to serve media", error);
    return new NextResponse("Not found", { status: 404 });
  }
}
