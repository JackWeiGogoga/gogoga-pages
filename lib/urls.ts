import { siteDomain } from "@/lib/config";

export function getProjectDomain(slug: string) {
  return `${slug}.${siteDomain}`;
}

export function getProjectUrl(slug: string, requestHost?: string | null) {
  if (requestHost) {
    const [hostname, port] = requestHost.toLowerCase().split(":");

    if (hostname === "localhost") {
      return `http://${slug}.localhost${port ? `:${port}` : ""}`;
    }
  }

  return `https://${getProjectDomain(slug)}`;
}
