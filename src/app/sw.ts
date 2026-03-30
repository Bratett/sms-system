import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, NetworkFirst, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Cache API responses with network-first strategy
    {
      matcher: /^\/api\/(?!auth|webhooks|upload).*/i,
      handler: new NetworkFirst({
        cacheName: "api-cache",
        plugins: [],
        networkTimeoutSeconds: 5,
      }),
    },
    // Cache static assets with cache-first strategy
    {
      matcher: /\.(?:js|css|woff2?|ttf|otf|eot)$/i,
      handler: new CacheFirst({
        cacheName: "static-assets",
        plugins: [],
      }),
    },
    // Cache images
    {
      matcher: /\.(?:png|jpg|jpeg|svg|gif|ico|webp)$/i,
      handler: new CacheFirst({
        cacheName: "image-cache",
        plugins: [],
      }),
    },
    // Default caching from Serwist
    ...defaultCache,
  ],
});

serwist.addEventListeners();

// ─── Background Sync for Offline Mutations ─────────────────────

const OFFLINE_QUEUES = {
  ATTENDANCE: "offline-attendance",
  MARKS: "offline-marks",
} as const;

self.addEventListener("sync", (event: ExtendableEvent & { tag?: string }) => {
  if (event.tag === OFFLINE_QUEUES.ATTENDANCE) {
    event.waitUntil(syncOfflineData("attendance"));
  }
  if (event.tag === OFFLINE_QUEUES.MARKS) {
    event.waitUntil(syncOfflineData("marks"));
  }
});

async function syncOfflineData(type: string) {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(`${type}-queue`, "readonly");
    const store = tx.objectStore(`${type}-queue`);
    const items = await getAllFromStore(store);

    for (const item of items) {
      try {
        const response = await fetch(item.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.data),
        });

        if (response.ok) {
          const deleteTx = db.transaction(`${type}-queue`, "readwrite");
          deleteTx.objectStore(`${type}-queue`).delete(item.id);
        }
      } catch {
        break;
      }
    }

    db.close();
  } catch {
    // Will retry on next sync
  }
}

function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("sms-offline", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("attendance-queue")) {
        db.createObjectStore("attendance-queue", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("marks-queue")) {
        db.createObjectStore("marks-queue", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllFromStore(store: IDBObjectStore): Promise<Array<{ id: number; url: string; data: unknown }>> {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
