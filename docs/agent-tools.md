# Agent Tools

Gogoga Pages provides three agent-facing surfaces:

- SDK: `@gogoga/pages-sdk`
- CLI: `@gogoga/pages-cli`
- MCP server: `@gogoga/pages-mcp`
- Agent skill: `packages/agent-skill/SKILL.md`

## 1. Create an API Token

Open the dashboard:

```text
/dashboard/tokens
```

Create a token and copy it immediately. The full token is shown only once.

Set it in your shell:

```bash
export GOGOGA_API_TOKEN="ggp_xxx"
export GOGOGA_BASE_URL="https://app.pages.gogoga.top"
```

For local testing:

```bash
export GOGOGA_BASE_URL="http://localhost:3000"
```

## 2. CLI

Install:

```bash
npm install -g @gogoga/pages-cli
```

List projects:

```bash
gogoga projects list
```

Create a project:

```bash
gogoga projects create "My Site" --slug my-site
```

Deploy a directory, zip file, or html file:

```bash
gogoga deploy ./dist --project my-site
gogoga deploy ./site.zip --project my-site
gogoga deploy ./index.html --project my-site
```

`--project` accepts project id, slug, or name. Deploy output includes the public URL.

List deployments:

```bash
gogoga deployments list --project my-site
```

Roll back:

```bash
gogoga rollback --project my-site --deployment <deployment-id>
```

## 3. MCP Server

The MCP server runs locally over stdio and calls the Gogoga Pages API with `GOGOGA_API_TOKEN`.

Codex setup:

```bash
codex mcp add gogoga-pages \
  --env GOGOGA_API_TOKEN=ggp_xxx \
  --env GOGOGA_BASE_URL=https://app.pages.gogoga.top \
  -- npx -y @gogoga/pages-mcp
```

Local development setup:

```bash
codex mcp add gogoga-pages-local \
  --env GOGOGA_API_TOKEN=ggp_xxx \
  --env GOGOGA_BASE_URL=http://localhost:3000 \
  -- node /path/to/gogoga-pages/packages/mcp/src/server.mjs
```

Available MCP tools:

```text
list_projects
create_project
deploy_static_site
list_deployments
rollback_deployment
```

## 4. Agent Skill

The skill lives at:

```text
packages/agent-skill/SKILL.md
```

For Codex local development, copy or symlink it into a scanned skill location:

```bash
mkdir -p .agents/skills
ln -s ../../packages/agent-skill .agents/skills/gogoga-pages
```

The skill tells agents to prefer MCP tools when available and fall back to the CLI when MCP is unavailable.

## 5. npm Publishing

Publish in dependency order:

```bash
npm publish -w @gogoga/pages-sdk --access public
npm publish -w @gogoga/pages-cli --access public
npm publish -w @gogoga/pages-mcp --access public
```

If npm returns `Scope not found`, create the `gogoga` npm organization first, or rename the packages to a scope owned by your npm account.
