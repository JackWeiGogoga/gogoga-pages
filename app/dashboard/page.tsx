import Link from "next/link";
import { headers } from "next/headers";
import type { ComponentType } from "react";
import { ArrowUpRight, ExternalLink, Folder, Globe2, Rocket, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { siteDomain } from "@/lib/config";
import { getProjectDomain, getProjectUrl } from "@/lib/urls";
import { CreateProjectForm } from "./project-form";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const requestHost = (await headers()).get("host");
  const [projects, deploymentCount] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        deployments: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    }),
    prisma.deployment.count()
  ]);
  const readyCount = projects.filter((project) => project.deployments[0]?.status === "ready").length;
  const pendingCount = projects.filter((project) => {
    const latest = project.deployments[0];
    return latest && latest.status !== "ready";
  }).length;

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <section className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-4 lg:px-6">
        <StatCard
          description="Ready projects"
          eyebrow="Total Projects"
          trend="+12.5%"
          value={projects.length.toString()}
        />
        <StatCard
          description="All-time uploads"
          eyebrow="Deployments"
          trend="+8.2%"
          value={deploymentCount.toString()}
        />
        <StatCard
          description={`${readyCount} projects online`}
          eyebrow="Active Sites"
          trend="+4.5%"
          value={readyCount.toString()}
        />
        <StatCard
          description="Need attention"
          eyebrow="Pending"
          trend={pendingCount ? `${pendingCount}` : "0"}
          value={pendingCount.toString()}
        />
      </section>

      <section className="grid gap-4 px-4 lg:px-6">
        <Card>
          <CardHeader className="flex flex-col gap-3 border-b py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Projects</CardTitle>
              <CardDescription>
                上传 zip 或 html 文件，发布到 {"{slug}."}
                {siteDomain}。
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <a href={`https://app.${siteDomain}`} target="_blank" rel="noreferrer">
                  app.{siteDomain}
                  <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
                </a>
              </Button>
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
                    <TableHead className="w-[260px]">Project</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Latest Deployment</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
                              <div className="text-xs text-muted-foreground">{project.slug}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[280px] truncate text-muted-foreground">
                          {domain}
                        </TableCell>
                        <TableCell>
                          {latest ? <StatusBadge status={latest.status} /> : <StatusBadge status="empty" />}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {latest ? (
                            <div className="flex flex-col gap-1">
                              <span>{latest.createdAt.toLocaleString("zh-CN")}</span>
                              <span className="text-xs">
                                {latest.fileCount} files / {formatBytes(latest.totalBytes)}
                              </span>
                            </div>
                          ) : (
                            "等待首次部署"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button asChild variant="outline" size="sm">
                              <a href={projectUrl} target="_blank" rel="noreferrer">
                                访问
                                <ExternalLink className="ml-2 h-3.5 w-3.5" />
                              </a>
                            </Button>
                            <Button asChild size="sm">
                              <Link href={`/dashboard/projects/${project.id}`}>管理</Link>
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

        <Card>
          <CardHeader className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Deployment Activity</CardTitle>
              <CardDescription>最近项目部署状态概览。</CardDescription>
            </div>
            <div className="flex rounded-lg border">
              <Button className="rounded-r-none" size="sm" variant="ghost">
                Last 3 months
              </Button>
              <Button className="rounded-none border-x" size="sm" variant="ghost">
                Last 30 days
              </Button>
              <Button className="rounded-l-none" size="sm" variant="ghost">
                Last 7 days
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <ActivityTile
                icon={UploadCloud}
                label="Uploaded files"
                value={projects
                  .reduce((total, project) => total + (project.deployments[0]?.fileCount ?? 0), 0)
                  .toString()}
              />
              <ActivityTile icon={Globe2} label="Online domains" value={readyCount.toString()} />
              <ActivityTile icon={Folder} label="Workspace projects" value={projects.length.toString()} />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatCard({
  description,
  eyebrow,
  trend,
  value
}: {
  description: string;
  eyebrow: string;
  trend: string;
  value: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-2 p-5">
        <div className="flex items-center justify-between">
          <CardDescription>{eyebrow}</CardDescription>
          <Badge className="gap-1 rounded-full bg-background text-foreground">
            <ArrowUpRight className="h-3 w-3" />
            {trend}
          </Badge>
        </div>
        <CardTitle className="text-3xl font-semibold tracking-tight">{value}</CardTitle>
        <div className="pt-4">
          <div className="flex items-center gap-1 font-medium">
            Steady performance
            <ArrowUpRight className="h-4 w-4" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </CardHeader>
    </Card>
  );
}

function ActivityTile({
  icon: Icon,
  label,
  value
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-background">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
    </div>
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
      {status === "empty" ? "no deployments" : status}
    </Badge>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
