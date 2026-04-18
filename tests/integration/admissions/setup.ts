/**
 * Admissions integration test setup.
 *
 * Uses the REAL Prisma client (no @/lib/db mock) against DATABASE_URL, but
 * mocks auth, queues, and Next.js cache so server actions can be called
 * directly without a full request/session.
 *
 * Tests are expected to create their own fixture rows and clean them up in
 * afterAll. `SCHOOL_ID = "default-school"` must exist in the DB via seed.
 */

import { vi } from "vitest";

// ─── Auth mock ────────────────────────────────────────────────────
export const authMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

export function loginAs(overrides?: Record<string, unknown>) {
  authMock.mockResolvedValue({
    user: {
      id: "integration-test-user",
      email: "admin@school.edu.gh",
      name: "Integration Test",
      roles: ["super_admin"],
      permissions: ["*"],
      schoolId: "default-school",
      schoolName: "Ghana SHS Demo",
      schools: [
        { id: "default-school", name: "Ghana SHS Demo", logoUrl: null, isDefault: true },
      ],
      ...overrides,
    },
  });
}

// ─── Queue mock (BullMQ would otherwise try to connect) ───────────
vi.mock("@/lib/queue", () => {
  const mockQueue = { add: vi.fn().mockResolvedValue({ id: "mock-job" }) };
  return {
    getQueue: vi.fn().mockReturnValue(mockQueue),
    QUEUE_NAMES: {
      SMS: "sms-delivery",
      EMAIL: "email-delivery",
      EXPORT: "report-export",
      BULK_IMPORT: "bulk-import",
      NOTIFICATIONS: "notifications",
      WHATSAPP: "whatsapp-delivery",
      CAMPAIGN_DISPATCH: "campaign-dispatch",
    },
  };
});

// ─── Next.js cache mock ──────────────────────────────────────────
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

// R2 storage signed-URL generation fails without real credentials.
// Return a deterministic stub so tests can inspect without network IO.
vi.mock("@/lib/storage/r2", () => ({
  getSignedDownloadUrl: vi.fn().mockResolvedValue("https://r2.example.com/signed-mock"),
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  generateFileKey: (module: string, entityId: string, filename: string) =>
    `${module}/${entityId}/${filename}`,
}));

// Default: log in as super-admin placeholder. Individual tests should call
// `beforeAll(async () => loginAs({ id: <real admin id> }))` after fetching
// the seeded user so AuditLog's userId FK resolves.
loginAs();

/**
 * Resolve the seeded admin user's id. Callers use this inside `beforeAll` to
 * swap the placeholder actor for a real FK-satisfying userId.
 */
export async function resolveSeededAdminId(): Promise<string> {
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  try {
    const admin = await db.user.findUnique({
      where: { email: "admin@school.edu.gh" },
      select: { id: true },
    });
    if (!admin) {
      throw new Error(
        'Seeded admin user "admin@school.edu.gh" not found. Run `npm run db:seed`.',
      );
    }
    return admin.id;
  } finally {
    await db.$disconnect();
  }
}
