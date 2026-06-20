import { NextResponse } from "next/server";
import { rollbackDeployment } from "@/lib/deploy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; deploymentId: string }> }
) {
  const { projectId, deploymentId } = await params;

  try {
    const deployment = await rollbackDeployment(projectId, deploymentId);
    return NextResponse.json(deployment);
  } catch (error) {
    const message = error instanceof Error ? error.message : "回滚失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
