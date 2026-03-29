"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, User, Menu, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { NotificationDropdown } from "@/components/layout/notification-dropdown";
import { GlobalSearch } from "@/components/layout/global-search";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { data: session } = useSession();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close user menu on click outside or Escape
  useEffect(() => {
    if (!showUserMenu) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setShowUserMenu(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showUserMenu]);

  const userRoles = (session?.user as Record<string, unknown>)?.roles as string[] | undefined;
  const displayRole = userRoles
    ? userRoles.map((r: string) => r.replace(/_/g, " ")).join(", ")
    : "User";

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur-sm lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-1.5 transition-colors hover:bg-accent lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Breadcrumbs />
        {/* Fallback welcome on dashboard */}
        <span className="hidden text-sm text-muted-foreground lg:block">
          {/* Breadcrumbs handle context, keep this space for the academic period badge in future */}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <GlobalSearch />
        <NotificationDropdown />

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-accent"
            aria-expanded={showUserMenu}
            aria-haspopup="true"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-sm font-medium leading-tight">{session?.user?.name}</p>
              <p className="text-[11px] capitalize leading-tight text-muted-foreground">
                {displayRole}
              </p>
            </div>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-border bg-card py-1.5 shadow-lg">
              <div className="border-b border-border px-4 pb-2.5 pt-1.5 md:hidden">
                <p className="text-sm font-medium">{session?.user?.name}</p>
                <p className="text-xs capitalize text-muted-foreground">{displayRole}</p>
              </div>
              <button
                className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                onClick={() => setShowUserMenu(false)}
              >
                <User className="h-4 w-4 text-muted-foreground" />
                Profile
              </button>
              <div className="my-1 border-t border-border" />
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-destructive transition-colors hover:bg-destructive/5"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
