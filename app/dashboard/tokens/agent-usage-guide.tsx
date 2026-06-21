"use client";

import { useMemo, useState } from "react";
import { BookOpen, Check, Copy, Network, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

type UsageItem = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  code: string;
};

export function AgentUsageGuide({ baseUrl }: { baseUrl: string }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const items = useMemo<UsageItem[]>(
    () => [
      {
        id: "cli",
        title: "CLI",
        description: "适合本地终端、CI/CD，以及只能执行 shell 命令的 agent。",
        icon: Terminal,
        code: `npm install -g @gogoga/pages-cli

gogoga login --base-url "${baseUrl}"

gogoga projects list
gogoga deploy ./dist --project <project-id-or-slug>`
      },
      {
        id: "mcp",
        title: "MCP",
        description: "适合 Codex、Claude Code 等支持 MCP 的 agent，参数更结构化。",
        icon: Network,
        code: `codex mcp add gogoga-pages \\
  -- npx -y @gogoga/pages-mcp`
      },
      {
        id: "skill",
        title: "Skill",
        description: "把 Gogoga Pages 的部署流程固化成 agent 可复用的工作流。",
        icon: BookOpen,
        code: `mkdir -p .agents/skills
cp -R packages/agent-skill .agents/skills/gogoga-pages

# 然后在 Codex 中使用：
# $gogoga-pages deploy this static site`
      }
    ],
    [baseUrl]
  );

  async function copyCode(item: UsageItem) {
    await navigator.clipboard.writeText(item.code);
    setCopiedId(item.id);
  }

  return (
    <div className="grid divide-y">
      <div className="grid gap-3 p-4 text-sm text-muted-foreground md:grid-cols-3">
        <div>
          <span className="font-medium text-foreground">1. 创建 token</span>
          <span className="mt-1 block">完整值只显示一次，复制后通过 `gogoga login` 保存。</span>
        </div>
        <div>
          <span className="font-medium text-foreground">2. 选择入口</span>
          <span className="mt-1 block">CLI 用于命令行，MCP 用于结构化 agent 工具调用。</span>
        </div>
        <div>
          <span className="font-medium text-foreground">3. 最小权限</span>
          <span className="mt-1 block">为不同设备或 agent 创建独立 token，失效时单独撤销。</span>
        </div>
      </div>

      <div className="grid divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
        {items.map((item) => {
          const Icon = item.icon;
          const copied = copiedId === item.id;

          return (
            <section className="grid min-w-0 gap-3 p-4" key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium">{item.title}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <Button onClick={() => copyCode(item)} size="sm" type="button" variant="outline">
                  {copied ? <Check className="mr-2 h-3.5 w-3.5" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
                  {copied ? "已复制" : "复制"}
                </Button>
              </div>

              <pre className="max-h-56 overflow-auto rounded-md border bg-muted/30 p-3 text-xs leading-5">
                <code>{item.code}</code>
              </pre>
            </section>
          );
        })}
      </div>
    </div>
  );
}
