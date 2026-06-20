import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const hostname = host.split(":")[0].toLowerCase();
  const pathname = request.nextUrl.pathname;
  const siteDomain = process.env.GOGOGA_SITE_DOMAIN ?? "pages.gogoga.top";
  const localSuffix = ".localhost";
  const productionSuffix = `.${siteDomain}`;

  if (pathname.startsWith("/site-preview") || pathname.startsWith("/_next") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const slug = hostname.endsWith(localSuffix)
    ? hostname.slice(0, -localSuffix.length)
    : hostname.endsWith(productionSuffix)
      ? hostname.slice(0, -productionSuffix.length)
      : "";

  if (!slug || slug.includes(".") || slug === "app" || slug === "pages") {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/site-preview/${slug}${pathname}`;

  return NextResponse.rewrite(url);
}
