"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { navigationGroups, type NavItem } from "@/lib/navigation";
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
  MessageSquare,
  Megaphone,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Clock,
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
  MessageSquare,
  Megaphone,
  Clock,
};

function SidebarItem({
  item,
  depth = 0,
  collapsed,
}: {
  item: NavItem;
  depth?: number;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const { hasPermission } = usePermissions();
  const [expanded, setExpanded] = useState(pathname.startsWith(item.href));

  if (item.permission && !hasPermission(item.permission)) return null;

  const Icon = iconMap[item.icon] || LayoutDashboard;
  const isActive = pathname === item.href || (item.children && pathname.startsWith(item.href));
  const isExactActive = pathname === item.href;
  const hasChildren = item.children && item.children.length > 0;

  if (hasChildren) {
    const visibleChildren = item.children!.filter(
      (child) => !child.permission || hasPermission(child.permission),
    );
    if (visibleChildren.length === 0) return null;

    // In collapsed mode, show only icon with tooltip
    if (collapsed) {
      return (
        <div className="group relative">
          <button
            onClick={() => setExpanded(!expanded)}
            className={cn(
              "flex w-full items-center justify-center rounded-lg p-2.5 transition-colors hover:bg-sidebar-accent",
              isActive && "bg-primary-soft text-primary",
            )}
            title={item.title}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
          </button>
          {/* Tooltip */}
          <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background opacity-0 shadow-md transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
            {item.title}
          </div>
        </div>
      );
    }

    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent",
            isActive
              ? "text-sidebar-accent-foreground"
              : "text-sidebar-foreground",
          )}
          style={{ paddingLeft: `${depth * 12 + 12}px` }}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
          <span className="flex-1 text-left">{item.title}</span>
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-sidebar-muted" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-sidebar-muted" />
          )}
        </button>
        {expanded && (
          <div className="mt-0.5 space-y-0.5">
            {visibleChildren.map((child) => (
              <SidebarItem key={child.href} item={child} depth={depth + 1} collapsed={collapsed} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Leaf node
  if (collapsed) {
    return (
      <div className="group relative">
        <Link
          href={item.href}
          className={cn(
            "flex items-center justify-center rounded-lg p-2.5 transition-colors hover:bg-sidebar-accent",
            isExactActive
              ? "bg-primary-soft text-primary"
              : "text-sidebar-foreground",
          )}
          aria-current={isExactActive ? "page" : undefined}
          title={item.title}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
        </Link>
        {/* Tooltip */}
        <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background opacity-0 shadow-md transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          {item.title}
        </div>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent",
        isExactActive
          ? "bg-primary-soft font-medium text-primary"
          : "text-sidebar-foreground",
      )}
      style={{ paddingLeft: `${depth * 12 + 12}px` }}
      aria-current={isExactActive ? "page" : undefined}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span>{item.title}</span>
    </Link>
  );
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const { hasPermission } = usePermissions();

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
      <div className={cn(
        "flex h-14 items-center border-b border-sidebar-border",
        collapsed ? "justify-center px-2" : "px-5",
      )}>
        <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-4.5 w-4.5" />
          </div>
          {!collapsed && (
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              SMS Ghana
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav
        className={cn(
          "flex flex-col overflow-y-auto",
          collapsed ? "p-2" : "p-3",
        )}
        style={{ height: "calc(100vh - 3.5rem - 3rem)" }}
      >
        {navigationGroups.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (item.permission && !hasPermission(item.permission)) return false;
            if (item.children) {
              const visibleChildren = item.children.filter(
                (child) => !child.permission || hasPermission(child.permission),
              );
              return visibleChildren.length > 0;
            }
            return true;
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className="mb-1">
              {!collapsed && group.label !== "Main" && (
                <p className="mb-1.5 mt-4 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
                  {group.label}
                </p>
              )}
              {collapsed && group.label !== "Main" && (
                <div className="my-2 border-t border-sidebar-border" />
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => (
                  <SidebarItem key={item.href} item={item} collapsed={collapsed} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 border-t border-sidebar-border bg-sidebar",
        collapsed ? "p-2" : "p-3",
      )}>
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
