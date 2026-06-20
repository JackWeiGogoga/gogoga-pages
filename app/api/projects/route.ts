import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { createSiteKey } from "@/lib/site-key";
import { normalizeSlug, slugFromProjectName, validateSlug } from "@/lib/slug";
import { getProjectUrl } from "@/lib/urls";

const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "项目名称不能为空")
    .max(80, "项目名称太长"),
  slug: z.string().trim().optional()
});

export async function POST(request: Request) {
  const user = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const parsed = createProjectSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "参数错误" }, { status: 400 });
  }

  const requestedSlug = parsed.data.slug;
  const slugResult = validateSlug(
    requestedSlug ? normalizeSlug(requestedSlug) : slugFromProjectName(parsed.data.name)
  );

  if (!slugResult.ok) {
    return NextResponse.json({ error: slugResult.error }, { status: 400 });
  }

  try {
    const existingProject = await prisma.project.findFirst({
      where: {
        userId: user.id,
        slug: slugResult.slug
      },
      select: { id: true }
    });

    if (existingProject) {
      return NextResponse.json({ error: "你已经有同名访问路径的项目" }, { status: 409 });
    }

    const siteKey = await createSiteKey(user.id, slugResult.slug);
    const project = await prisma.project.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        slug: slugResult.slug,
        siteKey
      }
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "访问路径冲突，请换一个名称重试" }, { status: 409 });
    }

    return NextResponse.json({ error: "创建项目失败" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const user = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      deployments: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  return NextResponse.json({
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      slug: project.slug,
      siteKey: project.siteKey,
      url: getProjectUrl(project.siteKey, request.headers.get("host")),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      latestDeployment: project.deployments[0] ?? null
    }))
  });
}
