"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Database,
  ExternalLink,
  Folder,
  Globe2,
  LayoutDashboard,
  Menu,
  Rocket,
  Settings,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  {
    title: "概览",
    href: "/dashboard",
    icon: LayoutDashboard
  },
  {
    title: "项目",
    href: "/dashboard",
    icon: Folder
  }
];

const secondaryItems = [
  {
    title: "域名",
    icon: Globe2
  },
  {
    title: "部署",
    icon: Activity
  },
  {
    title: "存储",
    icon: Database
  },
  {
    title: "设置",
    icon: Settings
  }
];

type HeaderTag = {
  label: string;
  className?: string;
};

type HeaderDetails = {
  title: string;
  tags?: HeaderTag[];
  action?: {
    href: string;
    label: string;
  };
};

const DashboardHeaderContext = createContext<((details: HeaderDetails | null) => void) | null>(
  null
);

export function DashboardShell({
  children,
  siteDomain
}: {
  children: React.ReactNode;
  siteDomain: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [headerDetails, setHeaderDetails] = useState<HeaderDetails | null>(null);

  return (
    <DashboardHeaderContext.Provider value={setHeaderDetails}>
    <div className="h-screen overflow-hidden bg-sidebar text-foreground">
      <div className="flex h-screen overflow-hidden">
        <aside className="hidden h-screen w-64 shrink-0 overflow-y-auto bg-sidebar px-3 py-4 md:block">
          <SidebarContent pathname={pathname} siteDomain={siteDomain} />
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              aria-label="关闭导航"
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
              type="button"
            />
            <aside className="relative flex h-full w-72 flex-col bg-sidebar px-3 py-4 shadow-xl">
              <div className="mb-2 flex justify-end">
                <Button
                  aria-label="关闭导航"
                  onClick={() => setMobileOpen(false)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <SidebarContent pathname={pathname} siteDomain={siteDomain} />
            </aside>
          </div>
        ) : null}

        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-background md:m-2 md:rounded-xl md:shadow-sm">
          <header className="sticky top-0 z-20 flex min-h-12 shrink-0 items-center justify-between gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur md:rounded-t-xl lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                aria-label="打开导航"
                className="md:hidden"
                onClick={() => setMobileOpen(true)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <Breadcrumbs details={headerDetails} pathname={pathname} />
            </div>
            {headerDetails?.action ? (
              <Button asChild className="shrink-0" variant="outline" size="sm">
                <a href={headerDetails.action.href} target="_blank" rel="noreferrer">
                  {headerDetails.action.label}
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </a>
              </Button>
            ) : null}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </main>
      </div>
    </div>
    </DashboardHeaderContext.Provider>
  );
}

export function DashboardHeaderDetails({
  action,
  tags = [],
  title
}: HeaderDetails) {
  const setHeaderDetails = useContext(DashboardHeaderContext);
  const details = useMemo(() => ({ action, tags, title }), [action, tags, title]);

  useEffect(() => {
    setHeaderDetails?.(details);
    return () => setHeaderDetails?.(null);
  }, [details, setHeaderDetails]);

  return null;
}

function Breadcrumbs({ details, pathname }: { details: HeaderDetails | null; pathname: string }) {
  const onProjectPage = pathname.startsWith("/dashboard/projects");

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
        <Link className="shrink-0 text-muted-foreground transition-colors hover:text-foreground" href="/dashboard">
          项目
        </Link>
        {onProjectPage ? (
          <>
            <span className="shrink-0 text-muted-foreground/60">/</span>
            <span className="truncate font-medium text-foreground">
              {details?.title ?? "项目详情"}
            </span>
          </>
        ) : null}
      </nav>
      {details?.tags?.length ? (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {details.tags.map((tag) => (
            <Badge className={cn("bg-background text-muted-foreground", tag.className)} key={tag.label}>
              {tag.label}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SidebarContent({
  pathname,
  siteDomain
}: {
  pathname: string;
  siteDomain: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <Link className="mb-5 flex items-center gap-3 rounded-lg px-2 py-2" href="/dashboard">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Rocket className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">Gogoga</div>
          <div className="truncate text-xs text-sidebar-foreground/60">页面发布平台</div>
        </div>
      </Link>

      <nav className="grid gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/dashboard" && item.title === "概览"
              ? pathname === "/dashboard"
              : pathname.startsWith("/dashboard/projects");

          return (
            <Link
              className={cn(
                "flex h-9 items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
              )}
              href={item.href}
              key={item.title}
            >
              <Icon className="h-4 w-4" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-8">
        <div className="px-2 text-xs font-medium text-sidebar-foreground/50">平台</div>
        <nav className="mt-2 grid gap-1">
          {secondaryItems.map((item) => {
            const Icon = item.icon;

            return (
              <div
                className="flex h-9 items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground/60"
                key={item.title}
              >
                <Icon className="h-4 w-4" />
                <span>{item.title}</span>
              </div>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto rounded-lg border border-sidebar-border bg-background/70 p-3">
        <div className="text-xs font-medium text-sidebar-foreground">默认域名</div>
        <div className="mt-1 break-all text-xs text-sidebar-foreground/60">*.{siteDomain}</div>
      </div>
    </div>
  );
}
