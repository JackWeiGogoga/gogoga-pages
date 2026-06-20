import fs from "node:fs/promises";
import path from "node:path";

export type GogogaClientOptions = {
  baseUrl?: string;
  token?: string;
  fetchImpl?: typeof fetch;
};

export type Project = {
  id: string;
  name: string;
  slug: string;
  siteKey: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  latestDeployment: Deployment | null;
};

export type Deployment = {
  id: string;
  projectId: string;
  status: string;
  storagePath: string;
  fileCount: number;
  totalBytes: number;
  error: string | null;
  createdAt: string;
  activatedAt: string | null;
};

export type DeployOptions = {
  mode?: "replace" | "merge";
  removePaths?: string[];
};

export type DeploymentWithProject = Deployment & {
  project: Project;
  url: string;
};

export class GogogaPagesClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GogogaClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? process.env.GOGOGA_BASE_URL ?? "https://app.pages.gogoga.top");
    this.token = options.token ?? process.env.GOGOGA_API_TOKEN;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async listProjects() {
    return this.request<{ projects: Project[] }>("/api/projects");
  }

  async createProject(input: { name: string; slug?: string }) {
    return this.request<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify(input),
      headers: { "content-type": "application/json" }
    });
  }

  async listDeployments(projectId: string) {
    return this.request<{ deployments: Deployment[] }>(`/api/projects/${projectId}/deployments`);
  }

  async deployFiles(projectId: string, filePaths: string[], options: DeployOptions = {}) {
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

    return this.request<Deployment>(`/api/projects/${projectId}/deployments`, {
      method: "POST",
      body: formData
    });
  }

  async deployFilesWithProject(projectId: string, filePaths: string[], options: DeployOptions = {}) {
    const deployment = await this.deployFiles(projectId, filePaths, options);
    const project = await this.getProjectById(projectId);

    return {
      ...deployment,
      project,
      url: project.url
    } satisfies DeploymentWithProject;
  }

  async rollbackDeployment(projectId: string, deploymentId: string) {
    return this.request<Deployment>(`/api/projects/${projectId}/deployments/${deploymentId}/rollback`, {
      method: "POST"
    });
  }

  async getProjectById(projectId: string) {
    const { projects } = await this.listProjects();
    const project = projects.find((item) => item.id === projectId);

    if (!project) {
      throw new Error(`Project "${projectId}" was not found`);
    }

    return project;
  }

  private async request<T>(pathname: string, init: RequestInit = {}): Promise<T> {
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

    return data as T;
  }
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function parseJsonResponse(text: string, response: Response) {
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
