import Link from "next/link";
import { headers } from "next/headers";
import { ExternalLink, Folder, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-session";
import { getProjectDomain, getProjectUrl } from "@/lib/urls";
import { CreateProjectForm } from "./project-form";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const requestHost = (await headers()).get("host");
  const [projects, deploymentCount] = await Promise.all([
    prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        deployments: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.deployment.count({
      where: {
        project: {
          userId: user.id,
        },
      },
    }),
  ]);
  const readyCount = projects.filter(
    (project) => project.deployments[0]?.status === "ready",
  ).length;
  const pendingCount = projects.filter((project) => {
    const latest = project.deployments[0];
    return latest && latest.status !== "ready";
  }).length;

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 py-4 md:py-5">
      <section className="grid grid-cols-2 gap-3 px-4 lg:grid-cols-4 lg:px-6">
        <StatCard
          description="全部项目数量"
          eyebrow="项目总数"
          value={projects.length.toString()}
        />
        <StatCard
          description="累计上传发布次数"
          eyebrow="部署次数"
          value={deploymentCount.toString()}
        />
        <StatCard
          description={`${readyCount} 个项目在线`}
          eyebrow="在线站点"
          value={readyCount.toString()}
        />
        <StatCard
          description="需要关注的部署"
          eyebrow="处理中"
          value={pendingCount.toString()}
        />
      </section>

      <section className="grid gap-4 px-4 lg:px-6">
        <Card>
          <CardHeader className="flex flex-col gap-3 border-b py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">项目</CardTitle>
            </div>
            <div className="flex flex-wrap gap-2">
              <CreateProjectForm />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {projects.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted/40">
                  <Folder className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-medium">还没有项目</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    创建第一个项目后，就可以上传 zip 或 html 文件发布。
                  </p>
                </div>
                <CreateProjectForm />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-[260px]">项目</TableHead>
                    <TableHead>域名</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>最近部署</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => {
                    const latest = project.deployments[0];
                    const domain = getProjectDomain(project.slug);
                    const projectUrl = getProjectUrl(project.slug, requestHost);

                    return (
                      <TableRow key={project.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted/40">
                              <Rocket className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <Link
                                className="truncate font-medium hover:underline"
                                href={`/dashboard/projects/${project.id}`}
                              >
                                {project.name}
                              </Link>
                              <div className="text-xs text-muted-foreground">
                                {project.slug}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[280px] truncate text-muted-foreground">
                          {domain}
                        </TableCell>
                        <TableCell>
                          {latest ? (
                            <StatusBadge status={latest.status} />
                          ) : (
                            <StatusBadge status="empty" />
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {latest ? (
                            <div className="flex flex-col gap-1">
                              <span>
                                {latest.createdAt.toLocaleString("zh-CN")}
                              </span>
                              <span className="text-xs">
                                {latest.fileCount} 个文件 /{" "}
                                {formatBytes(latest.totalBytes)}
                              </span>
                            </div>
                          ) : (
                            "等待首次部署"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button asChild variant="outline" size="sm">
                              <a
                                href={projectUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                访问
                                <ExternalLink className="ml-2 h-3.5 w-3.5" />
                              </a>
                            </Button>
                            <Button asChild size="sm">
                              <Link href={`/dashboard/projects/${project.id}`}>
                                管理
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatCard({
  description,
  eyebrow,
  value,
}: {
  description: string;
  eyebrow: string;
  value: string;
}) {
  return (
    <Card>
      <CardHeader className="gap-1 p-3">
        <CardDescription className="text-xs">{eyebrow}</CardDescription>
        <div className="flex items-end justify-between gap-3">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {value}
          </CardTitle>
          <p className="truncate text-xs text-muted-foreground">
            {description}
          </p>
        </div>
      </CardHeader>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      className={
        status === "ready"
          ? "border-green-200 bg-green-50 text-green-700"
          : status === "failed"
            ? "border-red-200 bg-red-50 text-red-700"
            : status === "empty"
              ? "text-muted-foreground"
              : "border-blue-200 bg-blue-50 text-blue-700"
      }
    >
      {formatStatus(status)}
    </Badge>
  );
}

function formatStatus(status: string) {
  switch (status) {
    case "ready":
      return "已上线";
    case "failed":
      return "失败";
    case "uploading":
      return "上传中";
    case "extracting":
      return "解压中";
    case "publishing":
      return "发布中";
    case "empty":
      return "未部署";
    default:
      return status;
  }
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
