"use client";

import { useEffect, useRef } from "react";
import type { RealtimeEvent, RealtimeEventType } from "@/lib/realtime/types";

interface UseRealtimeOptions {
  events?: RealtimeEventType[];
  onEvent?: (event: RealtimeEvent) => void;
  enabled?: boolean;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const { events, onEvent, enabled = true } = options;
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    function connect() {
      const es = new EventSource("/api/realtime/stream");

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as RealtimeEvent;
          if (events && !events.includes(data.type)) return;
          onEvent?.(data);
        } catch {
          // heartbeat or parse error
        }
      };

      es.onerror = () => {
        es.close();
        reconnectTimerRef.current = setTimeout(connect, 5000);
      };

      eventSourceRef.current = es;
    }

    connect();

    return () => {
      clearTimeout(reconnectTimerRef.current);
      eventSourceRef.current?.close();
    };
  }, [enabled, events, onEvent]);
}
