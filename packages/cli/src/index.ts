#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createWriteStream } from "node:fs";
import readline from "node:readline";
import yazl from "yazl";
import {
  clearGogogaConfig,
  getGogogaConfigPath,
  GogogaPagesClient,
  loadGogogaConfig,
  saveGogogaConfig
} from "@gogoga/pages-sdk";

type ParsedArgs = {
  command: string[];
  flags: Record<string, string | boolean | string[]>;
  positionals: string[];
};

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const [resource, action] = parsed.command;

  if (!resource || resource === "help" || hasFlag(parsed, "help")) {
    printHelp();
    return;
  }

  if (resource === "login") {
    await login(parsed);
    return;
  }

  if (resource === "logout") {
    await clearGogogaConfig();
    console.log(`Logged out. Removed ${getGogogaConfigPath()}`);
    return;
  }

  if (resource === "auth" && action === "status") {
    printAuthStatus();
    return;
  }

  const client = new GogogaPagesClient({
    baseUrl: stringFlag(parsed, "base-url"),
    token: stringFlag(parsed, "token")
  });

  if (resource === "projects" && action === "list") {
    const { projects } = await client.listProjects();
    console.log(JSON.stringify(projects, null, 2));
    return;
  }

  if (resource === "projects" && action === "create") {
    const name = parsed.positionals[0] ?? stringFlag(parsed, "name");

    if (!name) {
      throw new Error("Project name is required");
    }

    const project = await client.createProject({ name, slug: stringFlag(parsed, "slug") });
    console.log(JSON.stringify(project, null, 2));
    return;
  }

  if (resource === "deploy") {
    const inputPath = parsed.positionals[0];
    const projectRef = stringFlag(parsed, "project");

    if (!inputPath) {
      throw new Error("Deploy path is required");
    }

    if (!projectRef) {
      throw new Error("--project is required");
    }

    const projectId = await resolveProjectId(client, projectRef);
    const prepared = await prepareDeployInput(inputPath);
    try {
      const deployment = await client.deployFilesWithProject(projectId, [prepared.path], {
        mode: stringFlag(parsed, "mode") === "merge" ? "merge" : "replace",
        removePaths: arrayFlag(parsed, "remove-path")
      });
      console.log(JSON.stringify(deployment, null, 2));
    } finally {
      if (prepared.cleanup) {
        await fs.rm(prepared.path, { force: true });
      }
    }
    return;
  }

  if (resource === "deployments" && action === "list") {
    const projectRef = stringFlag(parsed, "project");

    if (!projectRef) {
      throw new Error("--project is required");
    }

    const projectId = await resolveProjectId(client, projectRef);
    const { deployments } = await client.listDeployments(projectId);
    console.log(JSON.stringify(deployments, null, 2));
    return;
  }

  if (resource === "rollback") {
    const projectRef = stringFlag(parsed, "project");
    const deploymentId = stringFlag(parsed, "deployment") ?? parsed.positionals[0];

    if (!projectRef) {
      throw new Error("--project is required");
    }

    if (!deploymentId) {
      throw new Error("--deployment is required");
    }

    const projectId = await resolveProjectId(client, projectRef);
    const deployment = await client.rollbackDeployment(projectId, deploymentId);
    console.log(JSON.stringify(deployment, null, 2));
    return;
  }

  throw new Error(`Unknown command: ${[resource, action].filter(Boolean).join(" ")}`);
}

async function login(parsed: ParsedArgs) {
  const currentConfig = loadGogogaConfig();
  const defaultBaseUrl =
    stringFlag(parsed, "base-url") ??
    process.env.GOGOGA_BASE_URL ??
    currentConfig.baseUrl ??
    "https://app.pages.gogoga.top";
  const baseUrl = defaultBaseUrl.replace(/\/+$/, "");
  const token = stringFlag(parsed, "token") ?? (await promptHidden("API token: "));

  if (!token) {
    throw new Error("API token is required");
  }

  if (!hasFlag(parsed, "no-verify")) {
    const client = new GogogaPagesClient({ baseUrl, token });
    await client.listProjects();
  }

  await saveGogogaConfig({ baseUrl, token });
  console.log(`Logged in to ${baseUrl}`);
  console.log(`Credentials saved to ${getGogogaConfigPath()}`);
}

function printAuthStatus() {
  const config = loadGogogaConfig();
  const envBaseUrl = process.env.GOGOGA_BASE_URL;
  const envToken = process.env.GOGOGA_API_TOKEN;
  const baseUrl = envBaseUrl ?? config.baseUrl ?? "https://app.pages.gogoga.top";
  const token = envToken ?? config.token;
  const source = envToken || envBaseUrl ? "environment" : config.token || config.baseUrl ? "login config" : "default";

  console.log(JSON.stringify({
    authenticated: Boolean(token),
    baseUrl,
    source,
    configPath: getGogogaConfigPath(),
    tokenPrefix: token ? `${token.slice(0, 8)}...` : null,
    updatedAt: config.updatedAt ?? null
  }, null, 2));
}

async function prepareDeployInput(inputPath: string) {
  const absolutePath = path.resolve(inputPath);
  const stat = await fs.stat(absolutePath);

  if (stat.isDirectory()) {
    const zipPath = path.join(os.tmpdir(), `gogoga-pages-${Date.now()}.zip`);
    await zipDirectory(absolutePath, zipPath);
    return { path: zipPath, cleanup: true };
  }

  return { path: absolutePath, cleanup: false };
}

async function resolveProjectId(client: GogogaPagesClient, projectRef: string) {
  const { projects } = await client.listProjects();
  const matches = projects.filter(
    (project) => project.id === projectRef || project.slug === projectRef || project.name === projectRef
  );

  if (matches.length === 1) {
    return matches[0].id;
  }

  if (matches.length > 1) {
    throw new Error(`Multiple projects match "${projectRef}". Use the project id instead.`);
  }

  throw new Error(`Project "${projectRef}" was not found. Run "gogoga projects list" to see available projects.`);
}

async function zipDirectory(sourceDir: string, targetPath: string) {
  const zipFile = new yazl.ZipFile();
  const output = createWriteStream(targetPath);
  const done = new Promise<void>((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
    zipFile.outputStream.on("error", reject);
  });

  zipFile.outputStream.pipe(output);
  await addDirectoryToZip(zipFile, sourceDir, "");
  zipFile.end();
  await done;
}

async function addDirectoryToZip(zipFile: yazl.ZipFile, sourceDir: string, relativeDir: string) {
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

function parseArgs(args: string[]): ParsedArgs {
  const command = getCommand(args);
  const positionals: string[] = [];
  const flags: ParsedArgs["flags"] = {};

  for (let index = command.length; index < args.length; index += 1) {
    const arg = args[index];

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[index + 1];
      const value = !next || next.startsWith("--") ? true : next;

      if (value !== true) {
        index += 1;
      }

      const previous = flags[key];
      if (previous === undefined) {
        flags[key] = value;
      } else if (Array.isArray(previous)) {
        previous.push(String(value));
      } else {
        flags[key] = [String(previous), String(value)];
      }
      continue;
    }

    positionals.push(arg);
  }

  return { command, flags, positionals };
}

function getCommand(args: string[]) {
  const [resource, action] = args;

  if (resource === "projects" || resource === "deployments" || resource === "auth") {
    return action ? [resource, action] : [resource];
  }

  return resource ? [resource] : [];
}

function stringFlag(parsed: ParsedArgs, name: string) {
  const value = parsed.flags[name];
  return typeof value === "string" ? value : undefined;
}

function arrayFlag(parsed: ParsedArgs, name: string) {
  const value = parsed.flags[name];

  if (Array.isArray(value)) {
    return value;
  }

  return typeof value === "string" ? [value] : [];
}

function hasFlag(parsed: ParsedArgs, name: string) {
  return Boolean(parsed.flags[name]);
}

function promptHidden(question: string) {
  return new Promise<string>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: true
    });
    const mutableRl = rl as unknown as {
      _writeToOutput: (value: string) => void;
    };
    let muted = false;

    mutableRl._writeToOutput = (value: string) => {
      process.stderr.write(muted ? "*" : value);
    };

    rl.question(question, (answer) => {
      rl.close();
      process.stderr.write("\n");
      resolve(answer.trim());
    });
    muted = true;
  });
}

function printHelp() {
  console.log(`Gogoga Pages CLI

Usage:
  gogoga login [--token TOKEN] [--no-verify]
  gogoga logout
  gogoga auth status
  gogoga projects list [--base-url URL] [--token TOKEN]
  gogoga projects create <name> [--slug slug]
  gogoga deploy <file-or-dir> --project <project-id|slug|name> [--mode replace|merge]
  gogoga deployments list --project <project-id|slug|name>
  gogoga rollback --project <project-id|slug|name> --deployment <deployment-id>

Environment:
  GOGOGA_API_TOKEN   Optional override for CI or temporary sessions
  GOGOGA_BASE_URL    Optional advanced override; defaults to https://app.pages.gogoga.top
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
