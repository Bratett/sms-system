import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";

// ─── Hostel Actions ───────────────────────────────────────────────
import {
  getHostelsAction,
  getHostelAction,
  createHostelAction,
  updateHostelAction,
  deleteHostelAction,
  getDormitoriesAction,
  createDormitoryAction,
  updateDormitoryAction,
  deleteDormitoryAction,
  getBedsAction,
  createBedsAction,
  deleteBedAction,
} from "@/modules/boarding/actions/hostel.action";

// ─── Allocation Actions ───────────────────────────────────────────
import {
  getAllocationsAction,
  allocateBedAction,
  vacateBedAction,
  bulkAllocateAction,
  getOccupancyReportAction,
} from "@/modules/boarding/actions/allocation.action";

// ─── Exeat Actions ────────────────────────────────────────────────
import {
  getExeatsAction,
  getExeatAction,
  requestExeatAction,
  approveExeatAction,
  rejectExeatAction,
  recordDepartureAction,
  recordReturnAction,
  getOverdueExeatsAction,
  getExeatStatsAction,
} from "@/modules/boarding/actions/exeat.action";

// ─── Roll Call Actions ────────────────────────────────────────────
import {
  conductRollCallAction,
  getRollCallHistoryAction,
  getRollCallAction,
  getBoardingStudentsAction,
} from "@/modules/boarding/actions/roll-call.action";

// ═══════════════════════════════════════════════════════════════════
// HOSTELS
// ═══════════════════════════════════════════════════════════════════

describe("getHostelsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getHostelsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);

    const result = await getHostelsAction();
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return hostels with bed counts", async () => {
    prismaMock.hostel.findMany.mockResolvedValue([
      {
        id: "hostel-1",
        name: "Boys Hostel A",
        gender: "MALE",
        capacity: 100,
        wardenId: null,
        description: null,
        status: "ACTIVE",
        createdAt: new Date(),
        dormitories: [
          {
            beds: [
              { status: "OCCUPIED" },
              { status: "AVAILABLE" },
              { status: "AVAILABLE" },
            ],
          },
        ],
      },
    ] as never);

    const result = await getHostelsAction();
    expect(result.data).toHaveLength(1);
    expect(result.data![0].totalBeds).toBe(3);
    expect(result.data![0].occupiedBeds).toBe(1);
    expect(result.data![0].availableBeds).toBe(2);
  });
});

describe("getHostelAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getHostelAction("hostel-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when hostel not found", async () => {
    prismaMock.hostel.findUnique.mockResolvedValue(null as never);

    const result = await getHostelAction("nonexistent");
    expect(result).toEqual({ error: "Hostel not found." });
  });

  it("should return hostel with dormitories and beds", async () => {
    prismaMock.hostel.findUnique.mockResolvedValue({
      id: "hostel-1",
      name: "Boys Hostel A",
      gender: "MALE",
      capacity: 100,
      wardenId: null,
      description: null,
      status: "ACTIVE",
      dormitories: [
        {
          id: "dorm-1",
          name: "Dorm A1",
          floor: "1",
          capacity: 20,
          beds: [
            {
              id: "bed-1",
              bedNumber: "Bed 1",
              status: "AVAILABLE",
              allocations: [],
            },
          ],
        },
      ],
    } as never);

    const result = await getHostelAction("hostel-1");
    expect(result.data!.dormitories).toHaveLength(1);
    expect(result.data!.dormitories[0].beds).toHaveLength(1);
  });
});

describe("createHostelAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createHostelAction({ name: "Boys Hostel", gender: "MALE" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);

    const result = await createHostelAction({ name: "Boys Hostel", gender: "MALE" });
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should reject duplicate hostel name", async () => {
    prismaMock.hostel.findUnique.mockResolvedValue({
      id: "hostel-existing",
      name: "Boys Hostel",
    } as never);

    const result = await createHostelAction({ name: "Boys Hostel", gender: "MALE" });
    expect(result).toEqual({ error: 'A hostel named "Boys Hostel" already exists.' });
  });

  it("should create a hostel successfully", async () => {
    prismaMock.hostel.findUnique.mockResolvedValue(null as never);

    const created = {
      id: "hostel-1",
      schoolId: "default-school",
      name: "Boys Hostel A",
      gender: "MALE",
      capacity: 0,
      wardenId: null,
      description: null,
    };
    prismaMock.hostel.create.mockResolvedValue(created as never);

    const result = await createHostelAction({ name: "Boys Hostel A", gender: "MALE" });
    expect(result.data).toEqual(created);
  });
});

describe("updateHostelAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateHostelAction("hostel-1", { name: "Updated" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when hostel not found", async () => {
    prismaMock.hostel.findUnique.mockResolvedValue(null as never);

    const result = await updateHostelAction("nonexistent", { name: "Updated" });
    expect(result).toEqual({ error: "Hostel not found." });
  });

  it("should reject duplicate name on update", async () => {
    prismaMock.hostel.findUnique
      .mockResolvedValueOnce({
        id: "hostel-1",
        name: "Boys Hostel A",
        schoolId: "default-school",
      } as never)
      .mockResolvedValueOnce({
        id: "hostel-2",
        name: "Boys Hostel B",
      } as never);

    const result = await updateHostelAction("hostel-1", { name: "Boys Hostel B" });
    expect(result).toEqual({ error: 'A hostel named "Boys Hostel B" already exists.' });
  });

  it("should update a hostel successfully", async () => {
    const existing = {
      id: "hostel-1",
      name: "Boys Hostel A",
      gender: "MALE",
      capacity: 100,
      wardenId: null,
      description: null,
      status: "ACTIVE",
      schoolId: "default-school",
    };

    // First call: find existing, Second call: duplicate check (no duplicate)
    prismaMock.hostel.findUnique
      .mockResolvedValueOnce(existing as never)
      .mockResolvedValueOnce(null as never);

    const updated = { ...existing, name: "Boys Hostel A Updated" };
    prismaMock.hostel.update.mockResolvedValue(updated as never);

    const result = await updateHostelAction("hostel-1", { name: "Boys Hostel A Updated" });
    expect(result.data).toEqual(updated);
  });
});

describe("deleteHostelAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deleteHostelAction("hostel-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when hostel not found", async () => {
    prismaMock.hostel.findUnique.mockResolvedValue(null as never);

    const result = await deleteHostelAction("nonexistent");
    expect(result).toEqual({ error: "Hostel not found." });
  });

  it("should reject deletion when hostel has occupied beds", async () => {
    prismaMock.hostel.findUnique.mockResolvedValue({
      id: "hostel-1",
      name: "Boys Hostel A",
      dormitories: [
        {
          beds: [{ id: "bed-1", status: "OCCUPIED" }],
        },
      ],
    } as never);

    const result = await deleteHostelAction("hostel-1");
    expect(result).toEqual({
      error: "Cannot delete hostel with occupied beds. Please vacate all beds first.",
    });
  });

  it("should delete a hostel successfully when no occupied beds", async () => {
    prismaMock.hostel.findUnique.mockResolvedValue({
      id: "hostel-1",
      name: "Boys Hostel A",
      dormitories: [
        {
          beds: [],
        },
      ],
    } as never);

    prismaMock.hostel.delete.mockResolvedValue({} as never);

    const result = await deleteHostelAction("hostel-1");
    expect(result).toEqual({ success: true });
  });
});

// ═══════════════════════════════════════════════════════════════════
// DORMITORIES
// ═══════════════════════════════════════════════════════════════════

describe("getDormitoriesAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getDormitoriesAction("hostel-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return dormitories with bed counts", async () => {
    prismaMock.dormitory.findMany.mockResolvedValue([
      {
        id: "dorm-1",
        hostelId: "hostel-1",
        name: "Dorm A1",
        floor: "1",
        capacity: 20,
        beds: [
          { status: "OCCUPIED" },
          { status: "AVAILABLE" },
          { status: "MAINTENANCE" },
        ],
      },
    ] as never);

    const result = await getDormitoriesAction("hostel-1");
    expect(result.data).toHaveLength(1);
    expect(result.data![0].totalBeds).toBe(3);
    expect(result.data![0].occupiedBeds).toBe(1);
    expect(result.data![0].availableBeds).toBe(1);
    expect(result.data![0].maintenanceBeds).toBe(1);
  });
});

describe("createDormitoryAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createDormitoryAction({ hostelId: "hostel-1", name: "Dorm A1" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject duplicate dormitory name", async () => {
    prismaMock.dormitory.findUnique.mockResolvedValue({
      id: "dorm-existing",
      name: "Dorm A1",
    } as never);

    const result = await createDormitoryAction({ hostelId: "hostel-1", name: "Dorm A1" });
    expect(result).toEqual({
      error: 'A dormitory named "Dorm A1" already exists in this hostel.',
    });
  });

  it("should create a dormitory successfully", async () => {
    prismaMock.dormitory.findUnique.mockResolvedValue(null as never);

    const created = {
      id: "dorm-1",
      hostelId: "hostel-1",
      name: "Dorm A1",
      floor: null,
      capacity: 0,
    };
    prismaMock.dormitory.create.mockResolvedValue(created as never);

    const result = await createDormitoryAction({ hostelId: "hostel-1", name: "Dorm A1" });
    expect(result.data).toEqual(created);
  });
});

describe("updateDormitoryAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateDormitoryAction("dorm-1", { name: "Updated" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when dormitory not found", async () => {
    prismaMock.dormitory.findUnique.mockResolvedValue(null as never);

    const result = await updateDormitoryAction("nonexistent", { name: "Updated" });
    expect(result).toEqual({ error: "Dormitory not found." });
  });

  it("should reject duplicate dormitory name on update", async () => {
    prismaMock.dormitory.findUnique
      .mockResolvedValueOnce({
        id: "dorm-1",
        name: "Dorm A1",
        hostelId: "hostel-1",
      } as never)
      .mockResolvedValueOnce({
        id: "dorm-2",
        name: "Dorm A2",
      } as never);

    const result = await updateDormitoryAction("dorm-1", { name: "Dorm A2" });
    expect(result).toEqual({
      error: 'A dormitory named "Dorm A2" already exists in this hostel.',
    });
  });

  it("should update a dormitory successfully", async () => {
    const existing = {
      id: "dorm-1",
      name: "Dorm A1",
      hostelId: "hostel-1",
      floor: "1",
      capacity: 20,
    };

    // First call: find existing, Second call: duplicate check (no duplicate)
    prismaMock.dormitory.findUnique
      .mockResolvedValueOnce(existing as never)
      .mockResolvedValueOnce(null as never);

    const updated = { ...existing, name: "Dorm A1 Updated" };
    prismaMock.dormitory.update.mockResolvedValue(updated as never);

    const result = await updateDormitoryAction("dorm-1", { name: "Dorm A1 Updated" });
    expect(result.data).toEqual(updated);
  });
});

describe("deleteDormitoryAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deleteDormitoryAction("dorm-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when dormitory not found", async () => {
    prismaMock.dormitory.findUnique.mockResolvedValue(null as never);

    const result = await deleteDormitoryAction("nonexistent");
    expect(result).toEqual({ error: "Dormitory not found." });
  });

  it("should reject deletion when dormitory has occupied beds", async () => {
    prismaMock.dormitory.findUnique.mockResolvedValue({
      id: "dorm-1",
      name: "Dorm A1",
      beds: [{ id: "bed-1", status: "OCCUPIED" }],
    } as never);

    const result = await deleteDormitoryAction("dorm-1");
    expect(result).toEqual({
      error: "Cannot delete dormitory with occupied beds. Please vacate all beds first.",
    });
  });

  it("should delete a dormitory successfully", async () => {
    prismaMock.dormitory.findUnique.mockResolvedValue({
      id: "dorm-1",
      name: "Dorm A1",
      beds: [],
    } as never);

    prismaMock.dormitory.delete.mockResolvedValue({} as never);

    const result = await deleteDormitoryAction("dorm-1");
    expect(result).toEqual({ success: true });
  });
});

// ═══════════════════════════════════════════════════════════════════
// BEDS
// ═══════════════════════════════════════════════════════════════════

describe("getBedsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getBedsAction("dorm-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return beds with allocation info", async () => {
    prismaMock.bed.findMany.mockResolvedValue([
      {
        id: "bed-1",
        bedNumber: "Bed 1",
        status: "OCCUPIED",
        allocations: [{ studentId: "student-1" }],
      },
      {
        id: "bed-2",
        bedNumber: "Bed 2",
        status: "AVAILABLE",
        allocations: [],
      },
    ] as never);

    prismaMock.student.findMany.mockResolvedValue([
      { id: "student-1", firstName: "John", lastName: "Doe" },
    ] as never);

    const result = await getBedsAction("dorm-1");
    expect(result.data).toHaveLength(2);
    expect(result.data![0].studentName).toBe("John Doe");
    expect(result.data![1].studentName).toBeNull();
  });
});

describe("createBedsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createBedsAction("dorm-1", 5);
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when dormitory not found", async () => {
    prismaMock.dormitory.findUnique.mockResolvedValue(null as never);

    const result = await createBedsAction("nonexistent", 5);
    expect(result).toEqual({ error: "Dormitory not found." });
  });

  it("should create beds with sequential numbering", async () => {
    prismaMock.dormitory.findUnique.mockResolvedValue({
      id: "dorm-1",
      name: "Dorm A1",
    } as never);

    prismaMock.bed.findMany.mockResolvedValue([
      { bedNumber: "Bed 1" },
      { bedNumber: "Bed 2" },
    ] as never);

    prismaMock.bed.createMany.mockResolvedValue({ count: 3 } as never);

    const result = await createBedsAction("dorm-1", 3);
    expect(result).toEqual({ success: true, count: 3 });
    expect(prismaMock.bed.createMany).toHaveBeenCalledWith({
      data: [
        { dormitoryId: "dorm-1", bedNumber: "Bed 3" },
        { dormitoryId: "dorm-1", bedNumber: "Bed 4" },
        { dormitoryId: "dorm-1", bedNumber: "Bed 5" },
      ],
    });
  });
});

describe("deleteBedAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deleteBedAction("bed-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when bed not found", async () => {
    prismaMock.bed.findUnique.mockResolvedValue(null as never);

    const result = await deleteBedAction("nonexistent");
    expect(result).toEqual({ error: "Bed not found." });
  });

  it("should reject deletion of non-AVAILABLE beds", async () => {
    prismaMock.bed.findUnique.mockResolvedValue({
      id: "bed-1",
      bedNumber: "Bed 1",
      status: "OCCUPIED",
    } as never);

    const result = await deleteBedAction("bed-1");
    expect(result).toEqual({
      error: "Can only delete beds that are available. Please vacate the bed first.",
    });
  });

  it("should delete an available bed successfully", async () => {
    prismaMock.bed.findUnique.mockResolvedValue({
      id: "bed-1",
      bedNumber: "Bed 1",
      status: "AVAILABLE",
    } as never);

    prismaMock.bed.delete.mockResolvedValue({} as never);

    const result = await deleteBedAction("bed-1");
    expect(result).toEqual({ success: true });
  });
});

// ═══════════════════════════════════════════════════════════════════
// ALLOCATIONS
// ═══════════════════════════════════════════════════════════════════

describe("getAllocationsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getAllocationsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return allocations list", async () => {
    prismaMock.bedAllocation.findMany.mockResolvedValue([
      {
        id: "alloc-1",
        studentId: "student-1",
        bedId: "bed-1",
        termId: "term-1",
        academicYearId: "ay-1",
        allocatedAt: new Date(),
        status: "ACTIVE",
        bed: {
          bedNumber: "Bed 1",
          dormitory: {
            name: "Dorm A1",
            hostel: { id: "hostel-1", name: "Boys Hostel A" },
          },
        },
      },
    ] as never);

    prismaMock.student.findMany.mockResolvedValue([
      { id: "student-1", firstName: "John", lastName: "Doe", studentId: "STU001" },
    ] as never);

    const result = await getAllocationsAction();
    expect(result.data).toHaveLength(1);
    expect(result.data![0].studentName).toBe("John Doe");
    expect(result.data![0].hostelName).toBe("Boys Hostel A");
  });
});

describe("allocateBedAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await allocateBedAction({
      studentId: "student-1",
      bedId: "bed-1",
      termId: "term-1",
      academicYearId: "ay-1",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when student not found", async () => {
    prismaMock.student.findUnique.mockResolvedValue(null as never);

    const result = await allocateBedAction({
      studentId: "nonexistent",
      bedId: "bed-1",
      termId: "term-1",
      academicYearId: "ay-1",
    });
    expect(result).toEqual({ error: "Student not found." });
  });

  it("should reject non-boarding students", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "student-1",
      firstName: "John",
      lastName: "Doe",
      boardingStatus: "DAY",
    } as never);

    const result = await allocateBedAction({
      studentId: "student-1",
      bedId: "bed-1",
      termId: "term-1",
      academicYearId: "ay-1",
    });
    expect(result).toEqual({ error: "Student is not a boarding student." });
  });

  it("should return error when bed not found", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "student-1",
      firstName: "John",
      lastName: "Doe",
      boardingStatus: "BOARDING",
    } as never);

    prismaMock.bed.findUnique.mockResolvedValue(null as never);

    const result = await allocateBedAction({
      studentId: "student-1",
      bedId: "nonexistent",
      termId: "term-1",
      academicYearId: "ay-1",
    });
    expect(result).toEqual({ error: "Bed not found." });
  });

  it("should reject if bed is not available", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "student-1",
      firstName: "John",
      lastName: "Doe",
      boardingStatus: "BOARDING",
    } as never);

    prismaMock.bed.findUnique.mockResolvedValue({
      id: "bed-1",
      bedNumber: "Bed 1",
      status: "OCCUPIED",
      dormitory: { hostel: { name: "Boys Hostel A" }, name: "Dorm A1" },
    } as never);

    const result = await allocateBedAction({
      studentId: "student-1",
      bedId: "bed-1",
      termId: "term-1",
      academicYearId: "ay-1",
    });
    expect(result).toEqual({ error: "Bed is not available." });
  });

  it("should reject if student already allocated for this term", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "student-1",
      firstName: "John",
      lastName: "Doe",
      boardingStatus: "BOARDING",
    } as never);

    prismaMock.bed.findUnique.mockResolvedValue({
      id: "bed-1",
      bedNumber: "Bed 1",
      status: "AVAILABLE",
      dormitory: { hostel: { name: "Boys Hostel A" }, name: "Dorm A1" },
    } as never);

    prismaMock.bedAllocation.findUnique.mockResolvedValue({
      id: "alloc-existing",
    } as never);

    const result = await allocateBedAction({
      studentId: "student-1",
      bedId: "bed-1",
      termId: "term-1",
      academicYearId: "ay-1",
    });
    expect(result).toEqual({
      error: "Student already has a bed allocation for this term.",
    });
  });

  it("should create allocation and update bed status to OCCUPIED", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      id: "student-1",
      firstName: "John",
      lastName: "Doe",
      boardingStatus: "BOARDING",
    } as never);

    prismaMock.bed.findUnique.mockResolvedValue({
      id: "bed-1",
      bedNumber: "Bed 1",
      status: "AVAILABLE",
      dormitory: { hostel: { name: "Boys Hostel A" }, name: "Dorm A1" },
    } as never);

    prismaMock.bedAllocation.findUnique.mockResolvedValue(null as never);

    const allocation = {
      id: "alloc-1",
      bedId: "bed-1",
      studentId: "student-1",
      termId: "term-1",
      academicYearId: "ay-1",
      allocatedBy: "test-user-id",
    };

    prismaMock.$transaction.mockResolvedValue([allocation, {}] as never);

    const result = await allocateBedAction({
      studentId: "student-1",
      bedId: "bed-1",
      termId: "term-1",
      academicYearId: "ay-1",
    });

    expect(result.data).toEqual(allocation);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });
});

describe("vacateBedAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await vacateBedAction("alloc-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when allocation not found", async () => {
    prismaMock.bedAllocation.findUnique.mockResolvedValue(null as never);

    const result = await vacateBedAction("nonexistent");
    expect(result).toEqual({ error: "Allocation not found." });
  });

  it("should reject if already vacated", async () => {
    prismaMock.bedAllocation.findUnique.mockResolvedValue({
      id: "alloc-1",
      status: "VACATED",
      bedId: "bed-1",
      bed: {
        bedNumber: "Bed 1",
        dormitory: { hostel: { name: "Boys Hostel A" }, name: "Dorm A1" },
      },
    } as never);

    const result = await vacateBedAction("alloc-1");
    expect(result).toEqual({ error: "Bed is already vacated." });
  });

  it("should vacate bed and update bed status to AVAILABLE", async () => {
    prismaMock.bedAllocation.findUnique.mockResolvedValue({
      id: "alloc-1",
      status: "ACTIVE",
      bedId: "bed-1",
      bed: {
        bedNumber: "Bed 1",
        dormitory: { hostel: { name: "Boys Hostel A" }, name: "Dorm A1" },
      },
    } as never);

    prismaMock.$transaction.mockResolvedValue([{}, {}] as never);

    const result = await vacateBedAction("alloc-1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });
});

describe("bulkAllocateAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await bulkAllocateAction([], "term-1", "ay-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });
});

describe("getOccupancyReportAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getOccupancyReportAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);

    const result = await getOccupancyReportAction();
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return occupancy report with percentages", async () => {
    prismaMock.hostel.findMany.mockResolvedValue([
      {
        id: "hostel-1",
        name: "Boys Hostel A",
        gender: "MALE",
        dormitories: [
          {
            beds: [
              { status: "OCCUPIED" },
              { status: "OCCUPIED" },
              { status: "AVAILABLE" },
              { status: "AVAILABLE" },
            ],
          },
        ],
      },
    ] as never);

    const result = await getOccupancyReportAction();
    expect(result.data).toHaveLength(1);
    expect(result.data![0].totalBeds).toBe(4);
    expect(result.data![0].occupiedBeds).toBe(2);
    expect(result.data![0].availableBeds).toBe(2);
    expect(result.data![0].occupancyPercent).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════════════════
// EXEATS
// ═══════════════════════════════════════════════════════════════════

describe("getExeatsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getExeatsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return paginated exeats", async () => {
    prismaMock.exeat.findMany.mockResolvedValue([
      {
        id: "exeat-1",
        exeatNumber: "EXT/2024/0001",
        studentId: "student-1",
        type: "NORMAL",
        reason: "Family event",
        departureDate: new Date(),
        departureTime: "08:00",
        expectedReturnDate: new Date(),
        actualReturnDate: null,
        actualReturnTime: null,
        guardianName: "Parent",
        guardianPhone: "+233201234567",
        status: "REQUESTED",
        requestedAt: new Date(),
        approvals: [],
      },
    ] as never);
    prismaMock.exeat.count.mockResolvedValue(1 as never);
    prismaMock.student.findMany.mockResolvedValue([
      { id: "student-1", firstName: "John", lastName: "Doe", studentId: "STU001" },
    ] as never);

    const result = await getExeatsAction();
    expect(result.data).toHaveLength(1);
    expect(result.pagination).toBeDefined();
  });
});

describe("getExeatAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getExeatAction("exeat-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when exeat not found", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue(null as never);

    const result = await getExeatAction("nonexistent");
    expect(result).toEqual({ error: "Exeat not found." });
  });

  it("should return exeat details with student and approval info", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "exeat-1",
      exeatNumber: "EXT/2024/0001",
      studentId: "student-1",
      type: "NORMAL",
      reason: "Family event",
      departureDate: new Date(),
      departureTime: "08:00",
      expectedReturnDate: new Date(),
      actualReturnDate: null,
      actualReturnTime: null,
      guardianName: "Parent",
      guardianPhone: "+233201234567",
      status: "REQUESTED",
      requestedAt: new Date(),
      approvals: [
        { id: "approval-1", approverRole: "housemaster", approverId: "user-2", action: "APPROVED", comments: null, actionAt: new Date() },
      ],
    } as never);

    prismaMock.student.findUnique.mockResolvedValue({
      id: "student-1",
      studentId: "STU001",
      firstName: "John",
      lastName: "Doe",
      boardingStatus: "BOARDING",
      photoUrl: null,
    } as never);

    prismaMock.user.findMany.mockResolvedValue([
      { id: "user-2", firstName: "Mr", lastName: "Smith" },
    ] as never);

    const result = await getExeatAction("exeat-1");
    expect(result.data).toBeDefined();
    expect(result.data!.approvals).toHaveLength(1);
    expect(result.data!.approvals[0].approverName).toBe("Mr Smith");
  });
});

describe("requestExeatAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await requestExeatAction({
      studentId: "student-1",
      termId: "term-1",
      reason: "Family event",
      type: "NORMAL",
      departureDate: "2024-12-01",
      expectedReturnDate: "2024-12-03",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should create an exeat request with generated exeat number", async () => {
    prismaMock.exeat.count.mockResolvedValue(5 as never);

    const created = {
      id: "exeat-1",
      exeatNumber: `EXT/${new Date().getFullYear()}/0006`,
      studentId: "student-1",
      termId: "term-1",
      reason: "Family event",
      type: "NORMAL",
      departureDate: new Date("2024-12-01"),
      expectedReturnDate: new Date("2024-12-03"),
      status: "REQUESTED",
      requestedBy: "test-user-id",
    };

    prismaMock.exeat.create.mockResolvedValue(created as never);

    const result = await requestExeatAction({
      studentId: "student-1",
      termId: "term-1",
      reason: "Family event",
      type: "NORMAL",
      departureDate: "2024-12-01",
      expectedReturnDate: "2024-12-03",
    });

    expect(result.data).toEqual(created);
    expect(prismaMock.exeat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: "student-1",
          requestedBy: "test-user-id",
        }),
      }),
    );
  });
});

describe("approveExeatAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await approveExeatAction("exeat-1", "housemaster");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when exeat not found", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue(null as never);

    const result = await approveExeatAction("nonexistent", "housemaster");
    expect(result).toEqual({ error: "Exeat not found." });
  });

  it("should reject housemaster approval if exeat is not in REQUESTED status", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "exeat-1",
      exeatNumber: "EXT/2024/0001",
      status: "HOUSEMASTER_APPROVED",
      type: "NORMAL",
      approvals: [],
    } as never);

    const result = await approveExeatAction("exeat-1", "housemaster");
    expect(result).toEqual({
      error: "Exeat must be in REQUESTED status for housemaster approval.",
    });
  });

  it("should allow housemaster to approve REQUESTED exeat", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "exeat-1",
      exeatNumber: "EXT/2024/0001",
      status: "REQUESTED",
      type: "NORMAL",
      approvals: [],
    } as never);

    prismaMock.$transaction.mockResolvedValue([{}, {}] as never);

    const result = await approveExeatAction("exeat-1", "housemaster", "Approved");
    expect(result).toEqual({ success: true });
  });

  it("should reject headmaster approval if not HOUSEMASTER_APPROVED for non-emergency", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "exeat-1",
      exeatNumber: "EXT/2024/0001",
      status: "REQUESTED",
      type: "NORMAL",
      approvals: [],
    } as never);

    const result = await approveExeatAction("exeat-1", "headmaster");
    expect(result).toEqual({
      error: "Exeat must be approved by housemaster first.",
    });
  });

  it("should allow headmaster to approve HOUSEMASTER_APPROVED exeat", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "exeat-1",
      exeatNumber: "EXT/2024/0001",
      status: "HOUSEMASTER_APPROVED",
      type: "NORMAL",
      approvals: [{ id: "a-1" }],
    } as never);

    prismaMock.$transaction.mockResolvedValue([{}, {}] as never);

    const result = await approveExeatAction("exeat-1", "headmaster");
    expect(result).toEqual({ success: true });
  });

  it("should allow headmaster to approve REQUESTED emergency exeat (skip housemaster)", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "exeat-1",
      exeatNumber: "EXT/2024/0001",
      status: "REQUESTED",
      type: "EMERGENCY",
      approvals: [],
    } as never);

    prismaMock.$transaction.mockResolvedValue([{}, {}] as never);

    const result = await approveExeatAction("exeat-1", "headmaster");
    expect(result).toEqual({ success: true });
  });
});

describe("rejectExeatAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await rejectExeatAction("exeat-1", "housemaster");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when exeat not found", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue(null as never);

    const result = await rejectExeatAction("nonexistent", "housemaster");
    expect(result).toEqual({ error: "Exeat not found." });
  });

  it("should reject if exeat is already rejected or cancelled", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "exeat-1",
      exeatNumber: "EXT/2024/0001",
      status: "REJECTED",
    } as never);

    const result = await rejectExeatAction("exeat-1", "housemaster");
    expect(result).toEqual({ error: "Exeat is already rejected or cancelled." });
  });

  it("should reject an exeat and update status to REJECTED", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "exeat-1",
      exeatNumber: "EXT/2024/0001",
      status: "REQUESTED",
    } as never);

    prismaMock.$transaction.mockResolvedValue([{}, {}] as never);

    const result = await rejectExeatAction("exeat-1", "housemaster", "Not approved");
    expect(result).toEqual({ success: true });
  });
});

describe("recordDepartureAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await recordDepartureAction("exeat-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when exeat not found", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue(null as never);

    const result = await recordDepartureAction("nonexistent");
    expect(result).toEqual({ error: "Exeat not found." });
  });

  it("should reject if exeat is not HEADMASTER_APPROVED", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "exeat-1",
      exeatNumber: "EXT/2024/0001",
      status: "HOUSEMASTER_APPROVED",
    } as never);

    const result = await recordDepartureAction("exeat-1");
    expect(result).toEqual({
      error: "Exeat must be approved by headmaster before recording departure.",
    });
  });

  it("should record departure and set status to DEPARTED", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "exeat-1",
      exeatNumber: "EXT/2024/0001",
      status: "HEADMASTER_APPROVED",
    } as never);

    prismaMock.exeat.update.mockResolvedValue({} as never);

    const result = await recordDepartureAction("exeat-1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.exeat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "DEPARTED" },
      }),
    );
  });
});

describe("recordReturnAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await recordReturnAction("exeat-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when exeat not found", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue(null as never);

    const result = await recordReturnAction("nonexistent");
    expect(result).toEqual({ error: "Exeat not found." });
  });

  it("should reject if exeat is not in DEPARTED or OVERDUE status", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "exeat-1",
      exeatNumber: "EXT/2024/0001",
      status: "HEADMASTER_APPROVED",
    } as never);

    const result = await recordReturnAction("exeat-1");
    expect(result).toEqual({
      error: "Exeat must be in DEPARTED or OVERDUE status.",
    });
  });

  it("should record return from DEPARTED status", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "exeat-1",
      exeatNumber: "EXT/2024/0001",
      status: "DEPARTED",
    } as never);

    prismaMock.exeat.update.mockResolvedValue({} as never);

    const result = await recordReturnAction("exeat-1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.exeat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "RETURNED",
        }),
      }),
    );
  });

  it("should record return from OVERDUE status", async () => {
    prismaMock.exeat.findUnique.mockResolvedValue({
      id: "exeat-1",
      exeatNumber: "EXT/2024/0001",
      status: "OVERDUE",
    } as never);

    prismaMock.exeat.update.mockResolvedValue({} as never);

    const result = await recordReturnAction("exeat-1");
    expect(result).toEqual({ success: true });
  });
});

describe("getOverdueExeatsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getOverdueExeatsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return overdue exeats", async () => {
    prismaMock.exeat.findMany.mockResolvedValue([
      {
        id: "exeat-1",
        exeatNumber: "EXT/2024/0001",
        studentId: "student-1",
        expectedReturnDate: new Date("2024-01-01"),
      },
    ] as never);

    prismaMock.student.findMany.mockResolvedValue([
      { id: "student-1", firstName: "John", lastName: "Doe", studentId: "STU001" },
    ] as never);

    const result = await getOverdueExeatsAction();
    expect(result.data).toHaveLength(1);
    expect(result.data![0].daysOverdue).toBeGreaterThan(0);
  });
});

describe("getExeatStatsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getExeatStatsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return exeat statistics", async () => {
    // Mock all the count calls (10 total)
    prismaMock.exeat.count
      .mockResolvedValueOnce(20 as never) // total
      .mockResolvedValueOnce(5 as never)  // requested
      .mockResolvedValueOnce(3 as never)  // housemaster approved
      .mockResolvedValueOnce(2 as never)  // headmaster approved
      .mockResolvedValueOnce(1 as never)  // rejected
      .mockResolvedValueOnce(4 as never)  // departed
      .mockResolvedValueOnce(3 as never)  // returned
      .mockResolvedValueOnce(1 as never)  // overdue
      .mockResolvedValueOnce(1 as never)  // cancelled
      .mockResolvedValueOnce(2 as never); // overdue actual

    const result = await getExeatStatsAction();
    expect(result.data).toBeDefined();
    expect(result.data!.total).toBe(20);
    expect(result.data!.requested).toBe(5);
    expect(result.data!.overdue).toBe(3); // 1 + 2
  });
});

// ═══════════════════════════════════════════════════════════════════
// ROLL CALL
// ═══════════════════════════════════════════════════════════════════

describe("conductRollCallAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await conductRollCallAction({
      hostelId: "hostel-1",
      type: "MORNING",
      records: [],
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should create a new roll call with individual records", async () => {
    prismaMock.rollCall.findUnique.mockResolvedValue(null as never);

    const created = {
      id: "rc-1",
      hostelId: "hostel-1",
      date: new Date(),
      type: "MORNING",
      conductedBy: "test-user-id",
    };
    prismaMock.rollCall.create.mockResolvedValue(created as never);

    const result = await conductRollCallAction({
      hostelId: "hostel-1",
      type: "MORNING",
      records: [
        { studentId: "student-1", status: "PRESENT" },
        { studentId: "student-2", status: "ABSENT", notes: "Sick" },
      ],
    });

    expect(result.data!.id).toBe("rc-1");
    expect(result.data!.isUpdate).toBe(false);
    expect(prismaMock.rollCall.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hostelId: "hostel-1",
          type: "MORNING",
          conductedBy: "test-user-id",
          records: {
            create: expect.arrayContaining([
              expect.objectContaining({ studentId: "student-1", status: "PRESENT" }),
              expect.objectContaining({ studentId: "student-2", status: "ABSENT", notes: "Sick" }),
            ]),
          },
        }),
      }),
    );
  });

  it("should update existing roll call records", async () => {
    prismaMock.rollCall.findUnique.mockResolvedValue({
      id: "rc-existing",
      hostelId: "hostel-1",
      type: "MORNING",
    } as never);

    prismaMock.$transaction.mockResolvedValue([{}, {}] as never);

    const result = await conductRollCallAction({
      hostelId: "hostel-1",
      type: "MORNING",
      records: [
        { studentId: "student-1", status: "PRESENT" },
      ],
    });

    expect(result.data!.id).toBe("rc-existing");
    expect(result.data!.isUpdate).toBe(true);
  });
});

describe("getRollCallHistoryAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getRollCallHistoryAction("hostel-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return paginated roll call history with counts", async () => {
    prismaMock.rollCall.findMany.mockResolvedValue([
      {
        id: "rc-1",
        hostelId: "hostel-1",
        date: new Date(),
        type: "MORNING",
        conductedBy: "user-1",
        conductedAt: new Date(),
        records: [
          { status: "PRESENT" },
          { status: "PRESENT" },
          { status: "ABSENT" },
          { status: "EXEAT" },
        ],
      },
    ] as never);
    prismaMock.rollCall.count.mockResolvedValue(1 as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "user-1", firstName: "Mr", lastName: "Warden" },
    ] as never);

    const result = await getRollCallHistoryAction("hostel-1");
    expect(result.data).toHaveLength(1);
    expect(result.data![0].totalRecords).toBe(4);
    expect(result.data![0].presentCount).toBe(2);
    expect(result.data![0].absentCount).toBe(1);
    expect(result.data![0].exeatCount).toBe(1);
    expect(result.data![0].conductedBy).toBe("Mr Warden");
  });
});

describe("getRollCallAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getRollCallAction("rc-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error when roll call not found", async () => {
    prismaMock.rollCall.findUnique.mockResolvedValue(null as never);

    const result = await getRollCallAction("nonexistent");
    expect(result).toEqual({ error: "Roll call not found." });
  });

  it("should return roll call details with student info", async () => {
    prismaMock.rollCall.findUnique.mockResolvedValue({
      id: "rc-1",
      hostelId: "hostel-1",
      date: new Date(),
      type: "MORNING",
      conductedBy: "user-1",
      conductedAt: new Date(),
      records: [
        { id: "rcr-1", studentId: "student-1", status: "PRESENT", notes: null },
      ],
    } as never);

    prismaMock.student.findMany.mockResolvedValue([
      { id: "student-1", firstName: "John", lastName: "Doe", studentId: "STU001" },
    ] as never);

    prismaMock.user.findUnique.mockResolvedValue({
      firstName: "Mr",
      lastName: "Warden",
    } as never);

    const result = await getRollCallAction("rc-1");
    expect(result.data).toBeDefined();
    expect(result.data!.records).toHaveLength(1);
    expect(result.data!.records[0].studentName).toBe("John Doe");
    expect(result.data!.conductedBy).toBe("Mr Warden");
  });
});

describe("getBoardingStudentsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getBoardingStudentsAction("hostel-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return empty data when no allocations", async () => {
    prismaMock.bedAllocation.findMany.mockResolvedValue([] as never);

    const result = await getBoardingStudentsAction("hostel-1");
    expect(result.data).toEqual([]);
  });

  it("should return boarding students with bed info", async () => {
    prismaMock.bedAllocation.findMany.mockResolvedValue([
      {
        studentId: "student-1",
        bed: {
          bedNumber: "Bed 1",
          dormitory: { name: "Dorm A1" },
        },
      },
    ] as never);

    prismaMock.student.findMany.mockResolvedValue([
      {
        id: "student-1",
        studentId: "STU001",
        firstName: "John",
        lastName: "Doe",
        photoUrl: null,
      },
    ] as never);

    const result = await getBoardingStudentsAction("hostel-1");
    expect(result.data).toHaveLength(1);
    expect(result.data![0].dormitory).toBe("Dorm A1");
    expect(result.data![0].bed).toBe("Bed 1");
  });
});
