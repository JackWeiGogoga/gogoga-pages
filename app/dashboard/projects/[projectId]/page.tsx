import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getProjectDomain, getProjectUrl } from "@/lib/urls";
import { UploadDeploymentForm } from "./upload-form";
import { RollbackButton } from "./rollback-button";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const requestHost = (await headers()).get("host");
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      deployments: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!project) {
    notFound();
  }

  const domain = getProjectDomain(project.slug);
  const projectUrl = getProjectUrl(project.slug, requestHost);
  const activeId = project.deployments
    .filter((deployment) => deployment.activatedAt)
    .sort((a, b) => b.activatedAt!.getTime() - a.activatedAt!.getTime())[0]?.id;

  return (
    <main className="min-h-screen bg-secondary/40">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回项目
            </Link>
          </Button>
        </div>

        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{domain}</p>
          </div>
          <Button asChild variant="outline">
            <a href={projectUrl} target="_blank" rel="noreferrer">
              访问站点
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </header>

        <UploadDeploymentForm projectId={project.id} />

        <Card>
          <CardHeader>
            <CardTitle>部署历史</CardTitle>
            <CardDescription>回滚会把 current 软链接切回对应部署目录。</CardDescription>
          </CardHeader>
          <CardContent>
            {project.deployments.length === 0 ? (
              <p className="text-sm text-muted-foreground">还没有部署记录。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-muted-foreground">
                    <tr>
                      <th className="py-3 pr-4 font-medium">状态</th>
                      <th className="py-3 pr-4 font-medium">部署 ID</th>
                      <th className="py-3 pr-4 font-medium">文件</th>
                      <th className="py-3 pr-4 font-medium">时间</th>
                      <th className="py-3 text-right font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.deployments.map((deployment) => (
                      <tr key={deployment.id} className="border-b last:border-0">
                        <td className="py-3 pr-4">
                          <Badge
                            className={
                              deployment.status === "ready"
                                ? "border-green-200 bg-green-50 text-green-700"
                                : deployment.status === "failed"
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : "border-blue-200 bg-blue-50 text-blue-700"
                            }
                          >
                            {deployment.status}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs">
                          {deployment.id}
                          {deployment.id === activeId ? (
                            <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                              active
                            </span>
                          ) : null}
                          {deployment.error ? (
                            <div className="mt-1 max-w-md text-xs text-destructive">
                              {deployment.error}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {deployment.fileCount} / {formatBytes(deployment.totalBytes)}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {deployment.createdAt.toLocaleString("zh-CN")}
                        </td>
                        <td className="py-3 text-right">
                          <RollbackButton
                            disabled={deployment.status !== "ready" || deployment.id === activeId}
                            projectId={project.id}
                            deploymentId={deployment.id}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
