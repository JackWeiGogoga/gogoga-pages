import fs from "node:fs/promises";
import path from "node:path";

export class GogogaPagesClient {
  constructor(options = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? process.env.GOGOGA_BASE_URL ?? "https://app.pages.gogoga.top");
    this.token = options.token ?? process.env.GOGOGA_API_TOKEN;
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
      throw new Error("Missing GOGOGA_API_TOKEN");
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
