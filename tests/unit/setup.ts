import { vi } from "vitest";
import { type PrismaClient } from "@prisma/client";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";

// ─── Prisma Mock ───────────────────────────────────────────────────

export const prismaMock = mockDeep<PrismaClient>();

vi.mock("@/lib/db", () => ({
  db: prismaMock,
}));

// ─── Auth Mock ─────────────────────────────────────────────────────

export const authMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

// Default: authenticated user with school context
export function mockAuthenticatedUser(overrides?: Record<string, unknown>) {
  authMock.mockResolvedValue({
    user: {
      id: "test-user-id",
      email: "admin@school.edu.gh",
      name: "Test Admin",
      roles: ["super_admin"],
      permissions: ["*"],
      schoolId: "default-school",
      schoolName: "Ghana SHS Demo",
      schools: [{ id: "default-school", name: "Ghana SHS Demo", logoUrl: null, isDefault: true }],
      ...overrides,
    },
  });
}

export function mockUnauthenticated() {
  authMock.mockResolvedValue(null);
}

// ─── Audit Mock ────────────────────────────────────────────────────

vi.mock("@/lib/audit", () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

// ─── Queue Mock ────────────────────────────────────────────────────

const mockQueue = {
  add: vi.fn().mockResolvedValue({ id: "mock-job-id" }),
};

vi.mock("@/lib/queue", () => ({
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
}));

// ─── Next.js cache / revalidate Mock ───────────────────────────────
// revalidatePath / revalidateTag require an active request context to work.
// Actions calling them from unit tests would otherwise throw; neutralise.

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

// ─── Reset between tests ──────────────────────────────────────────

beforeEach(() => {
  mockReset(prismaMock);
  vi.clearAllMocks();
  mockAuthenticatedUser();

  // Default $transaction: support both callback and array forms.
  // Callback form invokes fn with the mocked client (treat as tx).
  // Array form resolves to an empty array of the same length.
  // Individual tests can override with mockResolvedValue / mockResolvedValueOnce.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prismaMock.$transaction as unknown as { mockImplementation: (fn: any) => void }).mockImplementation(
    async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: unknown) => Promise<unknown>)(prismaMock);
      }
      if (Array.isArray(arg)) {
        return Promise.all(arg) as unknown as Promise<unknown[]>;
      }
      return undefined;
    },
  );

  // Default workflow mocks: tests can override per-case.
  // findUnique returns null → auto-start path; create echoes input so currentState
  // reflects the entity's status that the action passed in.
  prismaMock.workflowInstance.findUnique.mockResolvedValue(null as never);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prismaMock.workflowInstance.create as any).mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    id: "wf-instance-mock",
    status: "ACTIVE",
    ...args.data,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prismaMock.workflowInstance.update as any).mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    id: "wf-instance-mock",
    status: "ACTIVE",
    ...args.data,
  }));
  prismaMock.workflowTransition.create.mockResolvedValue({ id: "wf-transition-mock" } as never);

  // Default school
  prismaMock.school.findFirst.mockResolvedValue({
    id: "default-school",
    name: "Ghana SHS Demo",
    type: "DAY_BOARDING",
    category: "PUBLIC",
    region: "Greater Accra",
    district: null,
    town: null,
    address: null,
    phone: null,
    email: null,
    website: null,
    motto: null,
    logoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never);
});
