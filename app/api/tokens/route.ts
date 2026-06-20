import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser, hashApiToken } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

const createTokenSchema = z.object({
  name: z.string().trim().min(1).max(80).default("Agent token"),
  expiresInDays: z.number().int().min(1).max(365).default(180)
});

export async function POST(request: Request) {
  const user = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const parsed = createTokenSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "参数错误" }, { status: 400 });
  }

  const token = `ggp_${crypto.randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000);
  const apiToken = await prisma.apiToken.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      tokenHash: hashApiToken(token),
      tokenPrefix: token.slice(0, 12),
      expiresAt
    },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      expiresAt: true,
      createdAt: true
    }
  });

  return NextResponse.json({ token, apiToken }, { status: 201 });
}

export async function GET(request: Request) {
  const user = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const tokens = await prisma.apiToken.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true
    }
  });

  return NextResponse.json({ tokens });
}
