"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { navigationGroups, type NavItem } from "@/lib/navigation";
import { useRecentPages } from "@/hooks/use-recent-pages";

interface FlatItem {
  title: string;
  href: string;
  icon: string;
  groupLabel: string;
  parentTitle?: string;
  subGroup?: string;
}

function flattenNav(items: NavItem[], groupLabel: string, parentTitle?: string): FlatItem[] {
  const out: FlatItem[] = [];
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      out.push(...flattenNav(item.children, groupLabel, item.title));
    } else {
      out.push({
        title: item.title,
        href: item.href,
        icon: item.icon,
        groupLabel,
        parentTitle,
        subGroup: item.group,
      });
    }
  }
  return out;
}

/**
 * Keyboard-first quick-jump overlay. Opens with Ctrl/⌘+K from anywhere in the
 * app. Fuzzy-matches across every nav leaf (title + parent module + sub-group
 * label). Arrow keys navigate, Enter opens, Escape closes.
 */
export function CommandPalette({
  open: openProp,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const { recent } = useRecentPages();

  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
  };

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build flat searchable index of every nav leaf the user can access
  const index = useMemo<FlatItem[]>(() => {
    const all: FlatItem[] = [];
    for (const group of navigationGroups) {
      for (const item of group.items) {
        if (item.permission && !hasPermission(item.permission)) continue;
        if (item.children && item.children.length > 0) {
          const visible = item.children.filter((c) => !c.permission || hasPermission(c.permission));
          all.push(...flattenNav(visible, group.label, item.title));
        } else {
          all.push({ title: item.title, href: item.href, icon: item.icon, groupLabel: group.label });
        }
      }
    }
    return all;
  }, [hasPermission]);

  const results = useMemo<FlatItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Empty query: show recents first (mapped to index entries), then top items
      const recentHrefs = new Set(recent.map((r) => r.href));
      const recentItems: FlatItem[] = recent
        .map((r) => index.find((i) => i.href === r.href))
        .filter((i): i is FlatItem => Boolean(i));
      const others = index.filter((i) => !recentHrefs.has(i.href)).slice(0, 14);
      return [...recentItems, ...others];
    }
    return index
      .map((i) => {
        const hay = `${i.title} ${i.parentTitle ?? ""} ${i.subGroup ?? ""} ${i.groupLabel}`.toLowerCase();
        // Cheap scoring: startsWith on title is best, then includes on title, then includes anywhere
        let score = 0;
        if (i.title.toLowerCase().startsWith(q)) score = 100;
        else if (i.title.toLowerCase().includes(q)) score = 60;
        else if (hay.includes(q)) score = 30;
        return { item: i, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((x) => x.item);
  }, [query, index, recent]);

  // Global shortcut: Ctrl/⌘+K toggles the palette from anywhere
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
        setQuery("");
        setActiveIndex(0);
      }
      if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function handleInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      go(results[activeIndex].href);
    }
  }

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const showingRecents = !q && recent.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-[10vh]"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick jump"
        className="w-full max-w-xl mx-4 rounded-xl bg-card border border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKey}
            placeholder="Jump to any page…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Search"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ESC
          </kbd>
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No matches for "{query}".
            </div>
          ) : (
            <ul>
              {showingRecents && (
                <li className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent
                </li>
              )}
              {results.map((r, i) => {
                const isRecent = showingRecents && recent.some((x) => x.href === r.href) && i < recent.length;
                const prevWasRecent = i > 0 && showingRecents && recent.some((x) => x.href === results[i - 1].href) && i - 1 < recent.length;
                const showSeparator = showingRecents && prevWasRecent && !isRecent;
                return (
                  <li key={r.href}>
                    {showSeparator && (
                      <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        All pages
                      </div>
                    )}
                    <button
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => go(r.href)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                        i === activeIndex ? "bg-primary/10 text-foreground" : "text-foreground hover:bg-muted",
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="truncate">
                          {r.parentTitle && (
                            <span className="text-muted-foreground">{r.parentTitle} › </span>
                          )}
                          {r.subGroup && (
                            <span className="text-muted-foreground">{r.subGroup} › </span>
                          )}
                          <span className="font-medium">{r.title}</span>
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground font-mono">{r.href}</div>
                      </div>
                      {i === activeIndex && <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-muted px-1 py-0.5 font-mono">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-muted px-1 py-0.5 font-mono">↵</kbd>
              open
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">Ctrl</kbd>
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">K</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}
