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
  },
}));

// ─── Reset between tests ──────────────────────────────────────────

beforeEach(() => {
  mockReset(prismaMock);
  vi.clearAllMocks();
  mockAuthenticatedUser();

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
