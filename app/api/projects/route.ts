import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateSlug } from "@/lib/slug";

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "项目名称不能为空").max(80, "项目名称太长"),
  slug: z.string().trim().min(1, "Slug 不能为空")
});

export async function POST(request: Request) {
  const parsed = createProjectSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "参数错误" }, { status: 400 });
  }

  const slugResult = validateSlug(parsed.data.slug);

  if (!slugResult.ok) {
    return NextResponse.json({ error: slugResult.error }, { status: 400 });
  }

  try {
    const project = await prisma.project.create({
      data: {
        name: parsed.data.name,
        slug: slugResult.slug
      }
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "该 Slug 已被占用" }, { status: 409 });
    }

    return NextResponse.json({ error: "创建项目失败" }, { status: 500 });
  }
}
