"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { navigationGroups, type NavItem } from "@/lib/navigation";
import { useModuleMenu } from "@/hooks/use-module-menu";
import {
  LayoutDashboard,
  Settings,
  School,
  Calendar,
  CalendarDays,
  Building,
  GraduationCap,
  Home,
  BarChart3,
  Users,
  Shield,
  FileText,
  UserPlus,
  ClipboardList,
  BookOpen,
  Book,
  Layout,
  ClipboardCheck,
  Award,
  CheckSquare,
  DollarSign,
  Receipt,
  CreditCard,
  Briefcase,
  Building2,
  BedDouble,
  DoorOpen,
  Package,
  Warehouse,
  ArrowLeftRight,
  Truck,
  ShoppingCart,
  AlertTriangle,
  HeartPulse,
  UserCheck,
  Wrench,
  MessageSquare,
  Megaphone,
  PanelLeftClose,
  PanelLeft,
  Clock,
  Library,
  Bus,
  Monitor,
  ShieldCheck,
  Brain,
  FileStack,
  ArrowRightLeft,
  KeyRound,
  ScanSearch,
  PieChart,
  TrendingDown,
  ScrollText,
  Search,
  Wallet,
  FileCheck,
  FileSpreadsheet,
  Scale,
  Copy,
  Link as LinkIcon,
  Landmark,
  Heart,
  HandHeart,
  FileSearch,
  X as XIcon,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Settings,
  School,
  Calendar,
  CalendarDays,
  Building,
  GraduationCap,
  Home,
  BarChart3,
  Users,
  Shield,
  FileText,
  UserPlus,
  ClipboardList,
  BookOpen,
  Book,
  Layout,
  ClipboardCheck,
  Award,
  CheckSquare,
  DollarSign,
  Receipt,
  CreditCard,
  Briefcase,
  Building2,
  BedDouble,
  DoorOpen,
  Package,
  Warehouse,
  ArrowLeftRight,
  Truck,
  ShoppingCart,
  AlertTriangle,
  HeartPulse,
  UserCheck,
  Wrench,
  MessageSquare,
  Megaphone,
  Clock,
  Library,
  Bus,
  Monitor,
  ShieldCheck,
  Brain,
  FileStack,
  ArrowRightLeft,
  KeyRound,
  ScanSearch,
  PieChart,
  TrendingDown,
  ScrollText,
  Wallet,
  FileCheck,
  FileSpreadsheet,
  Scale,
  Copy,
  Link: LinkIcon,
  Landmark,
  Heart,
  HandHeart,
  FileSearch,
};

/* ─── Top-level module row ─────────────────────────────────────── */

function ModuleRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const { setOpen } = useModuleMenu();
  const Icon = iconMap[item.icon] || LayoutDashboard;
  const isActive =
    pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
  const hasChildren = !!item.children && item.children.length > 0;

  const onClick = () => {
    if (hasChildren) setOpen(true);
  };

  if (collapsed) {
    return (
      <div className="group relative">
        <Link
          href={item.href}
          onClick={onClick}
          className={cn(
            "flex items-center justify-center rounded-lg p-2.5 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            isActive ? "bg-primary text-primary-foreground" : "text-sidebar-foreground",
          )}
          aria-current={isActive ? "page" : undefined}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
        </Link>
        <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background opacity-0 shadow-md transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          {item.title}
        </div>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        isActive
          ? "bg-primary/10 font-medium text-sidebar-accent-foreground"
          : "text-sidebar-foreground",
      )}
      aria-current={isActive ? "page" : undefined}
      aria-haspopup={hasChildren ? "menu" : undefined}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="truncate">{item.title}</span>
    </Link>
  );
}

/* ─── Sidebar ──────────────────────────────────────────────────── */

export function Sidebar({
  collapsed,
  onToggleCollapse,
  onOpenPalette,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenPalette?: () => void;
}) {
  const { hasPermission } = usePermissions();
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  // Filter: permission + case-insensitive title match on the module itself
  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return navigationGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item.permission && !hasPermission(item.permission)) return false;
          if (!q) return true;
          return item.title.toLowerCase().includes(q);
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [query, hasPermission]);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-30 hidden h-screen border-r border-sidebar-border bg-sidebar transition-all duration-200 lg:block",
        collapsed ? "w-16" : "w-64",
      )}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Header */}
      <div
        className={cn(
          "flex h-14 items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-2" : "px-5",
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-4.5 w-4.5" />
          </div>
          {!collapsed && (
            <span className="text-[15px] font-semibold tracking-tight text-sidebar-accent-foreground">
              SMS Ghana
            </span>
          )}
        </Link>
      </div>

      {/* Search + ⌘K trigger */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sidebar-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter menu…"
              className="w-full rounded-md border border-sidebar-border bg-background/50 py-1.5 pl-8 pr-8 text-xs text-sidebar-foreground placeholder:text-sidebar-muted focus:border-primary focus:outline-none"
              aria-label="Filter sidebar"
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sidebar-muted hover:text-sidebar-foreground"
                aria-label="Clear filter"
              >
                <XIcon className="h-3 w-3" />
              </button>
            ) : (
              <button
                onClick={onOpenPalette}
                title="Quick jump (Ctrl/⌘+K)"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded bg-sidebar-accent/40 px-1.5 py-0.5 text-[9px] font-mono text-sidebar-muted hover:text-sidebar-foreground"
              >
                ⌘K
              </button>
            )}
          </div>
        </div>
      )}
      {collapsed && (
        <div className="px-2 pt-3 pb-1 flex justify-center">
          <button
            onClick={onOpenPalette}
            title="Quick jump (Ctrl/⌘+K)"
            className="rounded-lg p-2.5 text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav
        className={cn("flex flex-col overflow-y-auto", collapsed ? "p-2" : "px-3 pb-3 pt-1")}
        style={{ height: "calc(100vh - 3.5rem - 3rem - 3rem)" }}
      >
        {filteredGroups.length === 0 && query && (
          <p className="mt-4 px-3 text-sm text-sidebar-muted">No modules match &quot;{query}&quot;.</p>
        )}

        {filteredGroups.map((group) => (
          <div key={group.label} className="mb-1">
            {!collapsed && group.label !== "Main" && (
              <p className="mb-1 mt-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
                {group.label}
              </p>
            )}
            {collapsed && group.label !== "Main" && <div className="my-2 border-t border-sidebar-border" />}
            <div className="space-y-0">
              {group.items.map((item) => (
                <ModuleRow key={item.href} item={item} collapsed={Boolean(collapsed)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 border-t border-sidebar-border bg-sidebar",
          collapsed ? "p-2" : "p-3",
        )}
      >
        <button
          onClick={onToggleCollapse}
          className={cn(
            "flex w-full items-center rounded-lg py-2 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed ? "justify-center px-2" : "gap-3 px-3",
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeft className="h-[18px] w-[18px]" />
          ) : (
            <>
              <PanelLeftClose className="h-[18px] w-[18px]" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
