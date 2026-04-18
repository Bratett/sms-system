"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useModuleMenu } from "@/hooks/use-module-menu";
import { usePermissions } from "@/hooks/use-permissions";
import { navigationGroups, type NavItem } from "@/lib/navigation";

interface GroupBucket {
  label: string | null;
  items: NavItem[];
}

function findActiveModule(pathname: string): NavItem | null {
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
  return best;
}

function groupChildren(children: NavItem[]): GroupBucket[] {
  // The `group` field is set only on the first item of each section; later
  // items in the same section omit it and inherit the current section. Items
  // before the first `group` marker fall into a null (ungrouped) bucket.
  const buckets: GroupBucket[] = [];
  let current: GroupBucket | null = null;
  for (const child of children) {
    if (child.group) {
      current = { label: child.group, items: [child] };
      buckets.push(current);
    } else {
      if (!current) {
        current = { label: null, items: [] };
        buckets.push(current);
      }
      current.items.push(child);
    }
  }
  return buckets;
}

/**
 * Floating accordion overlay. Opens on demand via the sidebar chevron or
 * topbar pill. Auto-expands the group containing the current pathname. Any
 * leaf click, Escape, backdrop click, or ✕ collapses the menu entirely.
 * Portal-rendered so position:fixed escapes the dashboard shell's transforms.
 */
export function ModuleMenu() {
  const { open, setOpen } = useModuleMenu();
  const pathname = usePathname();
  const { hasPermission } = usePermissions();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const activeModule = useMemo(() => findActiveModule(pathname ?? ""), [pathname]);

  const buckets = useMemo<GroupBucket[]>(() => {
    if (!activeModule?.children) return [];
    const visible = activeModule.children.filter((c) => !c.permission || hasPermission(c.permission));
    return groupChildren(visible).filter((b) => b.items.length > 0);
  }, [activeModule, hasPermission]);

  // Auto-expand the group containing the current pathname
  const initialExpanded = useMemo(() => {
    for (const bucket of buckets) {
      if (bucket.items.some((i) => pathname === i.href || pathname?.startsWith(i.href + "/"))) {
        return bucket.label ?? "__flat__";
      }
    }
    return buckets[0]?.label ?? "__flat__";
  }, [buckets, pathname]);

  const [expanded, setExpanded] = useState<string | null>(initialExpanded);

  // Reset expansion when the menu opens so it tracks the current page
  useEffect(() => {
    if (open) setExpanded(initialExpanded);
  }, [open, initialExpanded]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!mounted || !open || !activeModule) return null;

  return (
    <>
      {/* Transparent capture layer — no dim, no blur */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-40 cursor-default bg-transparent"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label={`${activeModule.title} navigation`}
        className={cn(
          "fixed z-50 flex flex-col rounded-xl border border-border bg-card shadow-2xl",
          // Desktop anchor: beside the sidebar, below the topbar
          "lg:left-[17rem] lg:top-16 lg:w-72 lg:max-h-[75vh]",
          // Mobile: bottom sheet
          "bottom-0 left-0 right-0 max-h-[75vh] lg:bottom-auto lg:right-auto",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{activeModule.title}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {buckets.map((bucket) => {
            const key = bucket.label ?? "__flat__";
            const isExpanded = expanded === key;

            // Flat (ungrouped) modules: render items directly, no header
            if (bucket.label === null) {
              return (
                <div key={key} className="py-1">
                  {bucket.items.map((item) => (
                    <LeafLink
                      key={item.href}
                      item={item}
                      pathname={pathname ?? ""}
                      onSelect={() => setOpen(false)}
                    />
                  ))}
                </div>
              );
            }

            return (
              <div key={key}>
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : key)}
                  className="flex w-full items-center justify-between px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent/50"
                  aria-expanded={isExpanded}
                >
                  <span className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    {bucket.label}
                  </span>
                  {!isExpanded && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {bucket.items.length}
                    </span>
                  )}
                </button>
                {isExpanded && (
                  <div className="pb-1">
                    {bucket.items.map((item) => (
                      <LeafLink
                        key={item.href}
                        item={item}
                        pathname={pathname ?? ""}
                        onSelect={() => setOpen(false)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function LeafLink({
  item,
  pathname,
  onSelect,
}: {
  item: NavItem;
  pathname: string;
  onSelect: () => void;
}) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
  return (
    <Link
      href={item.href}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-2 px-6 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-primary/10 font-medium text-foreground"
          : "text-foreground hover:bg-accent",
      )}
    >
      <span className="truncate">{item.title}</span>
    </Link>
  );
}
