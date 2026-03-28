"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/modules/school/actions/notification.action";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link: string | null;
  createdAt: Date;
}

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    const result = await getNotificationsAction();
    if ("notifications" in result && result.notifications) {
      setNotifications(result.notifications as Notification[]);
      setUnreadCount(result.unreadCount ?? 0);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleMarkRead(id: string) {
    await markNotificationReadAction(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  async function handleMarkAllRead() {
    await markAllNotificationsReadAction();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  const typeColors: Record<string, string> = {
    INFO: "bg-blue-500",
    SUCCESS: "bg-green-500",
    WARNING: "bg-yellow-500",
    ERROR: "bg-red-500",
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) loadNotifications();
        }}
        className="relative rounded-md p-2 hover:bg-accent"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 rounded-md border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "flex gap-3 border-b border-border px-4 py-3 last:border-0",
                    !notification.isRead && "bg-primary/5",
                  )}
                >
                  <div
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      typeColors[notification.type] || typeColors.INFO,
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{notification.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{notification.message}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {new Date(notification.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <button
                      onClick={() => handleMarkRead(notification.id)}
                      className="shrink-0 self-start rounded p-1 hover:bg-accent"
                      title="Mark as read"
                    >
                      <Check className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
