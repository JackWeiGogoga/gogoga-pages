import { siteDomain } from "@/lib/config";

export function getProjectDomain(siteKey: string) {
  return `${siteKey}.${siteDomain}`;
}

export function getProjectUrl(siteKey: string, requestHost?: string | null) {
  if (requestHost) {
    const [hostname, port] = requestHost.toLowerCase().split(":");

    if (hostname === "localhost") {
      return `http://${siteKey}.localhost${port ? `:${port}` : ""}`;
    }
  }

  return `https://${getProjectDomain(siteKey)}`;
}
