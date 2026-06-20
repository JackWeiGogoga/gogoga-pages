import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DashboardHeaderDetails } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { listPublishedHtmlFiles } from "@/lib/deploy";
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
  const activeDeployment = project.deployments
    .filter((deployment) => deployment.activatedAt)
    .sort((a, b) => b.activatedAt!.getTime() - a.activatedAt!.getTime())[0];
  const activeId = activeDeployment?.id;
  const currentHtmlFiles = activeDeployment
    ? await listPublishedHtmlFiles(activeDeployment.storagePath)
    : [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 lg:px-6">
      <DashboardHeaderDetails
        action={{ href: projectUrl, label: "访问站点" }}
        tags={[
          activeDeployment
            ? { label: "online", className: "border-green-200 bg-green-50 text-green-700" }
            : { label: "未部署" },
          { label: domain },
          { label: `${project.deployments.length} 次部署` },
          { label: `${currentHtmlFiles.length} 个 HTML 页面` }
        ]}
        title={project.name}
      />

      <UploadDeploymentForm
        currentHtmlFiles={currentHtmlFiles}
        hasActiveDeployment={Boolean(activeDeployment)}
        projectId={project.id}
      />

      <Card>
        <CardHeader className="flex flex-col gap-1 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">部署历史</CardTitle>
            <CardDescription className="text-xs">查看版本状态并回滚。</CardDescription>
          </div>
          {activeId ? (
            <span className="truncate text-xs text-muted-foreground sm:max-w-72">
              active: {activeId}
            </span>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {project.deployments.length === 0 ? (
            <div className="flex min-h-32 items-center justify-center px-6 text-sm text-muted-foreground">
              还没有部署记录。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">状态</th>
                    <th className="px-3 py-2 font-medium">部署 ID</th>
                    <th className="px-3 py-2 font-medium">文件</th>
                    <th className="px-3 py-2 font-medium">时间</th>
                    <th className="px-3 py-2 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {project.deployments.map((deployment) => (
                    <tr key={deployment.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
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
                      <td className="max-w-sm px-3 py-2 font-mono text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate">{deployment.id}</span>
                          {deployment.id === activeId ? (
                            <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                              active
                            </span>
                          ) : null}
                        </div>
                        {deployment.error ? (
                          <div className="mt-1 text-xs text-destructive">{deployment.error}</div>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {deployment.fileCount} / {formatBytes(deployment.totalBytes)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {deployment.createdAt.toLocaleString("zh-CN")}
                      </td>
                      <td className="px-3 py-2 text-right">
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
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
