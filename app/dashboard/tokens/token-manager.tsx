"use client";

import { useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ApiToken = {
  id: string;
  name: string;
  tokenPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

type CreatedToken = {
  token: string;
  apiToken: ApiToken;
};

const expirationOptions = [
  { label: "30 天", value: 30 },
  { label: "90 天", value: 90 },
  { label: "180 天", value: 180 },
  { label: "365 天", value: 365 },
];

export function TokenManager({ initialTokens }: { initialTokens: ApiToken[] }) {
  const [tokens, setTokens] = useState(initialTokens);
  const [name, setName] = useState("Agent token");
  const [expiresInDays, setExpiresInDays] = useState(180);
  const [createdToken, setCreatedToken] = useState<CreatedToken | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  async function createToken(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCopied(false);
    setPending(true);

    const response = await fetch("/api/tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, expiresInDays })
    });

    setPending(false);
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setError(body?.error ?? "创建 Token 失败");
      return;
    }

    const nextToken = body as CreatedToken;
    setCreatedToken(nextToken);
    setTokens((current) => [nextToken.apiToken, ...current]);
  }

  async function revokeToken(tokenId: string) {
    const confirmed = window.confirm("撤销后使用该 token 的 CLI、MCP 和 agent 会立即失效。确定撤销吗？");

    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/tokens/${tokenId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      window.alert(body?.error ?? "撤销 Token 失败");
      return;
    }

    setTokens((current) => current.filter((token) => token.id !== tokenId));
    if (createdToken?.apiToken.id === tokenId) {
      setCreatedToken(null);
    }
  }

  async function copyToken() {
    if (!createdToken) {
      return;
    }

    await navigator.clipboard.writeText(createdToken.token);
    setCopied(true);
  }

  return (
    <div className="grid gap-0">
      <div className="grid gap-4 border-b p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_160px_auto]" onSubmit={createToken}>
          <div className="grid gap-1.5">
            <Label htmlFor="token-name">Token 名称</Label>
            <Input
              id="token-name"
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：MacBook Codex"
              required
              value={name}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="token-expiration">有效期</Label>
            <select
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              id="token-expiration"
              onChange={(event) => setExpiresInDays(Number(event.target.value))}
              value={expiresInDays}
            >
              {expirationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button className="w-full md:w-auto" disabled={pending} type="submit">
              <Plus className="mr-2 h-4 w-4" />
              {pending ? "创建中..." : "创建 Token"}
            </Button>
          </div>
        </form>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {createdToken ? (
          <div className="grid gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <div className="font-medium">请现在复制 token，刷新后无法再次查看完整值。</div>
            <div className="flex min-w-0 flex-col gap-2 md:flex-row">
              <code className="min-w-0 flex-1 overflow-x-auto rounded bg-white px-2 py-1 text-xs">
                {createdToken.token}
              </code>
              <Button onClick={copyToken} size="sm" type="button" variant="outline">
                <Copy className="mr-2 h-3.5 w-3.5" />
                {copied ? "已复制" : "复制"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {tokens.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          还没有 API Token。创建后可用于 CLI、MCP 和 agent。
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>名称</TableHead>
              <TableHead>前缀</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead>过期时间</TableHead>
              <TableHead>最近使用</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((token) => (
              <TableRow key={token.id}>
                <TableCell className="font-medium">{token.name}</TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{token.tokenPrefix}...</code>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(token.createdAt)}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(token.expiresAt)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {token.lastUsedAt ? formatDate(token.lastUsedAt) : "从未使用"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    onClick={() => revokeToken(token.id)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    撤销
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "永不过期";
  }

  return new Date(value).toLocaleString("zh-CN");
}
