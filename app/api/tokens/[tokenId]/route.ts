import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const user = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { tokenId } = await params;
  const token = await prisma.apiToken.findFirst({
    where: {
      id: tokenId,
      userId: user.id
    },
    select: { id: true }
  });

  if (!token) {
    return NextResponse.json({ error: "Token 不存在" }, { status: 404 });
  }

  await prisma.apiToken.delete({
    where: { id: token.id }
  });

  return NextResponse.json({ ok: true });
}
