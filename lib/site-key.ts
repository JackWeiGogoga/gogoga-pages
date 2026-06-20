import { prisma } from "@/lib/prisma";

export async function createSiteKey(userId: string, slug: string) {
  const base = `${slug}-${userId.slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, "")}`.replace(
    /-+$/g,
    ""
  );
  let siteKey = base || slug;
  let suffix = 2;

  while (await prisma.project.findUnique({ where: { siteKey }, select: { id: true } })) {
    siteKey = `${base}-${suffix}`;
    suffix += 1;
  }

  return siteKey;
}
