"use client";

import { useEffect, useRef, useCallback } from "react";
import type { RealtimeEvent, RealtimeEventType } from "@/lib/realtime/types";

interface UseRealtimeOptions {
  events?: RealtimeEventType[];
  onEvent?: (event: RealtimeEvent) => void;
  enabled?: boolean;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const { events, onEvent, enabled = true } = options;
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!enabled || typeof window === "undefined") return;

    const es = new EventSource("/api/realtime/stream");

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as RealtimeEvent;
        if (events && !events.includes(data.type)) return;
        onEventRef.current?.(data);
      } catch {
        // heartbeat or parse error
      }
    };

    es.onerror = () => {
      es.close();
      setTimeout(connect, 5000);
    };

    eventSourceRef.current = es;
  }, [enabled, events]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
    };
  }, [connect]);
}
