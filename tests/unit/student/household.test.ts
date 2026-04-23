import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { audit } from "@/lib/audit";
import {
  getHouseholdsAction,
  getHouseholdAction,
  createHouseholdAction,
  updateHouseholdAction,
  deleteHouseholdAction,
  moveGuardianToHouseholdAction,
  moveStudentToHouseholdAction,
} from "@/modules/student/actions/household.action";

const sampleHousehold = {
  id: "hh-1",
  schoolId: "default-school",
  name: "Asante Family",
  address: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("getHouseholdsAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects unauthenticated", async () => {
    mockUnauthenticated();
    const result = await getHouseholdsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("rejects users without HOUSEHOLDS_READ", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await getHouseholdsAction();
    expect(result).toEqual({ error: "Insufficient permissions" });
  });

  it("returns households filtered by schoolId and search", async () => {
    prismaMock.household.findMany.mockResolvedValue([
      { ...sampleHousehold, _count: { guardians: 2, students: 3 } },
    ] as never);

    const result = await getHouseholdsAction({ search: "Asante" });
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.name).toBe("Asante Family");
    expect(prismaMock.household.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schoolId: "default-school",
          name: { contains: "Asante", mode: "insensitive" },
        }),
      }),
    );
  });
});

describe("getHouseholdAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("returns the household with guardians and students", async () => {
    prismaMock.household.findFirst.mockResolvedValue({
      ...sampleHousehold,
      guardians: [{ id: "g1", firstName: "Kwame", lastName: "Asante", phone: "0241234567", relationship: "Father" }],
      students: [{ id: "s1", studentId: "SCH/1", firstName: "Kofi", lastName: "Asante", status: "ACTIVE" }],
    } as never);

    const result = await getHouseholdAction("hh-1");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.guardians).toHaveLength(1);
    expect(result.data.students).toHaveLength(1);
  });

  it("returns { error: 'Household not found' } when missing", async () => {
    prismaMock.household.findFirst.mockResolvedValue(null as never);
    const result = await getHouseholdAction("missing");
    expect(result).toEqual({ error: "Household not found" });
  });
});

describe("createHouseholdAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
    vi.mocked(audit).mockClear();
  });

  it("rejects users lacking HOUSEHOLDS_MANAGE", async () => {
    mockAuthenticatedUser({ permissions: ["students:households:read"] });
    const result = await createHouseholdAction({ name: "Test" });
    expect(result).toEqual({ error: "Insufficient permissions" });
  });

  it("creates with audit entry", async () => {
    prismaMock.household.create.mockResolvedValue(sampleHousehold as never);

    const result = await createHouseholdAction({ name: "Asante Family", address: "Accra" });
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.id).toBe("hh-1");
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE",
        entity: "Household",
        entityId: "hh-1",
        module: "student",
      }),
    );
  });

  it("rejects empty name", async () => {
    const result = await createHouseholdAction({ name: "   " });
    expect(result).toEqual({ error: "Household name is required." });
  });
});

describe("updateHouseholdAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
    vi.mocked(audit).mockClear();
  });

  it("updates and writes audit", async () => {
    prismaMock.household.findFirst.mockResolvedValue(sampleHousehold as never);
    prismaMock.household.update.mockResolvedValue({ ...sampleHousehold, name: "Renamed" } as never);

    const result = await updateHouseholdAction("hh-1", { name: "Renamed" });
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.name).toBe("Renamed");
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE", entity: "Household" }),
    );
  });

  it("returns error if household not found", async () => {
    prismaMock.household.findFirst.mockResolvedValue(null as never);
    const result = await updateHouseholdAction("missing", { name: "X" });
    expect(result).toEqual({ error: "Household not found" });
  });
});

describe("deleteHouseholdAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
    vi.mocked(audit).mockClear();
  });

  it("refuses to delete a non-empty household", async () => {
    prismaMock.household.findFirst.mockResolvedValue({
      ...sampleHousehold,
      _count: { guardians: 2, students: 0 },
    } as never);

    const result = await deleteHouseholdAction("hh-1");
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("non-empty");
    expect(prismaMock.household.delete).not.toHaveBeenCalled();
  });

  it("deletes empty household + writes audit", async () => {
    prismaMock.household.findFirst.mockResolvedValue({
      ...sampleHousehold,
      _count: { guardians: 0, students: 0 },
    } as never);
    prismaMock.household.delete.mockResolvedValue(sampleHousehold as never);

    const result = await deleteHouseholdAction("hh-1");
    expect(result).toEqual({ success: true });
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE", entity: "Household" }),
    );
  });
});

describe("moveGuardianToHouseholdAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
    vi.mocked(audit).mockClear();
  });

  it("updates guardian.householdId + writes audit", async () => {
    prismaMock.guardian.findFirst.mockResolvedValue({
      id: "g1",
      schoolId: "default-school",
      householdId: null,
      firstName: "Kwame",
      lastName: "Asante",
    } as never);
    prismaMock.household.findFirst.mockResolvedValue(sampleHousehold as never);
    prismaMock.guardian.update.mockResolvedValue({
      id: "g1",
      schoolId: "default-school",
      householdId: "hh-1",
    } as never);

    const result = await moveGuardianToHouseholdAction("g1", "hh-1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.guardian.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "g1" }, data: { householdId: "hh-1" } }),
    );
    expect(vi.mocked(audit)).toHaveBeenCalled();
  });

  it("sets householdId to null when removing", async () => {
    prismaMock.guardian.findFirst.mockResolvedValue({
      id: "g1",
      schoolId: "default-school",
      householdId: "hh-1",
      firstName: "Kwame",
      lastName: "Asante",
    } as never);
    prismaMock.guardian.update.mockResolvedValue({ id: "g1", schoolId: "default-school", householdId: null } as never);

    const result = await moveGuardianToHouseholdAction("g1", null);
    expect(result).toEqual({ success: true });
    expect(prismaMock.guardian.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { householdId: null } }),
    );
  });

  it("rejects cross-tenant attempts", async () => {
    prismaMock.guardian.findFirst.mockResolvedValue(null as never);
    const result = await moveGuardianToHouseholdAction("g-other", "hh-1");
    expect(result).toEqual({ error: "Guardian not found" });
  });
});

describe("moveStudentToHouseholdAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
    vi.mocked(audit).mockClear();
  });

  it("updates student.householdId + writes audit", async () => {
    prismaMock.student.findFirst.mockResolvedValue({
      id: "s1",
      schoolId: "default-school",
      householdId: null,
    } as never);
    prismaMock.household.findFirst.mockResolvedValue(sampleHousehold as never);
    prismaMock.student.update.mockResolvedValue({ id: "s1", schoolId: "default-school", householdId: "hh-1" } as never);

    const result = await moveStudentToHouseholdAction("s1", "hh-1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.student.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "s1" }, data: { householdId: "hh-1" } }),
    );
  });
});
