import { NextResponse } from "next/server";
import { deployStaticFiles } from "@/lib/deploy";
import { getRequestUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { projectId } = await params;
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

  const formData = await request.formData();
  const files = formData.getAll("file").filter((file): file is File => file instanceof File);
  const mode = formData.get("mode") === "merge" ? "merge" : "replace";
  const removePaths = formData
    .getAll("removePath")
    .filter((value): value is string => typeof value === "string");

  if (files.length === 0 && removePaths.length === 0) {
    return NextResponse.json({ error: "请上传 zip 或 html 文件" }, { status: 400 });
  }

  const hasZip = files.some((file) => file.name.toLowerCase().endsWith(".zip"));
  const allSupported = files.every((file) => {
    const fileName = file.name.toLowerCase();
    return fileName.endsWith(".zip") || fileName.endsWith(".html") || fileName.endsWith(".htm");
  });

  if (!allSupported) {
    return NextResponse.json({ error: "只支持 .zip、.html 或 .htm 文件" }, { status: 400 });
  }

  if (hasZip && files.length > 1) {
    return NextResponse.json({ error: "zip 部署一次只能上传一个文件" }, { status: 400 });
  }

  try {
    const deployment = await deployStaticFiles(projectId, files, { mode, removePaths });
    return NextResponse.json(deployment, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "部署失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
