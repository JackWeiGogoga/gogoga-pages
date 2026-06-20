import { DashboardShell } from "@/components/dashboard-shell";
import { siteDomain } from "@/lib/config";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell siteDomain={siteDomain}>{children}</DashboardShell>;
}
