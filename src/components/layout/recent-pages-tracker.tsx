"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRecentPages } from "@/hooks/use-recent-pages";
import { navigationGroups, type NavItem } from "@/lib/navigation";

/**
 * Invisible component mounted once in the dashboard shell. On every route
 * change it looks up the matching nav leaf (to recover its title + icon) and
 * records it in the recent-pages list for the sidebar + command palette.
 */
export function RecentPagesTracker() {
  const pathname = usePathname();
  const { trackPage } = useRecentPages();

  useEffect(() => {
    if (!pathname) return;
    const match = findNavItemByHref(pathname);
    if (match) trackPage(match.title, match.icon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}

function findNavItemByHref(href: string): NavItem | null {
  // Prefer exact match; fall back to the deepest prefix match so dynamic
  // sub-routes still get bucketed under their parent nav leaf.
  let bestPrefixMatch: NavItem | null = null;
  let bestPrefixLen = 0;

  function walk(items: NavItem[]) {
    for (const item of items) {
      if (item.href === href) throw { exact: item };
      if (item.children && item.children.length > 0) {
        walk(item.children);
      }
      if (item.href !== "/" && href.startsWith(item.href + "/") && item.href.length > bestPrefixLen) {
        bestPrefixMatch = item;
        bestPrefixLen = item.href.length;
      }
    }
  }

  try {
    for (const group of navigationGroups) walk(group.items);
  } catch (e) {
    if (e && typeof e === "object" && "exact" in e) return (e as { exact: NavItem }).exact;
    throw e;
  }
  return bestPrefixMatch;
}
