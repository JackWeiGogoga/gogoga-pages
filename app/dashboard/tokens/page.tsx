import { KeyRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-session";
import { AgentUsageGuide } from "./agent-usage-guide";
import { TokenManager } from "./token-manager";

export const dynamic = "force-dynamic";

export default async function TokensPage() {
  const user = await requireUser();
  const tokens = await prisma.apiToken.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true
    }
  });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <section className="grid gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-muted/40">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">API Token</h1>
            <p className="text-sm text-muted-foreground">
              为 CLI、MCP 和 agent 创建访问凭证。完整 token 只会显示一次。
            </p>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader className="border-b py-4">
          <CardTitle className="text-base">访问凭证</CardTitle>
          <CardDescription>
            Token 以 hash 形式保存，可随时撤销。建议为不同设备或 agent 创建独立 token。
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <TokenManager initialTokens={tokens.map(serializeToken)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b py-4">
          <CardTitle className="text-base">Agent 接入</CardTitle>
          <CardDescription>
            用同一个 API Token 配置 CLI、MCP 或 Skill。推荐生产环境使用独立 token，并定期轮换。
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <AgentUsageGuide />
        </CardContent>
      </Card>
    </div>
  );
}

function serializeToken(token: {
  id: string;
  name: string;
  tokenPrefix: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: token.id,
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
    expiresAt: token.expiresAt?.toISOString() ?? null,
    createdAt: token.createdAt.toISOString()
  };
}
