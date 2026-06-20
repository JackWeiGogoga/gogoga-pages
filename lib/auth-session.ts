import { headers } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export function hashApiToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function getSession() {
  return auth.api.getSession({
    headers: await headers()
  });
}

export async function requireUser() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  return session.user;
}

export async function getRequestUser(request: Request) {
  const bearerToken = getBearerToken(request);

  if (bearerToken) {
    const apiToken = await prisma.apiToken.findFirst({
      where: {
        tokenHash: hashApiToken(bearerToken),
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      },
      include: { user: true }
    });

    if (apiToken) {
      await prisma.apiToken.update({
        where: { id: apiToken.id },
        data: { lastUsedAt: new Date() }
      });

      return apiToken.user;
    }
  }

  const session = await auth.api.getSession({
    headers: request.headers
  });

  return session?.user ?? null;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(/\s+/, 2);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}
