/**
 * IndexedDB-based offline storage for queuing mutations when offline.
 * Used for attendance recording and mark entry which are critical
 * operations in low-connectivity environments.
 */

const DB_NAME = "sms-offline";
const DB_VERSION = 1;

interface OfflineEntry {
  id?: number;
  url: string;
  data: unknown;
  timestamp: number;
  type: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

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

export async function queueOfflineOperation(
  storeName: "attendance-queue" | "marks-queue",
  url: string,
  data: unknown,
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);

  const entry: OfflineEntry = {
    url,
    data,
    timestamp: Date.now(),
    type: storeName.replace("-queue", ""),
  };

  store.add(entry);
  db.close();

  // Request background sync if available
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    const registration = await navigator.serviceWorker.ready;
    await (registration as unknown as { sync: { register(tag: string): Promise<void> } }).sync.register(
      storeName === "attendance-queue" ? "offline-attendance" : "offline-marks",
    );
  }
}

export async function getPendingOperations(
  storeName: "attendance-queue" | "marks-queue",
): Promise<OfflineEntry[]> {
  const db = await openDB();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function clearPendingOperations(
  storeName: "attendance-queue" | "marks-queue",
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).clear();
  db.close();
}

export async function getPendingCount(): Promise<number> {
  const db = await openDB();
  let total = 0;

  for (const storeName of ["attendance-queue", "marks-queue"] as const) {
    const tx = db.transaction(storeName, "readonly");
    const count = await new Promise<number>((resolve, reject) => {
      const request = tx.objectStore(storeName).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    total += count;
  }

  db.close();
  return total;
}
