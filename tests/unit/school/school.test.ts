import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";

// ─── Academic Year Actions ────────────────────────────────────────
import {
  getAcademicYearsAction,
  createAcademicYearAction,
  updateAcademicYearAction,
  deleteAcademicYearAction,
  setCurrentAcademicYearAction,
} from "@/modules/school/actions/academic-year.action";

// ─── Department Actions ───────────────────────────────────────────
import {
  getDepartmentsAction,
  createDepartmentAction,
  updateDepartmentAction,
  deleteDepartmentAction,
} from "@/modules/school/actions/department.action";

// ─── House Actions ────────────────────────────────────────────────
import {
  getHousesAction,
  createHouseAction,
  updateHouseAction,
  deleteHouseAction,
} from "@/modules/school/actions/house.action";

// ─── Programme Actions ────────────────────────────────────────────
import {
  getProgrammesAction,
  createProgrammeAction,
  updateProgrammeAction,
  deleteProgrammeAction,
} from "@/modules/school/actions/programme.action";

// ─── School Actions ───────────────────────────────────────────────
import {
  getSchoolAction,
  updateSchoolAction,
} from "@/modules/school/actions/school.action";

// ─── Term Actions ─────────────────────────────────────────────────
import {
  getTermsAction,
  createTermAction,
  updateTermAction,
  deleteTermAction,
  setCurrentTermAction,
} from "@/modules/school/actions/term.action";

// ─── Notification Actions ─────────────────────────────────────────
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  createNotificationAction,
} from "@/modules/school/actions/notification.action";

// ═══════════════════════════════════════════════════════════════════
// ACADEMIC YEAR
// ═══════════════════════════════════════════════════════════════════

describe("getAcademicYearsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getAcademicYearsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return academic years with term counts", async () => {
    prismaMock.academicYear.findMany.mockResolvedValue([
      {
        id: "ay-1",
        name: "2024/2025",
        startDate: new Date("2024-09-01"),
        endDate: new Date("2025-07-31"),
        terms: [{ id: "t-1" }, { id: "t-2" }],
      },
    ] as never);

    const result = await getAcademicYearsAction();
    expect(result.data).toHaveLength(1);
    expect(result.data![0].termCount).toBe(2);
  });
});

describe("createAcademicYearAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createAcademicYearAction({
      name: "2024/2025",
      startDate: "2024-09-01",
      endDate: "2025-07-31",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject invalid input", async () => {
    const result = await createAcademicYearAction({
      name: "",
      startDate: "",
      endDate: "",
    });
    expect(result.error).toBe("Invalid input");
    expect(result.details).toBeDefined();
  });

  it("should return error when no school context", async () => {
    mockAuthenticatedUser({ schoolId: null });

    const result = await createAcademicYearAction({
      name: "2024/2025",
      startDate: "2024-09-01",
      endDate: "2025-07-31",
    });
    expect(result).toEqual({
      error: "No school context. Please select an active school.",
    });
  });

  it("should create an academic year successfully", async () => {
    const created = {
      id: "ay-1",
      schoolId: "default-school",
      name: "2024/2025",
      startDate: new Date("2024-09-01"),
      endDate: new Date("2025-07-31"),
    };

    prismaMock.academicYear.create.mockResolvedValue(created as never);

    const result = await createAcademicYearAction({
      name: "2024/2025",
      startDate: "2024-09-01",
      endDate: "2025-07-31",
    });
    expect(result.data).toEqual(created);
    expect(prismaMock.academicYear.create).toHaveBeenCalledOnce();
  });
});

describe("updateAcademicYearAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateAcademicYearAction("ay-1", { name: "Updated" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when academic year not found", async () => {
    prismaMock.academicYear.findUnique.mockResolvedValue(null as never);

    const result = await updateAcademicYearAction("nonexistent", { name: "Updated" });
    expect(result).toEqual({ error: "Academic year not found" });
  });

  it("should update an academic year successfully", async () => {
    const existing = {
      id: "ay-1",
      name: "2024/2025",
      startDate: new Date("2024-09-01"),
      endDate: new Date("2025-07-31"),
    };

    prismaMock.academicYear.findUnique.mockResolvedValue(existing as never);

    const updated = { ...existing, name: "2024/2025 Updated" };
    prismaMock.academicYear.update.mockResolvedValue(updated as never);

    const result = await updateAcademicYearAction("ay-1", { name: "2024/2025 Updated" });
    expect(result.data).toEqual(updated);
  });
});

describe("deleteAcademicYearAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deleteAcademicYearAction("ay-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when academic year not found", async () => {
    prismaMock.academicYear.findUnique.mockResolvedValue(null as never);

    const result = await deleteAcademicYearAction("nonexistent");
    expect(result).toEqual({ error: "Academic year not found" });
  });

  it("should reject deletion when academic year has terms", async () => {
    prismaMock.academicYear.findUnique.mockResolvedValue({
      id: "ay-1",
      name: "2024/2025",
      terms: [{ id: "t-1" }],
    } as never);

    const result = await deleteAcademicYearAction("ay-1");
    expect(result).toEqual({
      error: "Cannot delete academic year that has terms. Remove all terms first.",
    });
  });

  it("should delete an academic year successfully", async () => {
    prismaMock.academicYear.findUnique.mockResolvedValue({
      id: "ay-1",
      name: "2024/2025",
      terms: [],
    } as never);

    prismaMock.academicYear.delete.mockResolvedValue({} as never);

    const result = await deleteAcademicYearAction("ay-1");
    expect(result).toEqual({ success: true });
  });
});

describe("setCurrentAcademicYearAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await setCurrentAcademicYearAction("ay-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when academic year not found", async () => {
    prismaMock.academicYear.findUnique.mockResolvedValue(null as never);

    const result = await setCurrentAcademicYearAction("nonexistent");
    expect(result).toEqual({ error: "Academic year not found" });
  });

  it("should unset previous current year and set new one", async () => {
    prismaMock.academicYear.findUnique.mockResolvedValue({
      id: "ay-1",
      name: "2024/2025",
    } as never);

    prismaMock.$transaction.mockResolvedValue([{}, {}] as never);

    const result = await setCurrentAcademicYearAction("ay-1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });
});

// ═══════════════════════════════════════════════════════════════════
// DEPARTMENTS
// ═══════════════════════════════════════════════════════════════════

describe("getDepartmentsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getDepartmentsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when no school configured", async () => {
    mockAuthenticatedUser({ schoolId: null });

    const result = await getDepartmentsAction();
    expect(result).toEqual({ error: "No school context. Please select an active school." });
  });

  it("should return departments list", async () => {
    prismaMock.department.findMany.mockResolvedValue([
      {
        id: "dept-1",
        name: "Science",
        code: "SCI",
        description: null,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { programmes: 3 },
      },
    ] as never);

    const result = await getDepartmentsAction();
    expect(result.data).toHaveLength(1);
    expect(result.data![0].programmesCount).toBe(3);
  });
});

describe("createDepartmentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createDepartmentAction({ name: "Science" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when no school configured", async () => {
    mockAuthenticatedUser({ schoolId: null });

    const result = await createDepartmentAction({ name: "Science" });
    expect(result).toEqual({ error: "No school context. Please select an active school." });
  });

  it("should reject duplicate department name", async () => {
    prismaMock.department.findUnique.mockResolvedValue({
      id: "dept-existing",
      name: "Science",
    } as never);

    const result = await createDepartmentAction({ name: "Science" });
    expect(result).toEqual({ error: 'A department named "Science" already exists.' });
  });

  it("should create a department successfully", async () => {
    prismaMock.department.findUnique.mockResolvedValue(null as never);

    const created = {
      id: "dept-1",
      schoolId: "default-school",
      name: "Science",
      code: null,
      description: null,
    };
    prismaMock.department.create.mockResolvedValue(created as never);

    const result = await createDepartmentAction({ name: "Science" });
    expect(result.data).toEqual(created);
  });
});

describe("updateDepartmentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateDepartmentAction("dept-1", { name: "Updated" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when department not found", async () => {
    prismaMock.department.findUnique.mockResolvedValue(null as never);

    const result = await updateDepartmentAction("nonexistent", { name: "Updated" });
    expect(result).toEqual({ error: "Department not found." });
  });

  it("should reject duplicate name on update", async () => {
    // First call: findUnique for existing department
    prismaMock.department.findUnique
      .mockResolvedValueOnce({
        id: "dept-1",
        name: "Science",
        schoolId: "default-school",
      } as never)
      // Second call: findUnique for duplicate check
      .mockResolvedValueOnce({
        id: "dept-2",
        name: "Arts",
      } as never);

    const result = await updateDepartmentAction("dept-1", { name: "Arts" });
    expect(result).toEqual({ error: 'A department named "Arts" already exists.' });
  });

  it("should update a department successfully", async () => {
    const existing = {
      id: "dept-1",
      name: "Science",
      code: "SCI",
      description: null,
      status: "ACTIVE",
      schoolId: "default-school",
    };

    // First call: find existing, Second call: duplicate check (no duplicate)
    prismaMock.department.findUnique
      .mockResolvedValueOnce(existing as never)
      .mockResolvedValueOnce(null as never);

    const updated = { ...existing, name: "Science Dept" };
    prismaMock.department.update.mockResolvedValue(updated as never);

    const result = await updateDepartmentAction("dept-1", { name: "Science Dept" });
    expect(result.data).toEqual(updated);
  });
});

describe("deleteDepartmentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deleteDepartmentAction("dept-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when department not found", async () => {
    prismaMock.department.findUnique.mockResolvedValue(null as never);

    const result = await deleteDepartmentAction("nonexistent");
    expect(result).toEqual({ error: "Department not found." });
  });

  it("should reject deletion when department has programmes", async () => {
    prismaMock.department.findUnique.mockResolvedValue({
      id: "dept-1",
      name: "Science",
      _count: { programmes: 2 },
    } as never);

    const result = await deleteDepartmentAction("dept-1");
    expect(result.error).toContain("Cannot delete");
    expect(result.error).toContain("2 programme(s)");
  });

  it("should delete a department successfully", async () => {
    prismaMock.department.findUnique.mockResolvedValue({
      id: "dept-1",
      name: "Science",
      _count: { programmes: 0 },
    } as never);

    prismaMock.department.delete.mockResolvedValue({} as never);

    const result = await deleteDepartmentAction("dept-1");
    expect(result).toEqual({ success: true });
  });
});

// ═══════════════════════════════════════════════════════════════════
// HOUSES
// ═══════════════════════════════════════════════════════════════════

describe("getHousesAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getHousesAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when no school configured", async () => {
    mockAuthenticatedUser({ schoolId: null });

    const result = await getHousesAction();
    expect(result).toEqual({ error: "No school context. Please select an active school." });
  });

  it("should return houses list", async () => {
    prismaMock.house.findMany.mockResolvedValue([
      {
        id: "house-1",
        name: "Eagle House",
        color: "#FF0000",
        motto: "Fly high",
        description: null,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never);

    const result = await getHousesAction();
    expect(result.data).toHaveLength(1);
    expect(result.data![0].name).toBe("Eagle House");
  });
});

describe("createHouseAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createHouseAction({ name: "Eagle House" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject duplicate house name", async () => {
    prismaMock.house.findUnique.mockResolvedValue({
      id: "house-existing",
      name: "Eagle House",
    } as never);

    const result = await createHouseAction({ name: "Eagle House" });
    expect(result).toEqual({ error: 'A house named "Eagle House" already exists.' });
  });

  it("should create a house successfully", async () => {
    prismaMock.house.findUnique.mockResolvedValue(null as never);

    const created = {
      id: "house-1",
      schoolId: "default-school",
      name: "Eagle House",
      color: null,
      motto: null,
      description: null,
    };
    prismaMock.house.create.mockResolvedValue(created as never);

    const result = await createHouseAction({ name: "Eagle House" });
    expect(result.data).toEqual(created);
  });
});

describe("updateHouseAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateHouseAction("house-1", { name: "Updated" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when house not found", async () => {
    prismaMock.house.findUnique.mockResolvedValue(null as never);

    const result = await updateHouseAction("nonexistent", { name: "Updated" });
    expect(result).toEqual({ error: "House not found." });
  });

  it("should update a house successfully", async () => {
    const existing = {
      id: "house-1",
      name: "Eagle House",
      color: null,
      motto: null,
      description: null,
      status: "ACTIVE",
      schoolId: "default-school",
    };

    // First call: find existing, Second call: duplicate check (no duplicate)
    prismaMock.house.findUnique
      .mockResolvedValueOnce(existing as never)
      .mockResolvedValueOnce(null as never);

    const updated = { ...existing, name: "Falcon House" };
    prismaMock.house.update.mockResolvedValue(updated as never);

    const result = await updateHouseAction("house-1", { name: "Falcon House" });
    expect(result.data).toEqual(updated);
  });
});

describe("deleteHouseAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deleteHouseAction("house-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when house not found", async () => {
    prismaMock.house.findUnique.mockResolvedValue(null as never);

    const result = await deleteHouseAction("nonexistent");
    expect(result).toEqual({ error: "House not found." });
  });

  it("should delete a house successfully", async () => {
    prismaMock.house.findUnique.mockResolvedValue({
      id: "house-1",
      name: "Eagle House",
    } as never);

    prismaMock.house.delete.mockResolvedValue({} as never);

    const result = await deleteHouseAction("house-1");
    expect(result).toEqual({ success: true });
  });
});

// ═══════════════════════════════════════════════════════════════════
// PROGRAMMES
// ═══════════════════════════════════════════════════════════════════

describe("getProgrammesAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getProgrammesAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when no school configured", async () => {
    mockAuthenticatedUser({ schoolId: null });

    const result = await getProgrammesAction();
    expect(result).toEqual({ error: "No school context. Please select an active school." });
  });

  it("should return programmes list", async () => {
    prismaMock.programme.findMany.mockResolvedValue([
      {
        id: "prog-1",
        name: "General Science",
        code: "GS",
        description: null,
        duration: 3,
        status: "ACTIVE",
        departmentId: "dept-1",
        department: { id: "dept-1", name: "Science" },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never);

    const result = await getProgrammesAction();
    expect(result.data).toHaveLength(1);
    expect(result.data![0].departmentName).toBe("Science");
  });
});

describe("createProgrammeAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createProgrammeAction({ name: "General Science" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject duplicate programme name", async () => {
    prismaMock.programme.findUnique.mockResolvedValue({
      id: "prog-existing",
      name: "General Science",
    } as never);

    const result = await createProgrammeAction({ name: "General Science" });
    expect(result).toEqual({ error: 'A programme named "General Science" already exists.' });
  });

  it("should create a programme successfully", async () => {
    prismaMock.programme.findUnique.mockResolvedValue(null as never);

    const created = {
      id: "prog-1",
      schoolId: "default-school",
      name: "General Science",
      code: null,
      description: null,
      departmentId: null,
      duration: 3,
    };
    prismaMock.programme.create.mockResolvedValue(created as never);

    const result = await createProgrammeAction({ name: "General Science" });
    expect(result.data).toEqual(created);
  });
});

describe("updateProgrammeAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateProgrammeAction("prog-1", { name: "Updated" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when programme not found", async () => {
    prismaMock.programme.findUnique.mockResolvedValue(null as never);

    const result = await updateProgrammeAction("nonexistent", { name: "Updated" });
    expect(result).toEqual({ error: "Programme not found." });
  });

  it("should update a programme successfully", async () => {
    const existing = {
      id: "prog-1",
      name: "General Science",
      code: "GS",
      description: null,
      departmentId: null,
      duration: 3,
      status: "ACTIVE",
      schoolId: "default-school",
    };

    // First call: find existing, Second call: duplicate check (no duplicate)
    prismaMock.programme.findUnique
      .mockResolvedValueOnce(existing as never)
      .mockResolvedValueOnce(null as never);

    const updated = { ...existing, name: "General Science Updated" };
    prismaMock.programme.update.mockResolvedValue(updated as never);

    const result = await updateProgrammeAction("prog-1", { name: "General Science Updated" });
    expect(result.data).toEqual(updated);
  });
});

describe("deleteProgrammeAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deleteProgrammeAction("prog-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when programme not found", async () => {
    prismaMock.programme.findUnique.mockResolvedValue(null as never);

    const result = await deleteProgrammeAction("nonexistent");
    expect(result).toEqual({ error: "Programme not found." });
  });

  it("should delete a programme successfully", async () => {
    prismaMock.programme.findUnique.mockResolvedValue({
      id: "prog-1",
      name: "General Science",
    } as never);

    prismaMock.programme.delete.mockResolvedValue({} as never);

    const result = await deleteProgrammeAction("prog-1");
    expect(result).toEqual({ success: true });
  });
});

// ═══════════════════════════════════════════════════════════════════
// SCHOOL
// ═══════════════════════════════════════════════════════════════════

describe("getSchoolAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getSchoolAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return school data", async () => {
    const school = {
      id: "default-school",
      name: "Ghana SHS Demo",
      type: "DAY_BOARDING",
      category: "PUBLIC",
      region: "Greater Accra",
    };
    prismaMock.school.findUnique.mockResolvedValue(school as never);

    const result = await getSchoolAction();
    expect(result.data).toEqual(school);
  });

  it("should return error when no school context", async () => {
    mockAuthenticatedUser({ schoolId: null });

    const result = await getSchoolAction();
    expect(result).toEqual({ error: "No school context. Please select an active school." });
  });
});

describe("updateSchoolAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateSchoolAction({
      name: "Test School",
      type: "DAY",
      category: "PUBLIC",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject invalid input", async () => {
    const result = await updateSchoolAction({
      name: "",
      type: "DAY",
      category: "PUBLIC",
    });
    expect(result.error).toBe("Invalid input");
  });

  it("should return error when school record not found", async () => {
    prismaMock.school.findUnique.mockResolvedValue(null as never);

    const result = await updateSchoolAction({
      name: "Updated School",
      type: "DAY",
      category: "PUBLIC",
    });
    expect(result).toEqual({ error: "School record not found" });
  });

  it("should update school successfully", async () => {
    const existing = {
      id: "default-school",
      name: "Ghana SHS Demo",
      type: "DAY_BOARDING",
      category: "PUBLIC",
    };

    prismaMock.school.findUnique.mockResolvedValue(existing as never);

    const updated = { ...existing, name: "Updated School" };
    prismaMock.school.update.mockResolvedValue(updated as never);

    const result = await updateSchoolAction({
      name: "Updated School",
      type: "DAY_BOARDING",
      category: "PUBLIC",
    });
    expect(result.data).toEqual(updated);
  });
});

// ═══════════════════════════════════════════════════════════════════
// TERMS
// ═══════════════════════════════════════════════════════════════════

describe("getTermsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getTermsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return terms list", async () => {
    prismaMock.term.findMany.mockResolvedValue([
      {
        id: "term-1",
        name: "Term 1",
        termNumber: 1,
        academicYear: { id: "ay-1", name: "2024/2025" },
      },
    ] as never);

    const result = await getTermsAction();
    expect(result.data).toHaveLength(1);
  });

  it("should filter by academicYearId", async () => {
    prismaMock.term.findMany.mockResolvedValue([] as never);

    await getTermsAction("ay-1");
    expect(prismaMock.term.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { academicYearId: "ay-1" },
      }),
    );
  });
});

describe("createTermAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createTermAction({
      academicYearId: "ay-1",
      name: "Term 1",
      termNumber: 1,
      startDate: "2024-09-01",
      endDate: "2024-12-20",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject invalid input", async () => {
    const result = await createTermAction({
      academicYearId: "",
      name: "",
      termNumber: 0,
      startDate: "",
      endDate: "",
    });
    expect(result.error).toBe("Invalid input");
  });

  it("should return error when academic year not found", async () => {
    prismaMock.academicYear.findUnique.mockResolvedValue(null as never);

    const result = await createTermAction({
      academicYearId: "nonexistent",
      name: "Term 1",
      termNumber: 1,
      startDate: "2024-09-01",
      endDate: "2024-12-20",
    });
    expect(result).toEqual({ error: "Academic year not found" });
  });

  it("should reject duplicate term number", async () => {
    prismaMock.academicYear.findUnique.mockResolvedValue({
      id: "ay-1",
      name: "2024/2025",
    } as never);

    prismaMock.term.findFirst.mockResolvedValue({
      id: "term-existing",
      termNumber: 1,
    } as never);

    const result = await createTermAction({
      academicYearId: "ay-1",
      name: "Term 1",
      termNumber: 1,
      startDate: "2024-09-01",
      endDate: "2024-12-20",
    });
    expect(result.error).toContain("Term 1 already exists");
  });

  it("should create a term successfully", async () => {
    prismaMock.academicYear.findUnique.mockResolvedValue({
      id: "ay-1",
      name: "2024/2025",
    } as never);

    prismaMock.term.findFirst.mockResolvedValue(null as never);

    const created = {
      id: "term-1",
      academicYearId: "ay-1",
      name: "Term 1",
      termNumber: 1,
      startDate: new Date("2024-09-01"),
      endDate: new Date("2024-12-20"),
    };
    prismaMock.term.create.mockResolvedValue(created as never);

    const result = await createTermAction({
      academicYearId: "ay-1",
      name: "Term 1",
      termNumber: 1,
      startDate: "2024-09-01",
      endDate: "2024-12-20",
    });
    expect(result.data).toEqual(created);
  });
});

describe("updateTermAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateTermAction("term-1", { name: "Updated" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when term not found", async () => {
    prismaMock.term.findUnique.mockResolvedValue(null as never);

    const result = await updateTermAction("nonexistent", { name: "Updated" });
    expect(result).toEqual({ error: "Term not found" });
  });

  it("should reject duplicate term number on update", async () => {
    prismaMock.term.findUnique.mockResolvedValue({
      id: "term-1",
      termNumber: 1,
      academicYearId: "ay-1",
      academicYear: { name: "2024/2025" },
    } as never);

    prismaMock.term.findFirst.mockResolvedValue({
      id: "term-2",
      termNumber: 2,
    } as never);

    const result = await updateTermAction("term-1", { termNumber: 2 });
    expect(result.error).toContain("Term 2 already exists");
  });

  it("should update a term successfully", async () => {
    const existing = {
      id: "term-1",
      name: "Term 1",
      termNumber: 1,
      academicYearId: "ay-1",
      academicYear: { name: "2024/2025" },
    };

    prismaMock.term.findUnique.mockResolvedValue(existing as never);
    prismaMock.term.findFirst.mockResolvedValue(null as never);

    const updated = { ...existing, name: "Term 1 Updated" };
    prismaMock.term.update.mockResolvedValue(updated as never);

    const result = await updateTermAction("term-1", { name: "Term 1 Updated" });
    expect(result.data).toEqual(updated);
  });
});

describe("deleteTermAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deleteTermAction("term-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when term not found", async () => {
    prismaMock.term.findUnique.mockResolvedValue(null as never);

    const result = await deleteTermAction("nonexistent");
    expect(result).toEqual({ error: "Term not found" });
  });

  it("should delete a term successfully", async () => {
    prismaMock.term.findUnique.mockResolvedValue({
      id: "term-1",
      name: "Term 1",
      academicYear: { name: "2024/2025" },
    } as never);

    prismaMock.term.delete.mockResolvedValue({} as never);

    const result = await deleteTermAction("term-1");
    expect(result).toEqual({ success: true });
  });
});

describe("setCurrentTermAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await setCurrentTermAction("term-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when term not found", async () => {
    prismaMock.term.findUnique.mockResolvedValue(null as never);

    const result = await setCurrentTermAction("nonexistent");
    expect(result).toEqual({ error: "Term not found" });
  });

  it("should unset previous current term and set new one, also set parent academic year", async () => {
    prismaMock.term.findUnique.mockResolvedValue({
      id: "term-1",
      name: "Term 1",
      academicYearId: "ay-1",
      academicYear: { id: "ay-1", name: "2024/2025" },
    } as never);

    prismaMock.$transaction.mockResolvedValue([{}, {}, {}, {}] as never);

    const result = await setCurrentTermAction("term-1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });
});

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════

describe("getNotificationsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getNotificationsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return notifications and unread count", async () => {
    prismaMock.notification.findMany.mockResolvedValue([
      {
        id: "notif-1",
        title: "Test Notification",
        message: "Hello",
        isRead: false,
        type: "INFO",
      },
    ] as never);

    prismaMock.notification.count.mockResolvedValue(1 as never);

    const result = await getNotificationsAction();
    expect(result.notifications).toHaveLength(1);
    expect(result.unreadCount).toBe(1);
  });
});

describe("markNotificationReadAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await markNotificationReadAction("notif-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should mark a notification as read", async () => {
    prismaMock.notification.update.mockResolvedValue({} as never);

    const result = await markNotificationReadAction("notif-1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.notification.update).toHaveBeenCalledWith({
      where: { id: "notif-1", userId: "test-user-id" },
      data: { isRead: true },
    });
  });
});

describe("markAllNotificationsReadAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await markAllNotificationsReadAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should mark all notifications as read", async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 5 } as never);

    const result = await markAllNotificationsReadAction();
    expect(result).toEqual({ success: true });
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: "test-user-id", isRead: false },
      data: { isRead: true },
    });
  });
});

describe("createNotificationAction", () => {
  it("should create a notification", async () => {
    prismaMock.notification.create.mockResolvedValue({} as never);

    const result = await createNotificationAction({
      userId: "user-1",
      title: "Test",
      message: "Hello World",
    });
    expect(result).toEqual({ success: true });
    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        title: "Test",
        message: "Hello World",
        type: "INFO",
        link: undefined,
      },
    });
  });

  it("should create a notification with custom type and link", async () => {
    prismaMock.notification.create.mockResolvedValue({} as never);

    const result = await createNotificationAction({
      userId: "user-1",
      title: "Error",
      message: "Something went wrong",
      type: "ERROR",
      link: "/dashboard",
    });
    expect(result).toEqual({ success: true });
    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        title: "Error",
        message: "Something went wrong",
        type: "ERROR",
        link: "/dashboard",
      },
    });
  });
});
