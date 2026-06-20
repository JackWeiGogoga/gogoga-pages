import { NextResponse } from "next/server";
import { rollbackDeployment } from "@/lib/deploy";
import { getRequestUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; deploymentId: string }> }
) {
  const user = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { projectId, deploymentId } = await params;
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId: user.id
    },
    select: { id: true }
  });

  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  try {
    const deployment = await rollbackDeployment(projectId, deploymentId);
    return NextResponse.json(deployment);
  } catch (error) {
    const message = error instanceof Error ? error.message : "回滚失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
