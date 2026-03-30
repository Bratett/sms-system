import type { RealtimeEvent } from "./types";

type EventHandler = (event: RealtimeEvent) => void;

/**
 * In-process event emitter for real-time updates.
 * In a multi-server deployment, replace with Redis pub/sub.
 */
class RealtimeEventEmitter {
  private handlers = new Map<string, Set<EventHandler>>();

  subscribe(schoolId: string, handler: EventHandler): () => void {
    if (!this.handlers.has(schoolId)) {
      this.handlers.set(schoolId, new Set());
    }
    this.handlers.get(schoolId)!.add(handler);

    return () => {
      this.handlers.get(schoolId)?.delete(handler);
      if (this.handlers.get(schoolId)?.size === 0) {
        this.handlers.delete(schoolId);
      }
    };
  }

  emit(schoolId: string, event: RealtimeEvent): void {
    const handlers = this.handlers.get(schoolId);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error("[Realtime] Handler error:", error);
      }
    }
  }

  subscriberCount(schoolId: string): number {
    return this.handlers.get(schoolId)?.size ?? 0;
  }
}

const globalForRealtime = globalThis as unknown as {
  realtimeEmitter: RealtimeEventEmitter | undefined;
};

export const realtimeEmitter =
  globalForRealtime.realtimeEmitter ?? new RealtimeEventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForRealtime.realtimeEmitter = realtimeEmitter;
}
