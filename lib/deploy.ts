import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import yauzl from "yauzl";
import { deploymentsDir, maxUploadBytes, sitesDir, uploadsDir } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { normalizeSlug } from "@/lib/slug";

const MAX_EXTRACTED_BYTES = maxUploadBytes * 3;
const MAX_FILES = 5000;

type ExtractResult = {
  fileCount: number;
  totalBytes: number;
};

export async function ensureStorageDirs() {
  await Promise.all([
    fs.mkdir(uploadsDir, { recursive: true }),
    fs.mkdir(deploymentsDir, { recursive: true }),
    fs.mkdir(sitesDir, { recursive: true })
  ]);
}

export async function writeUploadFile(file: File, deploymentId: string, extension: "zip" | "html") {
  await ensureStorageDirs();

  if (file.size > maxUploadBytes) {
    throw new Error(`上传文件不能超过 ${Math.round(maxUploadBytes / 1024 / 1024)}MB`);
  }

  const uploadPath = path.join(uploadsDir, `${deploymentId}.${extension}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(uploadPath, bytes);
  return uploadPath;
}

export async function deployStaticFiles(projectId: string, files: File[]) {
  if (files.length === 0) {
    throw new Error("请上传 zip 或 html 文件");
  }

  const zipFiles = files.filter((file) => isZipFile(file));
  const htmlFiles = files.filter((file) => isHtmlFile(file));

  if (zipFiles.length === 1 && files.length === 1) {
    return deployFiles(projectId, files, "zip");
  }

  if (zipFiles.length > 0) {
    throw new Error("zip 部署一次只能上传一个文件，不能和 html 混合上传");
  }

  if (htmlFiles.length !== files.length) {
    throw new Error("只支持 .zip、.html 或 .htm 文件");
  }

  return deployFiles(projectId, files, "html");
}

export async function deployStaticFile(projectId: string, file: File) {
  return deployStaticFiles(projectId, [file]);
}

async function deployFiles(projectId: string, files: File[], kind: "zip" | "html") {
  const totalUploadBytes = files.reduce((sum, file) => sum + file.size, 0);

  if (totalUploadBytes > maxUploadBytes) {
    throw new Error(`上传文件总大小不能超过 ${Math.round(maxUploadBytes / 1024 / 1024)}MB`);
  }

  if (kind === "html" && files.length > MAX_FILES) {
    throw new Error(`部署文件数量不能超过 ${MAX_FILES}`);
  }

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId }
  });

  const deployment = await prisma.deployment.create({
    data: {
      projectId: project.id,
      status: "uploading",
      storagePath: ""
    }
  });

  const targetDir = path.join(deploymentsDir, deployment.id);

  try {
    const uploadPath =
      kind === "zip" ? await writeUploadFile(files[0], deployment.id, "zip") : null;

    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: kind === "zip" ? "extracting" : "publishing", storagePath: targetDir }
    });

    await fs.rm(targetDir, { recursive: true, force: true });
    await fs.mkdir(targetDir, { recursive: true });

    const result =
      kind === "zip"
        ? await extractZipSafely(uploadPath!, targetDir)
        : await publishHtmlFiles(files, targetDir);

    await assertIndexExists(targetDir);
    await activateDeployment(project.slug, targetDir);

    return prisma.deployment.update({
      where: { id: deployment.id },
      data: {
        status: "ready",
        fileCount: result.fileCount,
        totalBytes: result.totalBytes,
        activatedAt: new Date()
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "部署失败";

    await fs.rm(targetDir, { recursive: true, force: true });
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: {
        status: "failed",
        error: message,
        storagePath: targetDir
      }
    });

    throw error;
  }
}

async function publishHtmlFiles(files: File[], targetDir: string): Promise<ExtractResult> {
  if (files.length === 1) {
    const bytes = Buffer.from(await files[0].arrayBuffer());
    await fs.writeFile(path.join(targetDir, "index.html"), bytes, { mode: 0o644 });

    return {
      fileCount: 1,
      totalBytes: bytes.byteLength
    };
  }

  let totalBytes = 0;
  let hasRootIndex = false;
  const usedSlugs = new Set<string>();
  const pages: Array<{ title: string; href: string }> = [];

  for (const [index, file] of files.entries()) {
    const bytes = Buffer.from(await file.arrayBuffer());
    totalBytes += bytes.byteLength;

    if (totalBytes > MAX_EXTRACTED_BYTES) {
      throw new Error("HTML 文件总大小超过限制");
    }

    const outputPath = getHtmlOutputPath(file.name, targetDir, usedSlugs, index);

    if (outputPath === path.join(targetDir, "index.html")) {
      hasRootIndex = true;
    } else {
      pages.push({
        title: path.basename(file.name, path.extname(file.name)),
        href: `/${path.relative(targetDir, path.dirname(outputPath)).replace(/\\/g, "/")}/`
      });
    }

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, bytes, { mode: 0o644 });
  }

  if (!hasRootIndex) {
    const generatedIndex = Buffer.from(renderGeneratedIndex(pages));
    await fs.writeFile(path.join(targetDir, "index.html"), generatedIndex, { mode: 0o644 });
    totalBytes += generatedIndex.byteLength;
  }

  return {
    fileCount: hasRootIndex ? files.length : files.length + 1,
    totalBytes
  };
}

export async function rollbackDeployment(projectId: string, deploymentId: string) {
  const deployment = await prisma.deployment.findFirstOrThrow({
    where: {
      id: deploymentId,
      projectId,
      status: "ready"
    },
    include: { project: true }
  });

  await assertIndexExists(deployment.storagePath);
  await activateDeployment(deployment.project.slug, deployment.storagePath);

  return prisma.deployment.update({
    where: { id: deployment.id },
    data: { activatedAt: new Date() }
  });
}

async function activateDeployment(slug: string, targetDir: string) {
  const siteDir = path.join(sitesDir, slug);
  const currentLink = path.join(siteDir, "current");
  const nextLink = path.join(siteDir, ".current-next");

  await fs.mkdir(siteDir, { recursive: true });
  await fs.rm(nextLink, { force: true });
  await fs.symlink(targetDir, nextLink, "dir");
  await fs.rename(nextLink, currentLink);
}

async function assertIndexExists(targetDir: string) {
  try {
    const stat = await fs.stat(path.join(targetDir, "index.html"));
    if (!stat.isFile()) {
      throw new Error("index.html 不是文件");
    }
  } catch {
    throw new Error("部署包根目录必须包含 index.html");
  }
}

async function extractZipSafely(zipPath: string, targetDir: string): Promise<ExtractResult> {
  const zip = await openZip(zipPath);

  if (!zip) {
    throw new Error("无法读取 zip 文件");
  }

  return new Promise((resolve, reject) => {
    let fileCount = 0;
    let totalBytes = 0;
    let rejected = false;

    const fail = (error: Error) => {
      if (!rejected) {
        rejected = true;
        zip.close();
        reject(error);
      }
    };

    zip.readEntry();

    zip.on("entry", (entry) => {
      if (rejected) {
        return;
      }

      const entryName = entry.fileName.replace(/\\/g, "/");

      if (!isSafeEntryName(entryName)) {
        fail(new Error(`非法文件路径：${entry.fileName}`));
        return;
      }

      if (/\/$/.test(entryName)) {
        fs.mkdir(path.join(targetDir, entryName), { recursive: true })
          .then(() => zip.readEntry())
          .catch(fail);
        return;
      }

      fileCount += 1;
      totalBytes += entry.uncompressedSize;

      if (fileCount > MAX_FILES) {
        fail(new Error(`部署文件数量不能超过 ${MAX_FILES}`));
        return;
      }

      if (totalBytes > MAX_EXTRACTED_BYTES) {
        fail(new Error("解压后文件体积超过限制"));
        return;
      }

      const outputPath = path.join(targetDir, entryName);

      if (!outputPath.startsWith(`${targetDir}${path.sep}`)) {
        fail(new Error(`非法文件路径：${entry.fileName}`));
        return;
      }

      zip.openReadStream(entry, (streamError, readStream) => {
        if (streamError || !readStream) {
          fail(streamError ?? new Error("读取 zip 条目失败"));
          return;
        }

        fs.mkdir(path.dirname(outputPath), { recursive: true })
          .then(
            () =>
              new Promise<void>((streamResolve, streamReject) => {
                const writeStream = createWriteStream(outputPath, { mode: 0o644 });
                readStream.pipe(writeStream);
                readStream.on("error", streamReject);
                writeStream.on("error", streamReject);
                writeStream.on("finish", streamResolve);
              })
          )
          .then(() => zip.readEntry())
          .catch(fail);
      });
    });

    zip.on("end", () => {
      if (!rejected) {
        resolve({ fileCount, totalBytes });
      }
    });

    zip.on("error", fail);
  });
}

function isSafeEntryName(entryName: string) {
  if (!entryName || entryName.startsWith("/") || entryName.includes("\0")) {
    return false;
  }

  const normalizedName = entryName.endsWith("/") ? entryName.slice(0, -1) : entryName;
  const parts = normalizedName.split("/");
  return parts.every((part) => part !== ".." && part !== "");
}

function getHtmlOutputPath(
  fileName: string,
  targetDir: string,
  usedSlugs: Set<string>,
  index: number
) {
  const baseName = path.basename(fileName, path.extname(fileName));

  if (baseName.toLowerCase() === "index") {
    return path.join(targetDir, "index.html");
  }

  const slug = uniqueSlug(normalizeSlug(baseName) || `page-${index + 1}`, usedSlugs);
  return path.join(targetDir, slug, "index.html");
}

function uniqueSlug(slug: string, usedSlugs: Set<string>) {
  let nextSlug = slug;
  let suffix = 2;

  while (usedSlugs.has(nextSlug) || nextSlug === "index") {
    nextSlug = `${slug}-${suffix}`;
    suffix += 1;
  }

  usedSlugs.add(nextSlug);
  return nextSlug;
}

function renderGeneratedIndex(pages: Array<{ title: string; href: string }>) {
  const links = pages
    .map(
      (page) =>
        `<li><a href="${escapeHtml(page.href)}">${escapeHtml(page.title || page.href)}</a></li>`
    )
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pages</title>
</head>
<body>
  <h1>Pages</h1>
  <ul>${links}</ul>
</body>
</html>
`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isZipFile(file: File) {
  return file.name.toLowerCase().endsWith(".zip");
}

function isHtmlFile(file: File) {
  const fileName = file.name.toLowerCase();
  return fileName.endsWith(".html") || fileName.endsWith(".htm");
}

function openZip(zipPath: string) {
  return new Promise<yauzl.ZipFile>((resolve, reject) => {
    yauzl.open(
      zipPath,
      { lazyEntries: true, validateEntrySizes: true },
      (error, zip) => {
        if (error || !zip) {
          reject(error ?? new Error("无法读取 zip 文件"));
          return;
        }

        resolve(zip);
      }
    );
  });
}
