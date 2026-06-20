import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { sitesDir } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; path?: string[] }> }
) {
  const { slug: siteKey, path: pathSegments = [] } = await params;

  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(siteKey)) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!isSafePath(pathSegments)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const rootDir = path.join(sitesDir, siteKey, "current");
  const requestedPath = path.join(rootDir, ...pathSegments);
  const filePath = await resolveStaticFile(rootDir, requestedPath);

  if (!filePath) {
    return new NextResponse("Not found", { status: 404 });
  }

  const body = await fs.readFile(filePath);

  return new NextResponse(body, {
    headers: {
      "content-type": getContentType(filePath),
      "x-content-type-options": "nosniff"
    }
  });
}

async function resolveStaticFile(rootDir: string, requestedPath: string) {
  const normalizedPath = path.normalize(requestedPath);

  if (normalizedPath !== rootDir && !normalizedPath.startsWith(`${rootDir}${path.sep}`)) {
    return null;
  }

  const directFile = await statFile(normalizedPath);

  if (directFile === "file") {
    return normalizedPath;
  }

  if (directFile === "directory") {
    const indexPath = path.join(normalizedPath, "index.html");
    if ((await statFile(indexPath)) === "file") {
      return indexPath;
    }
  }

  const fallbackPath = path.join(rootDir, "index.html");
  if ((await statFile(fallbackPath)) === "file") {
    return fallbackPath;
  }

  return null;
}

async function statFile(filePath: string) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() ? "file" : stat.isDirectory() ? "directory" : "other";
  } catch {
    return null;
  }
}

function isSafePath(pathSegments: string[]) {
  return pathSegments.every(
    (segment) => segment && segment !== "." && segment !== ".." && !segment.includes("\0")
  );
}

function getContentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".wasm":
      return "application/wasm";
    default:
      return "application/octet-stream";
  }
}
