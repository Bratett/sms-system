"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, User, Users, BookOpen, Package, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  globalSearchAction,
  type GlobalSearchResult,
} from "@/modules/search/actions/search.action";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
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
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  function handleNavigate(path: string) {
    setOpen(false);
    router.push(path);
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) {
      setOpen(false);
    }
  }

  const hasResults =
    results &&
    (results.students.length > 0 ||
      results.staff.length > 0 ||
      results.subjects.length > 0 ||
      results.items.length > 0);

  const noResults = results && !hasResults && query.trim().length >= 2;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Search...</span>
        <kbd className="hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium md:inline">
          Ctrl+K
        </kbd>
      </button>
    );
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students, staff, subjects, items..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="shrink-0 rounded p-0.5 hover:bg-accent"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <kbd className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
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
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No results found
            </div>
          )}

          {!loading && hasResults && (
            <div className="py-2">
              {/* Students */}
              {results.students.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 text-xs font-semibold uppercase text-muted-foreground">
                    Students
                  </div>
                  {results.students.map((student) => (
                    <button
                      key={student.id}
                      onClick={() => handleNavigate(`/students/${student.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent"
                    >
                      <User className="h-4 w-4 shrink-0 text-blue-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{student.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {student.studentId}
                          {student.class && ` - ${student.class}`}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                          student.status === "ACTIVE"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                        )}
                      >
                        {student.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Staff */}
              {results.staff.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 text-xs font-semibold uppercase text-muted-foreground">
                    Staff
                  </div>
                  {results.staff.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => handleNavigate(`/hr/staff/${member.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent"
                    >
                      <Users className="h-4 w-4 shrink-0 text-purple-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{member.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {member.staffId} - {member.type.replace(/_/g, " ")}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                          member.status === "ACTIVE"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                        )}
                      >
                        {member.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Subjects */}
              {results.subjects.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 text-xs font-semibold uppercase text-muted-foreground">
                    Subjects
                  </div>
                  {results.subjects.map((subject) => (
                    <button
                      key={subject.id}
                      onClick={() => handleNavigate("/academics/subjects")}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent"
                    >
                      <BookOpen className="h-4 w-4 shrink-0 text-amber-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{subject.name}</p>
                        {subject.code && (
                          <p className="truncate text-xs text-muted-foreground">{subject.code}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Store Items */}
              {results.items.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 text-xs font-semibold uppercase text-muted-foreground">
                    Store Items
                  </div>
                  {results.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate("/inventory/items")}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent"
                    >
                      <Package className="h-4 w-4 shrink-0 text-emerald-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.category ?? "Uncategorized"} - Qty: {item.quantity}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && !results && query.trim().length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Start typing to search...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
