import path from "node:path";

export const siteDomain = process.env.GOGOGA_SITE_DOMAIN ?? "pages.gogoga.top";
export const maxUploadBytes =
  Number(process.env.GOGOGA_MAX_UPLOAD_MB ?? "100") * 1024 * 1024;

const dataRoot = process.env.GOGOGA_DATA_DIR ?? ".local-data";

export const dataDir = path.isAbsolute(dataRoot)
  ? dataRoot
  : path.join(process.cwd(), dataRoot);

export const uploadsDir = path.join(dataDir, "uploads");
export const deploymentsDir = path.join(dataDir, "deployments");
export const sitesDir = path.join(dataDir, "sites");
