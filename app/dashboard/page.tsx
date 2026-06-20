import Link from "next/link";
import { headers } from "next/headers";
import { ExternalLink, Rocket } from "lucide-react";
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
import { siteDomain } from "@/lib/config";
import { getProjectDomain, getProjectUrl } from "@/lib/urls";
import { CreateProjectForm } from "./project-form";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const requestHost = (await headers()).get("host");
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      deployments: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  return (
    <main className="min-h-screen bg-secondary/40">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1 text-sm text-muted-foreground">
              <Rocket className="h-4 w-4" />
              app.{siteDomain}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Gogoga Pages</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              上传已经构建完成的静态站点 zip，发布到 {"{slug}."}
              {siteDomain}。
            </p>
          </div>
          <CreateProjectForm />
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Metric title="项目数" value={projects.length.toString()} />
          <Metric
            title="可访问域名"
            value={`*.${siteDomain}`}
            className="md:col-span-2"
          />
        </section>

        <section className="grid gap-4">
          {projects.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>还没有项目</CardTitle>
                <CardDescription>创建第一个项目后，就可以上传 dist.zip 发布。</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            projects.map((project) => {
              const latest = project.deployments[0];
              const domain = getProjectDomain(project.slug);
              const projectUrl = getProjectUrl(project.slug, requestHost);

              return (
                <Card key={project.id}>
                  <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>{project.name}</CardTitle>
                      <CardDescription>{domain}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {latest ? (
                        <Badge
                          className={
                            latest.status === "ready"
                              ? "border-green-200 bg-green-50 text-green-700"
                              : latest.status === "failed"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-blue-200 bg-blue-50 text-blue-700"
                          }
                        >
                          {latest.status}
                        </Badge>
                      ) : (
                        <Badge className="text-muted-foreground">no deployments</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                      {latest
                        ? `最近部署：${latest.createdAt.toLocaleString("zh-CN")}`
                        : "等待首次部署"}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <a href={projectUrl} target="_blank" rel="noreferrer">
                          访问
                          <ExternalLink className="ml-2 h-3.5 w-3.5" />
                        </a>
                      </Button>
                      <Button asChild size="sm">
                        <Link href={`/dashboard/projects/${project.id}`}>管理部署</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({
  title,
  value,
  className
}: {
  title: string;
  value: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
