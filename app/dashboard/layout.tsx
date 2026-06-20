import { DashboardShell } from "@/components/dashboard-shell";
import { requireUser } from "@/lib/auth-session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <DashboardShell userEmail={user.email} userName={user.name}>
      {children}
    </DashboardShell>
  );
}
