import { DashboardShell } from "@/components/dashboard-shell";
import { requireUser } from "@/lib/auth-session";
import { siteDomain } from "@/lib/config";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <DashboardShell siteDomain={siteDomain} userEmail={user.email} userName={user.name}>
      {children}
    </DashboardShell>
  );
}
