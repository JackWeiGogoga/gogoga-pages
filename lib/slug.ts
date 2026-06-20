import { pinyin } from "pinyin-pro";

const reservedSlugs = new Set([
  "app",
  "api",
  "www",
  "admin",
  "console",
  "static",
  "assets",
  "pages",
  "login"
]);

export function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function slugFromProjectName(value: string) {
  return normalizeSlug(
    pinyin(value, {
      toneType: "none",
      type: "array",
      nonZh: "consecutive"
    }).join("-")
  );
}

export function validateSlug(value: string) {
  const slug = normalizeSlug(value);

  if (!slug) {
    return { ok: false as const, error: "Slug 不能为空" };
  }

  if (slug.length < 3 || slug.length > 40) {
    return { ok: false as const, error: "Slug 长度需要在 3 到 40 个字符之间" };
  }

  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    return { ok: false as const, error: "Slug 只能包含小写字母、数字和中划线" };
  }

  if (reservedSlugs.has(slug)) {
    return { ok: false as const, error: "该 Slug 是平台保留名称" };
  }

  return { ok: true as const, slug };
}
