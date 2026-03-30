"use client";

import { useState, useEffect, useCallback } from "react";
import { getPendingCount } from "@/lib/pwa/offline-store";

interface OnlineStatus {
  isOnline: boolean;
  pendingSyncCount: number;
  lastOnlineAt: Date | null;
}

export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(null);

  const updatePendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingSyncCount(count);
    } catch {
      // IndexedDB not available
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineAt(new Date());
      updatePendingCount();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check pending count periodically
    const interval = setInterval(updatePendingCount, 10_000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [updatePendingCount]);

  return { isOnline, pendingSyncCount, lastOnlineAt };
}
