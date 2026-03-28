"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, User, Menu } from "lucide-react";
import { useState } from "react";
import { NotificationDropdown } from "@/components/layout/notification-dropdown";

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { data: session } = useSession();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden" aria-label="Toggle menu">
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="text-sm font-medium text-muted-foreground">
          Welcome back, {session?.user?.name || "User"}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <NotificationDropdown />

        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-md p-2 hover:bg-accent"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
              {session?.user?.name?.charAt(0) || "U"}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-sm font-medium">{session?.user?.name}</p>
              <p className="text-xs text-muted-foreground">
                {(session?.user as Record<string, unknown>)?.roles
                  ? ((session?.user as Record<string, unknown>)?.roles as string[])
                      .map((r: string) => r.replace(/_/g, " "))
                      .join(", ")
                  : "User"}
              </p>
            </div>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-md border border-border bg-card py-1 shadow-lg">
              <button className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-accent">
                <User className="h-4 w-4" />
                Profile
              </button>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-accent"
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
