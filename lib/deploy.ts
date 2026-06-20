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

type DeployMode = "replace" | "merge";

type DeploymentManifest = {
  kind: "html" | "zip";
  generatedIndex: boolean;
  files: Array<{
    originalName: string;
    path: string;
    href: string;
    bytes: number;
    removable: boolean;
  }>;
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

export async function deployStaticFiles(
  projectId: string,
  files: File[],
  options: { mode?: DeployMode; removePaths?: string[] } = {}
) {
  const removePaths = options.removePaths ?? [];

  if (files.length === 0 && removePaths.length === 0) {
    throw new Error("请上传 zip 或 html 文件");
  }

  const mode = options.mode ?? "replace";
  const zipFiles = files.filter((file) => isZipFile(file));
  const htmlFiles = files.filter((file) => isHtmlFile(file));

  if (mode === "merge" && zipFiles.length > 0) {
    throw new Error("增量新增只支持 html 文件，zip 只能完整替换部署");
  }

  if (mode !== "merge" && removePaths.length > 0) {
    throw new Error("移除文件只能在增量模式下使用");
  }

  if (zipFiles.length === 1 && files.length === 1) {
    return deployFiles(projectId, files, "zip", mode);
  }

  if (zipFiles.length > 0) {
    throw new Error("zip 部署一次只能上传一个文件，不能和 html 混合上传");
  }

  if (htmlFiles.length !== files.length) {
    throw new Error("只支持 .zip、.html 或 .htm 文件");
  }

  return deployFiles(projectId, files, "html", mode, removePaths);
}

export async function deployStaticFile(projectId: string, file: File) {
  return deployStaticFiles(projectId, [file]);
}

async function deployFiles(
  projectId: string,
  files: File[],
  kind: "zip" | "html",
  mode: DeployMode,
  removePaths: string[] = []
) {
  const totalUploadBytes = files.reduce((sum, file) => sum + file.size, 0);

  if (totalUploadBytes > maxUploadBytes) {
    throw new Error(`上传文件总大小不能超过 ${Math.round(maxUploadBytes / 1024 / 1024)}MB`);
  }

  if (kind === "html" && files.length > MAX_FILES) {
    throw new Error(`部署文件数量不能超过 ${MAX_FILES}`);
  }

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      deployments: {
        where: {
          status: "ready",
          activatedAt: { not: null }
        },
        orderBy: { activatedAt: "desc" },
        take: 1
      }
    }
  });
  const activeDeployment = project.deployments[0];

  if (mode === "merge" && !activeDeployment) {
    throw new Error("当前项目还没有可增量更新的已激活部署");
  }

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
    if (mode === "merge" && activeDeployment) {
      await fs.cp(activeDeployment.storagePath, targetDir, {
        recursive: true,
        force: true,
        errorOnExist: false
      });
    } else {
      await fs.mkdir(targetDir, { recursive: true });
    }

    const previousManifest =
      mode === "merge" && activeDeployment ? await readDeploymentManifest(activeDeployment.storagePath) : null;
    let manifest: DeploymentManifest;

    if (kind === "zip") {
      await extractZipSafely(uploadPath!, targetDir);
      manifest = {
        kind: "zip",
        generatedIndex: false,
        files: [
          {
            originalName: files[0].name,
            path: files[0].name,
            href: "/",
            bytes: files[0].size,
            removable: false
          }
        ]
      };
    } else {
      manifest =
        mode === "merge" && previousManifest
          ? previousManifest
          : {
              kind: "html",
              generatedIndex: false,
              files: []
            };

      if (mode === "merge" && removePaths.length > 0) {
        await removePublishedHtmlFiles(targetDir, removePaths);
        manifest.files = manifest.files.filter((file) => !removePaths.includes(file.path));
      }

      const publishResult = await publishHtmlFiles(files, targetDir, {
        singleHtmlAsRoot: mode === "replace"
      });

      manifest = mergeHtmlManifest(manifest, publishResult.manifest);

      if (await shouldRegenerateIndex(targetDir, manifest, previousManifest)) {
        await writeGeneratedIndex(targetDir, manifest.files);
        manifest.generatedIndex = true;
      }
    }

    await assertIndexExists(targetDir);
    const result = await countPublishedFiles(targetDir);
    await writeDeploymentManifest(targetDir, manifest);
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
    await fs.rm(getManifestPath(targetDir), { force: true });
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

async function publishHtmlFiles(
  files: File[],
  targetDir: string,
  options: { singleHtmlAsRoot?: boolean } = {}
): Promise<ExtractResult & { manifest: DeploymentManifest }> {
  if (files.length === 1) {
    const bytes = Buffer.from(await files[0].arrayBuffer());
    const outputPath = options.singleHtmlAsRoot
      ? path.join(targetDir, "index.html")
      : getHtmlOutputPath(files[0].name, targetDir, new Set(), 0);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, bytes, { mode: 0o644 });
    const relativePath = path.relative(targetDir, outputPath).replace(/\\/g, "/");

    return {
      fileCount: 1,
      totalBytes: bytes.byteLength,
      manifest: {
        kind: "html",
        generatedIndex: false,
        files: [
          {
            originalName: files[0].name,
            path: relativePath,
            href: htmlPathToHref(relativePath),
            bytes: bytes.byteLength,
            removable: relativePath !== "index.html"
          }
        ]
      }
    };
  }

  let totalBytes = 0;
  let hasRootIndex = false;
  const usedSlugs = new Set<string>();
  const manifest: DeploymentManifest = {
    kind: "html",
    generatedIndex: false,
    files: []
  };

  for (const [index, file] of files.entries()) {
    const bytes = Buffer.from(await file.arrayBuffer());
    totalBytes += bytes.byteLength;

    if (totalBytes > MAX_EXTRACTED_BYTES) {
      throw new Error("HTML 文件总大小超过限制");
    }

    const outputPath = getHtmlOutputPath(file.name, targetDir, usedSlugs, index);

    if (outputPath === path.join(targetDir, "index.html")) {
      hasRootIndex = true;
    }

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, bytes, { mode: 0o644 });
    const relativePath = path.relative(targetDir, outputPath).replace(/\\/g, "/");

    manifest.files.push({
      originalName: file.name,
      path: relativePath,
      href: htmlPathToHref(relativePath),
      bytes: bytes.byteLength,
      removable: relativePath !== "index.html"
    });
  }

  if (!hasRootIndex) {
    const generatedIndex = await writeGeneratedIndex(targetDir, manifest.files);
    totalBytes += generatedIndex.byteLength;
    manifest.generatedIndex = true;
  }

  return {
    fileCount: hasRootIndex ? files.length : files.length + 1,
    totalBytes,
    manifest
  };
}

async function countPublishedFiles(rootDir: string): Promise<ExtractResult> {
  let fileCount = 0;
  let totalBytes = 0;

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile()) {
        const stat = await fs.stat(entryPath);
        fileCount += 1;
        totalBytes += stat.size;
      }
    }
  }

  await walk(rootDir);
  return { fileCount, totalBytes };
}

export type PublishedHtmlFile = {
  path: string;
  href: string;
  title: string;
  originalName: string;
  bytes: number;
  removable: boolean;
  sourceKind: "html" | "zip";
};

export async function listPublishedHtmlFiles(rootDir: string): Promise<PublishedHtmlFile[]> {
  const manifest = await readDeploymentManifest(rootDir);

  if (manifest) {
    return manifest.files
      .filter((file) => manifest.kind === "zip" || file.path !== "index.html")
      .map((file) => ({
        path: file.path,
        href: file.href,
        title: file.originalName,
        originalName: file.originalName,
        bytes: file.bytes,
        removable: manifest.kind === "html" && file.removable,
        sourceKind: manifest.kind
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  const files: PublishedHtmlFile[] = [];

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }

      if (!entry.isFile() || !isHtmlFileName(entry.name)) {
        continue;
      }

      const relativePath = path.relative(rootDir, entryPath).replace(/\\/g, "/");

      if (relativePath === "index.html") {
        continue;
      }

      const stat = await fs.stat(entryPath);

      files.push({
        path: relativePath,
        href: htmlPathToHref(relativePath),
        title: htmlPathToTitle(relativePath),
        originalName: htmlPathToTitle(relativePath),
        bytes: stat.size,
        removable: relativePath !== "index.html",
        sourceKind: "html"
      });
    }
  }

  await walk(rootDir);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function removePublishedHtmlFiles(rootDir: string, relativePaths: string[]) {
  for (const relativePath of relativePaths) {
    if (!isSafeHtmlRelativePath(relativePath)) {
      throw new Error(`非法 HTML 文件路径：${relativePath}`);
    }

    const targetPath = path.join(rootDir, relativePath);

    if (!targetPath.startsWith(`${rootDir}${path.sep}`)) {
      throw new Error(`非法 HTML 文件路径：${relativePath}`);
    }

    await fs.rm(targetPath, { force: true });
    await removeEmptyParents(path.dirname(targetPath), rootDir);
  }
}

async function removeEmptyParents(dir: string, rootDir: string) {
  let currentDir = dir;

  while (currentDir.startsWith(`${rootDir}${path.sep}`)) {
    const entries = await fs.readdir(currentDir).catch(() => []);

    if (entries.length > 0) {
      return;
    }

    await fs.rmdir(currentDir).catch(() => undefined);
    currentDir = path.dirname(currentDir);
  }
}

function mergeHtmlManifest(
  currentManifest: DeploymentManifest,
  nextManifest: DeploymentManifest
): DeploymentManifest {
  const fileMap = new Map(currentManifest.files.map((file) => [file.path, file]));

  for (const file of nextManifest.files) {
    fileMap.set(file.path, file);
  }

  return {
    kind: "html",
    generatedIndex: currentManifest.generatedIndex || nextManifest.generatedIndex,
    files: [...fileMap.values()].sort((a, b) => a.path.localeCompare(b.path))
  };
}

async function shouldRegenerateIndex(
  targetDir: string,
  manifest: DeploymentManifest,
  previousManifest: DeploymentManifest | null
) {
  if (manifest.kind !== "html") {
    return false;
  }

  const hasUploadedIndex = manifest.files.some((file) => file.path === "index.html");

  if (hasUploadedIndex) {
    return false;
  }

  if (manifest.generatedIndex || previousManifest?.generatedIndex) {
    return true;
  }

  return isGeneratedIndex(path.join(targetDir, "index.html"));
}

async function writeGeneratedIndex(targetDir: string, files: DeploymentManifest["files"]) {
  const pages = files
    .filter((file) => file.path !== "index.html" && file.href !== "/")
    .map((file) => ({
      title: file.originalName,
      href: file.href
    }));
  const generatedIndex = Buffer.from(renderGeneratedIndex(pages));

  await fs.writeFile(path.join(targetDir, "index.html"), generatedIndex, { mode: 0o644 });
  return generatedIndex;
}

async function isGeneratedIndex(indexPath: string) {
  const html = await fs.readFile(indexPath, "utf8").catch(() => "");
  return html.includes("<title>Pages</title>") && html.includes("<h1>Pages</h1>");
}

function getManifestPath(targetDir: string) {
  return `${targetDir}.manifest.json`;
}

async function readDeploymentManifest(targetDir: string): Promise<DeploymentManifest | null> {
  const raw = await fs.readFile(getManifestPath(targetDir), "utf8").catch(() => null);

  if (!raw) {
    return null;
  }

  try {
    const manifest = JSON.parse(raw) as DeploymentManifest;

    if (
      (manifest.kind === "html" || manifest.kind === "zip") &&
      typeof manifest.generatedIndex === "boolean" &&
      Array.isArray(manifest.files)
    ) {
      return manifest;
    }
  } catch {
    return null;
  }

  return null;
}

async function writeDeploymentManifest(targetDir: string, manifest: DeploymentManifest) {
  await fs.writeFile(getManifestPath(targetDir), JSON.stringify(manifest, null, 2), {
    mode: 0o600
  });
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
  return isHtmlFileName(file.name);
}

function isHtmlFileName(fileName: string) {
  const normalizedFileName = fileName.toLowerCase();
  return normalizedFileName.endsWith(".html") || normalizedFileName.endsWith(".htm");
}

function isSafeHtmlRelativePath(relativePath: string) {
  if (!relativePath || relativePath.startsWith("/") || relativePath.includes("\0")) {
    return false;
  }

  const normalized = relativePath.replace(/\\/g, "/");
  const parts = normalized.split("/");

  return (
    isHtmlFileName(normalized) &&
    parts.every((part) => part !== "" && part !== "." && part !== "..")
  );
}

function htmlPathToHref(relativePath: string) {
  if (relativePath === "index.html") {
    return "/";
  }

  if (relativePath.endsWith("/index.html")) {
    return `/${relativePath.slice(0, -"index.html".length)}`;
  }

  return `/${relativePath}`;
}

function htmlPathToTitle(relativePath: string) {
  if (relativePath === "index.html") {
    return "Home";
  }

  const directoryName = path.dirname(relativePath);
  const baseName = path.basename(relativePath, path.extname(relativePath));
  return baseName === "index" ? directoryName : baseName;
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
