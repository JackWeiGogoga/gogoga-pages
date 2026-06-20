#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import yazl from "yazl";
import { z } from "zod";
import { GogogaPagesClient } from "@gogoga/pages-sdk";

const client = new GogogaPagesClient();

const server = new McpServer({
  name: "gogoga-pages",
  version: "0.1.0"
});

server.tool("list_projects", "List Gogoga Pages projects for the authenticated user.", {}, async () => {
  const result = await client.listProjects();
  return jsonResult(result);
});

server.tool(
  "create_project",
  "Create a Gogoga Pages project.",
  {
    name: z.string().min(1).describe("Project display name."),
    slug: z.string().optional().describe("Optional URL slug.")
  },
  async ({ name, slug }) => {
    const result = await client.createProject({ name, slug });
    return jsonResult(result);
  }
);

server.tool(
  "deploy_static_site",
  "Deploy a local zip/html file or directory to a Gogoga Pages project.",
  {
    projectId: z.string().min(1).describe("Gogoga Pages project id."),
    inputPath: z.string().min(1).describe("Local file or directory path to deploy."),
    mode: z.enum(["replace", "merge"]).default("replace").describe("Deployment mode."),
    removePaths: z.array(z.string()).default([]).describe("Published html paths to remove in merge mode.")
  },
  async ({ projectId, inputPath, mode, removePaths }) => {
    const prepared = await prepareDeployInput(inputPath);

    try {
      const result = await client.deployFilesWithProject(projectId, [prepared.path], { mode, removePaths });
      return jsonResult(result);
    } finally {
      if (prepared.cleanup) {
        await fs.rm(prepared.path, { force: true });
      }
    }
  }
);

server.tool(
  "list_deployments",
  "List recent deployments for a Gogoga Pages project.",
  {
    projectId: z.string().min(1).describe("Gogoga Pages project id.")
  },
  async ({ projectId }) => {
    const result = await client.listDeployments(projectId);
    return jsonResult(result);
  }
);

server.tool(
  "rollback_deployment",
  "Roll back a Gogoga Pages project to a previous deployment.",
  {
    projectId: z.string().min(1).describe("Gogoga Pages project id."),
    deploymentId: z.string().min(1).describe("Deployment id to restore.")
  },
  async ({ projectId, deploymentId }) => {
    const result = await client.rollbackDeployment(projectId, deploymentId);
    return jsonResult(result);
  }
);

async function prepareDeployInput(inputPath) {
  const absolutePath = path.resolve(inputPath);
  const stat = await fs.stat(absolutePath);

  if (stat.isDirectory()) {
    const zipPath = path.join(os.tmpdir(), `gogoga-pages-${Date.now()}.zip`);
    await zipDirectory(absolutePath, zipPath);
    return { path: zipPath, cleanup: true };
  }

  return { path: absolutePath, cleanup: false };
}

async function zipDirectory(sourceDir, targetPath) {
  const zipFile = new yazl.ZipFile();
  const output = createWriteStream(targetPath);
  const done = new Promise((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
    zipFile.outputStream.on("error", reject);
  });

  zipFile.outputStream.pipe(output);
  await addDirectoryToZip(zipFile, sourceDir, "");
  zipFile.end();
  await done;
}

async function addDirectoryToZip(zipFile, sourceDir, relativeDir) {
  const entries = await fs.readdir(path.join(sourceDir, relativeDir), { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === ".DS_Store") {
      continue;
    }

    const relativePath = path.posix.join(relativeDir.split(path.sep).join(path.posix.sep), entry.name);
    const absolutePath = path.join(sourceDir, relativeDir, entry.name);

    if (entry.isDirectory()) {
      await addDirectoryToZip(zipFile, sourceDir, path.join(relativeDir, entry.name));
    } else if (entry.isFile()) {
      zipFile.addFile(absolutePath, relativePath);
    }
  }
}

function jsonResult(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

const transport = new StdioServerTransport();
await server.connect(transport);
