"use client";

import { WifiOff, CloudOff, RefreshCw } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";

export function OfflineIndicator() {
  const { isOnline, pendingSyncCount } = useOnlineStatus();

  if (isOnline && pendingSyncCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm shadow-lg">
      {!isOnline ? (
        <>
          <WifiOff className="h-4 w-4 text-amber-600" />
          <span className="font-medium text-amber-800">Offline</span>
          <span className="text-amber-600">Changes will sync when reconnected</span>
        </>
      ) : pendingSyncCount > 0 ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
          <span className="font-medium text-blue-800">
            Syncing {pendingSyncCount} pending {pendingSyncCount === 1 ? "change" : "changes"}...
          </span>
        </>
      ) : (
        <>
          <CloudOff className="h-4 w-4 text-amber-600" />
          <span className="text-amber-600">Reconnected</span>
        </>
      )}
    </div>
  );
}
