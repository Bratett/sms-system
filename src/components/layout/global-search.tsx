"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, User, Users, BookOpen, Package, X, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  globalSearchAction,
  type GlobalSearchResult,
} from "@/modules/search/actions/search.action";

interface FlatResult {
  id: string;
  type: "student" | "staff" | "subject" | "item";
  path: string;
  name: string;
  detail: string;
  status?: string;
}

function flattenResults(results: GlobalSearchResult): FlatResult[] {
  const flat: FlatResult[] = [];
  for (const s of results.students) {
    flat.push({
      id: s.id,
      type: "student",
      path: `/students/${s.id}`,
      name: s.name,
      detail: `${s.studentId}${s.class ? ` · ${s.class}` : ""}`,
      status: s.status,
    });
  }
  for (const s of results.staff) {
    flat.push({
      id: s.id,
      type: "staff",
      path: `/hr/staff/${s.id}`,
      name: s.name,
      detail: `${s.staffId} · ${s.type.replace(/_/g, " ")}`,
      status: s.status,
    });
  }
  for (const s of results.subjects) {
    flat.push({
      id: s.id,
      type: "subject",
      path: "/academics/subjects",
      name: s.name,
      detail: s.code || "Subject",
    });
  }
  for (const s of results.items) {
    flat.push({
      id: s.id,
      type: "item",
      path: "/inventory/items",
      name: s.name,
      detail: `${s.category ?? "Uncategorized"} · Qty: ${s.quantity}`,
    });
  }
  return flat;
}

const typeIcons: Record<string, { icon: React.ReactNode; color: string }> = {
  student: { icon: <User className="h-4 w-4" />, color: "text-blue-500 bg-blue-50" },
  staff: { icon: <Users className="h-4 w-4" />, color: "text-purple-500 bg-purple-50" },
  subject: { icon: <BookOpen className="h-4 w-4" />, color: "text-amber-500 bg-amber-50" },
  item: { icon: <Package className="h-4 w-4" />, color: "text-emerald-500 bg-emerald-50" },
};

const typeLabels: Record<string, string> = {
  student: "Students",
  staff: "Staff",
  subject: "Subjects",
  item: "Store Items",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
      setResults(null);
      setActiveIndex(-1);
    }
  }, [open]);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await globalSearchAction(searchQuery);
    if (!("error" in result)) {
      setResults(result);
    }
    setLoading(false);
    setActiveIndex(-1);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, performSearch]);

  const flatResults = results ? flattenResults(results) : [];

  function handleNavigate(path: string) {
    setOpen(false);
    router.push(path);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < flatResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : flatResults.length - 1));
    } else if (e.key === "Enter" && activeIndex >= 0 && flatResults[activeIndex]) {
      e.preventDefault();
      handleNavigate(flatResults[activeIndex].path);
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) setOpen(false);
  }

  const hasResults = flatResults.length > 0;
  const noResults = results && !hasResults && query.trim().length >= 2;

  // Group flat results by type for section headers
  const groupedTypes = hasResults
    ? [...new Set(flatResults.map((r) => r.type))]
    : [];

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Search...</span>
        <kbd className="hidden rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium md:inline">
          Ctrl+K
        </kbd>
      </button>
    );
  }

  let flatIndex = -1;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-[15vh]"
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search students, staff, subjects, items..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="shrink-0 rounded-md p-0.5 transition-colors hover:bg-accent"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <kbd className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          )}

          {!loading && noResults && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No results found for &ldquo;{query}&rdquo;</p>
              <p className="mt-1 text-xs text-muted-foreground/70">Try a different search term</p>
            </div>
          )}

          {!loading && hasResults && (
            <div className="py-1.5">
              {groupedTypes.map((type) => {
                const typeResults = flatResults.filter((r) => r.type === type);
                const config = typeIcons[type];
                return (
                  <div key={type}>
                    <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {typeLabels[type]}
                    </div>
                    {typeResults.map((result) => {
                      flatIndex++;
                      const idx = flatIndex;
                      return (
                        <button
                          key={result.id}
                          onClick={() => handleNavigate(result.path)}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                            idx === activeIndex ? "bg-accent" : "hover:bg-accent/50",
                          )}
                        >
                          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", config.color)}>
                            {config.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{result.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{result.detail}</p>
                          </div>
                          {result.status && (
                            <StatusBadge status={result.status} className="shrink-0" />
                          )}
                          {idx === activeIndex && (
                            <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {!loading && !results && query.trim().length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">Start typing to search...</p>
              <p className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground/70">
                <span className="flex items-center gap-1">
                  <kbd className="rounded bg-muted px-1 py-0.5 text-[10px] font-medium">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded bg-muted px-1 py-0.5 text-[10px] font-medium">↵</kbd>
                  Open
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded bg-muted px-1 py-0.5 text-[10px] font-medium">Esc</kbd>
                  Close
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
