import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export class GogogaPagesClient {
  constructor(options = {}) {
    const storedConfig = loadGogogaConfig();
    this.baseUrl = normalizeBaseUrl(
      options.baseUrl ?? process.env.GOGOGA_BASE_URL ?? storedConfig.baseUrl ?? "https://app.pages.gogoga.top"
    );
    this.token = options.token ?? process.env.GOGOGA_API_TOKEN ?? storedConfig.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async listProjects() {
    return this.request("/api/projects");
  }

  async createProject(input) {
    return this.request("/api/projects", {
      method: "POST",
      body: JSON.stringify(input),
      headers: { "content-type": "application/json" }
    });
  }

  async listDeployments(projectId) {
    return this.request(`/api/projects/${projectId}/deployments`);
  }

  async deployFiles(projectId, filePaths, options = {}) {
    const formData = new FormData();

    for (const filePath of filePaths) {
      const bytes = await fs.readFile(filePath);
      const fileName = path.basename(filePath);
      formData.append("file", new Blob([bytes]), fileName);
    }

    if (options.mode) {
      formData.append("mode", options.mode);
    }

    for (const removePath of options.removePaths ?? []) {
      formData.append("removePath", removePath);
    }

    return this.request(`/api/projects/${projectId}/deployments`, {
      method: "POST",
      body: formData
    });
  }

  async deployFilesWithProject(projectId, filePaths, options = {}) {
    const deployment = await this.deployFiles(projectId, filePaths, options);
    const project = await this.getProjectById(projectId);

    return {
      ...deployment,
      project,
      url: project.url
    };
  }

  async rollbackDeployment(projectId, deploymentId) {
    return this.request(`/api/projects/${projectId}/deployments/${deploymentId}/rollback`, {
      method: "POST"
    });
  }

  async getProjectById(projectId) {
    const { projects } = await this.listProjects();
    const project = projects.find((item) => item.id === projectId);

    if (!project) {
      throw new Error(`Project "${projectId}" was not found`);
    }

    return project;
  }

  async request(pathname, init = {}) {
    if (!this.token) {
      throw new Error("Missing Gogoga API token. Run \"gogoga login\" or set GOGOGA_API_TOKEN.");
    }

    const response = await this.fetchImpl(`${this.baseUrl}${pathname}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.token}`,
        ...init.headers
      }
    });

    const text = await response.text();
    const data = parseJsonResponse(text, response);

    if (!response.ok) {
      throw new Error(data?.error ?? `Gogoga Pages API request failed with ${response.status}`);
    }

    return data;
  }
}

export function getGogogaConfigPath() {
  return path.join(process.env.GOGOGA_CONFIG_DIR ?? path.join(os.homedir(), ".config", "gogoga-pages"), "config.json");
}

export function loadGogogaConfig() {
  const configPath = getGogogaConfigPath();

  try {
    const raw = fsSync.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);

    return {
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : undefined,
      token: typeof parsed.token === "string" ? parsed.token : undefined,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined
    };
  } catch {
    return {};
  }
}

export async function saveGogogaConfig(config) {
  const configPath = getGogogaConfigPath();
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(
    configPath,
    `${JSON.stringify({ ...config, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    { mode: 0o600 }
  );
  await fs.chmod(configPath, 0o600).catch(() => undefined);
}

export async function clearGogogaConfig() {
  await fs.rm(getGogogaConfigPath(), { force: true });
}

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

function parseJsonResponse(text, response) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    const contentType = response.headers.get("content-type") ?? "unknown content type";
    const preview = text.replace(/\s+/g, " ").slice(0, 120);

    throw new Error(
      `Gogoga Pages API returned non-JSON response from ${response.url} (${response.status}, ${contentType}): ${preview}`
    );
  }
}
