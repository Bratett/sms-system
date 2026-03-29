"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, CheckCheck, Info, CircleCheck, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationStream } from "@/hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";

const typeConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  INFO: { icon: <Info className="h-3.5 w-3.5" />, color: "bg-blue-100 text-blue-600" },
  SUCCESS: {
    icon: <CircleCheck className="h-3.5 w-3.5" />,
    color: "bg-emerald-100 text-emerald-600",
  },
  WARNING: {
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    color: "bg-amber-100 text-amber-600",
  },
  ERROR: { icon: <XCircle className="h-3.5 w-3.5" />, color: "bg-red-100 text-red-600" },
};

function groupByTime<T extends { createdAt: Date | string }>(notifications: T[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);

  const today: typeof notifications = [];
  const yesterday: typeof notifications = [];
  const earlier: typeof notifications = [];

  for (const n of notifications) {
    const date = new Date(n.createdAt);
    if (date >= todayStart) today.push(n);
    else if (date >= yesterdayStart) yesterday.push(n);
    else earlier.push(n);
  }

  return { today, yesterday, earlier };
}

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotificationStream();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const groups = groupByTime(notifications);

  function renderNotification(notification: (typeof notifications)[0]) {
    const config = typeConfig[notification.type] || typeConfig.INFO;
    return (
      <div
        key={notification.id}
        className={cn(
          "flex gap-3 px-4 py-3 transition-colors",
          !notification.isRead && "bg-primary-soft",
        )}
      >
        <div
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            config.color,
          )}
        >
          {config.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm", !notification.isRead && "font-medium")}>
            {notification.title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            {notification.message}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/70">
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
          </p>
        </div>
        {!notification.isRead && (
          <button
            onClick={() => markAsRead(notification.id)}
            className="shrink-0 self-start rounded-md p-1 transition-colors hover:bg-accent"
            title="Mark as read"
          >
            <Check className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    );
  }

  function renderGroup(label: string, items: typeof notifications) {
    if (items.length === 0) return null;
    return (
      <div key={label}>
        <div className="sticky top-0 bg-card px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="divide-y divide-border">{items.map(renderNotification)}</div>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 transition-colors hover:bg-accent"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-[360px] rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Bell className="mx-auto h-8 w-8 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              <>
                {renderGroup("Today", groups.today)}
                {renderGroup("Yesterday", groups.yesterday)}
                {renderGroup("Earlier", groups.earlier)}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
