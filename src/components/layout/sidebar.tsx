"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { navigationItems, type NavItem } from "@/lib/navigation";
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
};

function SidebarItem({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const pathname = usePathname();
  const { hasPermission } = usePermissions();
  const [expanded, setExpanded] = useState(pathname.startsWith(item.href));

  if (item.permission && !hasPermission(item.permission)) return null;

  const Icon = iconMap[item.icon] || LayoutDashboard;
  const isActive = pathname === item.href || (item.children && pathname.startsWith(item.href));
  const hasChildren = item.children && item.children.length > 0;

  if (hasChildren) {
    const visibleChildren = item.children!.filter(
      (child) => !child.permission || hasPermission(child.permission),
    );
    if (visibleChildren.length === 0) return null;

    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
            isActive && "bg-accent text-accent-foreground",
          )}
          style={{ paddingLeft: `${depth * 12 + 12}px` }}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{item.title}</span>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {expanded && (
          <div className="mt-1 space-y-1">
            {visibleChildren.map((child) => (
              <SidebarItem key={child.href} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
        isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground",
      )}
      style={{ paddingLeft: `${depth * 12 + 12}px` }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{item.title}</span>
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 border-r border-border bg-card lg:block">
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">SMS Ghana</span>
        </Link>
      </div>
      <nav className="space-y-1 overflow-y-auto p-4" style={{ height: "calc(100vh - 4rem)" }}>
        {navigationItems.map((item) => (
          <SidebarItem key={item.href} item={item} />
        ))}
      </nav>
    </aside>
  );
}
