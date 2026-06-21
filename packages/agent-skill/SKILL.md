---
name: gogoga-pages
description: Deploy, inspect, and roll back static sites on Gogoga Pages using the official MCP tools or CLI.
---

Use this skill when the user wants to deploy a static website to Gogoga Pages, list projects, inspect deployments, or roll back a Gogoga Pages deployment.

## Preferred Tooling

Prefer the Gogoga Pages MCP tools when available:

- `list_projects`
- `create_project`
- `deploy_static_site`
- `list_deployments`
- `rollback_deployment`

If MCP tools are unavailable, use the official CLI:

```bash
gogoga login
gogoga projects list
gogoga projects create <name>
gogoga deploy <file-or-dir> --project <project-id>
gogoga deployments list --project <project-id>
gogoga rollback --project <project-id> --deployment <deployment-id>
```

If neither MCP nor CLI is installed and the environment allows package installation, install the local stdio MCP server:

```bash
codex mcp add gogoga-pages -- npx -y @gogoga/pages-mcp
```

For CLI-only environments:

```bash
npm install -g @gogoga/pages-cli
```

## Authentication

Require a Gogoga API token before calling MCP or CLI commands. Do not invent tokens.

For local CLI usage, prefer:

```bash
gogoga login
```

Environment variables are acceptable for CI, temporary sessions, or MCP servers running in isolated environments:

```bash
export GOGOGA_BASE_URL="https://app.pages.gogoga.top"
export GOGOGA_API_TOKEN="ggp_xxx"
```

## Deployment Workflow

1. Identify or create the target project.
2. Build the user's static site when needed.
3. Deploy the output directory, zip file, or html file.
4. Verify the deployment by listing deployments.
5. Report the deployment id, status, and public project URL when available.

Use replace mode for normal full deployments. Use merge mode only when the user explicitly asks for incremental html updates.

## Safety

Do not roll back unless the user identifies the target deployment or clearly asks to restore the previous ready deployment.
Do not delete or remove published paths unless the user explicitly asks for incremental removal.
