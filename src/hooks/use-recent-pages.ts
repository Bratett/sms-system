"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const KEY = "sms:recent-pages";
const MAX = 6;

export interface RecentPage {
  href: string;
  title: string;
  icon: string;
  visitedAt: number;
}

/**
 * Track the user's most recently visited pages in localStorage. Call
 * `trackPage(title, icon)` when a page loads to record a visit, then read
 * `recent` to render the pinned list. Survives reloads and tab restarts.
 */
export function useRecentPages() {
  const pathname = usePathname();
  const [recent, setRecent] = useState<RecentPage[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {
      /* localStorage unavailable — no big deal */
    }
  }, []);

  function trackPage(title: string, icon: string) {
    if (!pathname || pathname === "/" || pathname.startsWith("/login")) return;
    setRecent((prev) => {
      const filtered = prev.filter((p) => p.href !== pathname);
      const next: RecentPage[] = [{ href: pathname, title, icon, visitedAt: Date.now() }, ...filtered].slice(0, MAX);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function clearRecent() {
    setRecent([]);
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }

  return { recent, trackPage, clearRecent };
}
