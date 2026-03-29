import { Queue, Worker, type Job, type WorkerOptions, type QueueOptions } from "bullmq";
import IORedis from "ioredis";

// ─── Redis Connection ──────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let connection: IORedis | undefined;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return connection;
}

// ─── Queue Factory ─────────────────────────────────────────────────

const queues = new Map<string, Queue>();

export function getQueue<T = unknown>(name: string, opts?: Partial<QueueOptions>): Queue<T> {
  if (!queues.has(name)) {
    const queue = new Queue<T>(name, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800, count: 5000 },
      },
      ...opts,
    });
    queues.set(name, queue as unknown as Queue);
  }
  return queues.get(name) as unknown as Queue<T>;
}

// ─── Worker Factory ────────────────────────────────────────────────

export function createWorker<T = unknown>(
  queueName: string,
  processor: (job: Job<T>) => Promise<void>,
  opts?: Partial<WorkerOptions>,
): Worker<T> {
  return new Worker<T>(queueName, processor, {
    connection: getRedisConnection(),
    concurrency: 5,
    ...opts,
  });
}

// ─── Queue Names ───────────────────────────────────────────────────

export const QUEUE_NAMES = {
  SMS: "sms-delivery",
  EMAIL: "email-delivery",
  EXPORT: "report-export",
  BULK_IMPORT: "bulk-import",
  NOTIFICATIONS: "notifications",
} as const;

// ─── Job Type Definitions ──────────────────────────────────────────

export interface SmsJobData {
  smsLogId: string;
  phone: string;
  message: string;
  senderId?: string;
}

export interface EmailJobData {
  to: string | string[];
  subject: string;
  template: string;
  data: Record<string, unknown>;
}

export interface ExportJobData {
  module: string;
  format: "csv" | "xlsx" | "pdf";
  filters: Record<string, unknown>;
  userId: string;
  schoolId: string;
}

export interface BulkImportJobData {
  type: string;
  fileUrl: string;
  userId: string;
  schoolId: string;
}

export interface NotificationJobData {
  event: string;
  recipientIds: string[];
  channels: ("in_app" | "sms" | "email")[];
  data: Record<string, unknown>;
}
