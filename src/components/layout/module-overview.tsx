"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import { navigationGroups, type NavItem } from "@/lib/navigation";

type LucideIconName = keyof typeof Icons;

function getIcon(name: string): Icons.LucideIcon {
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[name];
  return Icon ?? Icons.LayoutDashboard;
}

export interface ModuleOverviewKpi {
  label: string;
  value: string | number;
  hint?: string;
}

export interface ModuleOverviewQuickAction {
  href: string;
  label: string;
  icon: LucideIconName;
}

interface ModuleOverviewProps {
  title: string;
  description?: string;
  kpis?: ModuleOverviewKpi[];
  quickActions?: ModuleOverviewQuickAction[];
  children?: React.ReactNode;
}

/**
 * Reusable module-landing scaffold. Header + optional KPIs + optional quick
 * actions + auto-derived shortcut grid sourced from the navigation `children`
 * of the current route's module. Matches the floating ModuleMenu so the two
 * never drift.
 */
export function ModuleOverview({
  title,
  description,
  kpis,
  quickActions,
  children,
}: ModuleOverviewProps) {
  const pathname = usePathname();
  const { hasPermission } = usePermissions();

  const shortcuts = findShortcuts(pathname ?? "").filter(
    (i) => !i.permission || hasPermission(i.permission),
  );

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />

      {kpis && kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-border bg-card p-4"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {kpi.label}
              </p>
              <p className="mt-1 text-2xl font-semibold">{kpi.value}</p>
              {kpi.hint && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">{kpi.hint}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {quickActions && quickActions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Quick actions
          </p>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((qa) => {
              const Icon = getIcon(qa.icon);
              return (
                <Link
                  key={qa.href}
                  href={qa.href}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {qa.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {shortcuts.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Jump to
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shortcuts.map((item) => {
              const Icon = getIcon(item.icon);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                    {item.group && (
                      <p className="truncate text-[11px] text-muted-foreground">{item.group}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {children}
    </div>
  );
}

function findShortcuts(pathname: string): NavItem[] {
  let best: NavItem | null = null;
  let bestLen = 0;
  for (const group of navigationGroups) {
    for (const item of group.items) {
      if (!item.children || item.children.length === 0) continue;
      if (item.href === pathname || pathname.startsWith(item.href + "/")) {
        if (item.href.length > bestLen) {
          best = item;
          bestLen = item.href.length;
        }
      }
    }
  }
  return best?.children ?? [];
}
