import { NextResponse } from "next/server";
import { deployStaticFiles } from "@/lib/deploy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const formData = await request.formData();
  const files = formData.getAll("file").filter((file): file is File => file instanceof File);

  if (files.length === 0) {
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
    const deployment = await deployStaticFiles(projectId, files);
    return NextResponse.json(deployment, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "部署失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
