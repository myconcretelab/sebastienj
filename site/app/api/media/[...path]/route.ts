import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import mime from "mime-types";

const MEDIA_ROOT = path.resolve(process.cwd(), "..", "medias");

export async function GET(
  _request: Request,
  { params }: { params: { path: string[] } }
) {
  const requestedSegments = params.path ?? [];
  const targetPath = path.join(MEDIA_ROOT, ...requestedSegments);
  const normalized = path.normalize(targetPath);

  if (!normalized.startsWith(MEDIA_ROOT)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const stats = await fs.stat(normalized);
    if (!stats.isFile()) {
      return new NextResponse("Not found", { status: 404 });
    }

    const file = await fs.readFile(normalized);
    const arrayBuffer = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength
    ) as ArrayBuffer;
    const contentType = mime.lookup(normalized) || "application/octet-stream";

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
