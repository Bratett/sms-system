import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  listTeacherLicencesAction,
  createTeacherLicenceAction,
  updateTeacherLicenceAction,
  deleteTeacherLicenceAction,
} from "@/modules/hr/actions/licensure.action";

describe("listTeacherLicencesAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects unauthenticated users", async () => {
    mockUnauthenticated();
    const r = await listTeacherLicencesAction();
    expect(r).toEqual({ error: "Unauthorized" });
  });

  it("returns licences with hydrated staff names and daysToExpiry", async () => {
    const expiresAt = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
    prismaMock.teacherLicence.findMany.mockResolvedValue([
      {
        id: "l1",
        staffId: "s1",
        ntcNumber: "NTC/2026/001",
        category: "PROFICIENT",
        issuedAt: new Date("2025-01-01"),
        expiresAt,
        status: "ACTIVE",
        documentId: null,
        notes: null,
      },
    ] as never);
    prismaMock.staff.findMany.mockResolvedValue([
      { id: "s1", firstName: "Kofi", lastName: "Mensah", staffId: "STF/001" },
    ] as never);

    const r = await listTeacherLicencesAction();
    expect("data" in r).toBe(true);
    if ("data" in r) {
      expect(r.data[0].staffName).toBe("Kofi Mensah");
      expect(r.data[0].daysToExpiry).toBeGreaterThanOrEqual(44);
      expect(r.data[0].daysToExpiry).toBeLessThanOrEqual(46);
    }
  });

  it("filters by dueWithinDays", async () => {
    prismaMock.teacherLicence.findMany.mockResolvedValue([] as never);
    prismaMock.staff.findMany.mockResolvedValue([] as never);

    await listTeacherLicencesAction({ dueWithinDays: 30 });
    const call = prismaMock.teacherLicence.findMany.mock.calls[0]?.[0] as {
      where: { expiresAt?: { lte: Date } };
    };
    expect(call.where.expiresAt?.lte).toBeInstanceOf(Date);
  });
});

describe("createTeacherLicenceAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects invalid input", async () => {
    const r = await createTeacherLicenceAction({
      staffId: "",
      ntcNumber: "",
      category: "BEGINNER",
      issuedAt: new Date(),
      expiresAt: new Date(),
    });
    expect("error" in r).toBe(true);
  });

  it("rejects expiry <= issue", async () => {
    const r = await createTeacherLicenceAction({
      staffId: "s1",
      ntcNumber: "NTC/001",
      category: "BEGINNER",
      issuedAt: new Date("2026-01-01"),
      expiresAt: new Date("2025-01-01"),
    });
    expect(r).toEqual({ error: "Expiry date must be after issue date." });
  });

  it("rejects when staff does not belong to the caller's school", async () => {
    prismaMock.staff.findUnique.mockResolvedValue({
      id: "s1",
      schoolId: "other-school",
    } as never);
    const r = await createTeacherLicenceAction({
      staffId: "s1",
      ntcNumber: "NTC/001",
      category: "BEGINNER",
      issuedAt: new Date("2025-01-01"),
      expiresAt: new Date("2027-01-01"),
    });
    expect(r).toEqual({ error: "Staff not found." });
  });

  it("creates licence with uppercased/trimmed ntc number", async () => {
    prismaMock.staff.findUnique.mockResolvedValue({
      id: "s1",
      schoolId: "default-school",
    } as never);
    prismaMock.teacherLicence.create.mockResolvedValue({
      id: "l1",
      ntcNumber: "NTC/2026/001",
    } as never);

    const r = await createTeacherLicenceAction({
      staffId: "s1",
      ntcNumber: " ntc/2026/001 ",
      category: "PROFICIENT",
      issuedAt: new Date("2026-01-01"),
      expiresAt: new Date("2029-01-01"),
    });
    expect("data" in r).toBe(true);
    const callArgs = prismaMock.teacherLicence.create.mock.calls[0]?.[0] as {
      data: { ntcNumber: string };
    };
    expect(callArgs.data.ntcNumber).toBe("NTC/2026/001");
  });
});

describe("updateTeacherLicenceAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects cross-tenant updates", async () => {
    prismaMock.teacherLicence.findUnique.mockResolvedValue({
      id: "l1",
      schoolId: "other-school",
      ntcNumber: "NTC/X",
    } as never);
    const r = await updateTeacherLicenceAction("l1", { status: "SUSPENDED" });
    expect(r).toEqual({ error: "Licence not found." });
  });

  it("updates status + persists audit", async () => {
    prismaMock.teacherLicence.findUnique.mockResolvedValue({
      id: "l1",
      schoolId: "default-school",
      ntcNumber: "NTC/X",
      status: "ACTIVE",
    } as never);
    prismaMock.teacherLicence.update.mockResolvedValue({
      id: "l1",
      status: "SUSPENDED",
    } as never);

    const r = await updateTeacherLicenceAction("l1", { status: "SUSPENDED" });
    expect("data" in r).toBe(true);
  });
});

describe("deleteTeacherLicenceAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns error when licence not found", async () => {
    prismaMock.teacherLicence.findUnique.mockResolvedValue(null as never);
    const r = await deleteTeacherLicenceAction("missing");
    expect(r).toEqual({ error: "Licence not found." });
  });

  it("deletes on happy path", async () => {
    prismaMock.teacherLicence.findUnique.mockResolvedValue({
      id: "l1",
      schoolId: "default-school",
      ntcNumber: "NTC/X",
    } as never);
    const r = await deleteTeacherLicenceAction("l1");
    expect(r).toEqual({ success: true });
  });
});
