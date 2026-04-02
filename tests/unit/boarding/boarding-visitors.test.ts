import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";

// ─── Visitor Actions ─────────────────────────────────────────────
import {
  getVisitorsAction,
  checkInVisitorAction,
  checkOutVisitorAction,
  getActiveVisitorsAction,
  getStudentVisitHistoryAction,
  getVisitorStatsAction,
} from "@/modules/boarding/actions/visitor.action";

// ─── Transfer Actions ────────────────────────────────────────────
import {
  getTransfersAction,
  requestTransferAction,
  approveTransferAction,
  executeTransferAction,
  rejectTransferAction,
  getStudentTransferHistoryAction,
} from "@/modules/boarding/actions/transfer.action";

// ═══════════════════════════════════════════════════════════════════
// MOCK DATA FACTORIES
// ═══════════════════════════════════════════════════════════════════

const now = new Date("2026-04-01T10:00:00Z");

function makeVisitor(overrides: Record<string, unknown> = {}) {
  return {
    id: "visitor-1",
    schoolId: "default-school",
    studentId: "student-1",
    hostelId: "hostel-1",
    visitorName: "Kwame Mensah",
    relationship: "PARENT",
    visitorPhone: "+233244000111",
    visitorIdNumber: "GHA-2023-00456",
    purpose: "Weekend visit",
    checkInAt: now,
    checkOutAt: null,
    checkedInBy: "test-user-id",
    checkedOutBy: null,
    status: "CHECKED_IN",
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeTransfer(overrides: Record<string, unknown> = {}) {
  return {
    id: "transfer-1",
    schoolId: "default-school",
    transferNumber: "BTR/2026/0001",
    studentId: "student-1",
    fromBedId: "bed-1",
    toBedId: "bed-2",
    reason: "STUDENT_REQUEST",
    reasonDetails: "Wants to be closer to study hall",
    status: "PENDING",
    requestedBy: "test-user-id",
    requestedAt: now,
    approvedBy: null,
    approvedAt: null,
    effectiveDate: null,
    completedAt: null,
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeBedWithDormitory(overrides: Record<string, unknown> = {}) {
  const defaults = {
    id: "bed-1",
    bedNumber: "A-101",
    dormitoryId: "dorm-1",
    status: "OCCUPIED",
    dormitory: {
      id: "dorm-1",
      name: "Dormitory Alpha",
      hostelId: "hostel-1",
      hostel: {
        id: "hostel-1",
        name: "Boys Hostel A",
      },
    },
  };
  return { ...defaults, ...overrides };
}

// ═══════════════════════════════════════════════════════════════════
// VISITORS
// ═══════════════════════════════════════════════════════════════════

describe("getVisitorsAction", () => {
  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getVisitorsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return paginated visitors with resolved names", async () => {
    const visitor = makeVisitor();
    prismaMock.boardingVisitor.findMany.mockResolvedValue([visitor] as never);
    prismaMock.boardingVisitor.count.mockResolvedValue(1 as never);

    prismaMock.student.findMany.mockResolvedValue([
      { id: "student-1", firstName: "Ama", lastName: "Osei", studentId: "STU-001" },
    ] as never);
    prismaMock.hostel.findMany.mockResolvedValue([
      { id: "hostel-1", name: "Boys Hostel A" },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "test-user-id", firstName: "Test", lastName: "Admin" },
    ] as never);

    const result = await getVisitorsAction({ page: 1, pageSize: 10 });

    expect(result).not.toHaveProperty("error");
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("pagination");

    const data = (result as { data: unknown[] }).data;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      id: "visitor-1",
      visitorName: "Kwame Mensah",
      studentName: "Ama Osei",
      studentNumber: "STU-001",
      hostelName: "Boys Hostel A",
      checkedInBy: "Test Admin",
      status: "CHECKED_IN",
    });

    const pagination = (result as { pagination: { page: number; pageSize: number; total: number; totalPages: number } }).pagination;
    expect(pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
  });
});

// ─── checkInVisitorAction ────────────────────────────────────────

describe("checkInVisitorAction", () => {
  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await checkInVisitorAction({
      studentId: "student-1",
      hostelId: "hostel-1",
      visitorName: "Kwame Mensah",
      relationship: "PARENT",
      visitorPhone: "+233244000111",
      purpose: "Weekend visit",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject invalid input (missing required fields)", async () => {
    const result = await checkInVisitorAction({
      studentId: "",
      hostelId: "",
      visitorName: "",
      relationship: "",
      visitorPhone: "",
      purpose: "",
    });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toBeTruthy();
  });

  it("should create visitor record with CHECKED_IN status", async () => {
    const createdVisitor = makeVisitor({ id: "visitor-new" });
    prismaMock.boardingVisitor.create.mockResolvedValue(createdVisitor as never);

    const result = await checkInVisitorAction({
      studentId: "student-1",
      hostelId: "hostel-1",
      visitorName: "Kwame Mensah",
      relationship: "PARENT",
      visitorPhone: "+233244000111",
      purpose: "Weekend visit",
    });

    expect(result).toHaveProperty("data");
    expect((result as { data: typeof createdVisitor }).data.id).toBe("visitor-new");

    expect(prismaMock.boardingVisitor.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        schoolId: "default-school",
        studentId: "student-1",
        hostelId: "hostel-1",
        visitorName: "Kwame Mensah",
        relationship: "PARENT",
        visitorPhone: "+233244000111",
        checkedInBy: "test-user-id",
        status: "CHECKED_IN",
      }),
    });
  });
});

// ─── checkOutVisitorAction ───────────────────────────────────────

describe("checkOutVisitorAction", () => {
  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await checkOutVisitorAction("visitor-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject already checked-out visitors", async () => {
    const checkedOut = makeVisitor({ status: "CHECKED_OUT", checkOutAt: now });
    prismaMock.boardingVisitor.findUnique.mockResolvedValue(checkedOut as never);

    const result = await checkOutVisitorAction("visitor-1");
    expect(result).toEqual({ error: "Visitor is already checked out." });
  });

  it("should set checkOutAt and CHECKED_OUT status", async () => {
    const activeVisitor = makeVisitor({ status: "CHECKED_IN" });
    prismaMock.boardingVisitor.findUnique.mockResolvedValue(activeVisitor as never);

    const updatedVisitor = makeVisitor({
      status: "CHECKED_OUT",
      checkOutAt: new Date("2026-04-01T16:00:00Z"),
      checkedOutBy: "test-user-id",
    });
    prismaMock.boardingVisitor.update.mockResolvedValue(updatedVisitor as never);

    const result = await checkOutVisitorAction("visitor-1");

    expect(result).toHaveProperty("data");
    expect((result as { data: typeof updatedVisitor }).data.status).toBe("CHECKED_OUT");
    expect((result as { data: typeof updatedVisitor }).data.checkOutAt).toBeTruthy();

    expect(prismaMock.boardingVisitor.update).toHaveBeenCalledWith({
      where: { id: "visitor-1" },
      data: expect.objectContaining({
        checkedOutBy: "test-user-id",
        status: "CHECKED_OUT",
      }),
    });
  });
});

// ─── getActiveVisitorsAction ─────────────────────────────────────

describe("getActiveVisitorsAction", () => {
  it("should return only CHECKED_IN visitors", async () => {
    const activeVisitor = makeVisitor({ id: "visitor-active", status: "CHECKED_IN" });
    prismaMock.boardingVisitor.findMany.mockResolvedValue([activeVisitor] as never);

    prismaMock.student.findMany.mockResolvedValue([
      { id: "student-1", firstName: "Ama", lastName: "Osei", studentId: "STU-001" },
    ] as never);
    prismaMock.hostel.findMany.mockResolvedValue([
      { id: "hostel-1", name: "Boys Hostel A" },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "test-user-id", firstName: "Test", lastName: "Admin" },
    ] as never);

    const result = await getActiveVisitorsAction();

    expect(result).toHaveProperty("data");
    const data = (result as { data: unknown[] }).data;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      id: "visitor-active",
      visitorName: "Kwame Mensah",
      studentName: "Ama Osei",
      hostelName: "Boys Hostel A",
      checkedInBy: "Test Admin",
    });

    // Verify findMany was called with CHECKED_IN filter
    expect(prismaMock.boardingVisitor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "CHECKED_IN" },
      }),
    );
  });
});

// ─── getStudentVisitHistoryAction ────────────────────────────────

describe("getStudentVisitHistoryAction", () => {
  it("should return visits for specific student ordered by date", async () => {
    const visit1 = makeVisitor({
      id: "visit-1",
      visitorName: "Kwame Mensah",
      checkInAt: new Date("2026-03-20T09:00:00Z"),
    });
    const visit2 = makeVisitor({
      id: "visit-2",
      visitorName: "Abena Mensah",
      relationship: "SIBLING",
      checkInAt: new Date("2026-03-25T14:00:00Z"),
      status: "CHECKED_OUT",
      checkOutAt: new Date("2026-03-25T17:00:00Z"),
      checkedOutBy: "test-user-id",
    });

    prismaMock.boardingVisitor.findMany.mockResolvedValue([visit2, visit1] as never);

    prismaMock.hostel.findMany.mockResolvedValue([
      { id: "hostel-1", name: "Boys Hostel A" },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "test-user-id", firstName: "Test", lastName: "Admin" },
    ] as never);

    const result = await getStudentVisitHistoryAction("student-1");

    expect(result).toHaveProperty("data");
    const data = (result as { data: unknown[] }).data;
    expect(data).toHaveLength(2);

    // Verify ordered desc by checkInAt (visit2 first)
    expect((data[0] as { id: string }).id).toBe("visit-2");
    expect((data[1] as { id: string }).id).toBe("visit-1");

    // Verify findMany was called with the student filter
    expect(prismaMock.boardingVisitor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: "student-1" },
        orderBy: { checkInAt: "desc" },
      }),
    );
  });
});

// ─── getVisitorStatsAction ───────────────────────────────────────

describe("getVisitorStatsAction", () => {
  it("should return activeVisitors, todayTotal, weekTotal, byRelationship", async () => {
    // activeVisitors count
    prismaMock.boardingVisitor.count
      .mockResolvedValueOnce(3 as never)  // active (CHECKED_IN)
      .mockResolvedValueOnce(7 as never)  // todayTotal
      .mockResolvedValueOnce(25 as never); // weekTotal

    // byRelationship breakdown
    prismaMock.boardingVisitor.findMany.mockResolvedValue([
      { relationship: "PARENT" },
      { relationship: "PARENT" },
      { relationship: "PARENT" },
      { relationship: "SIBLING" },
      { relationship: "GUARDIAN" },
    ] as never);

    const result = await getVisitorStatsAction();

    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.activeVisitors).toBe(3);
    expect(data.todayTotal).toBe(7);
    expect(data.weekTotal).toBe(25);
    expect(data.byRelationship).toEqual({
      PARENT: 3,
      SIBLING: 1,
      GUARDIAN: 1,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// TRANSFERS
// ═══════════════════════════════════════════════════════════════════

describe("getTransfersAction", () => {
  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getTransfersAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return paginated transfers with bed details", async () => {
    const transfer = makeTransfer();
    prismaMock.bedTransfer.findMany.mockResolvedValue([transfer] as never);
    prismaMock.bedTransfer.count.mockResolvedValue(1 as never);

    const fromBed = makeBedWithDormitory({ id: "bed-1", bedNumber: "A-101", status: "OCCUPIED" });
    const toBed = makeBedWithDormitory({
      id: "bed-2",
      bedNumber: "B-205",
      status: "AVAILABLE",
      dormitoryId: "dorm-2",
      dormitory: {
        id: "dorm-2",
        name: "Dormitory Beta",
        hostelId: "hostel-2",
        hostel: {
          id: "hostel-2",
          name: "Boys Hostel B",
        },
      },
    });
    prismaMock.bed.findMany.mockResolvedValue([fromBed, toBed] as never);

    prismaMock.student.findMany.mockResolvedValue([
      { id: "student-1", firstName: "Ama", lastName: "Osei", studentId: "STU-001" },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "test-user-id", firstName: "Test", lastName: "Admin" },
    ] as never);

    const result = await getTransfersAction({ page: 1, pageSize: 10 });

    expect(result).not.toHaveProperty("error");
    expect(result).toHaveProperty("data");

    const data = (result as { data: unknown[] }).data;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      id: "transfer-1",
      transferNumber: "BTR/2026/0001",
      studentName: "Ama Osei",
      studentNumber: "STU-001",
      fromBedNumber: "A-101",
      fromDormitoryName: "Dormitory Alpha",
      fromHostelName: "Boys Hostel A",
      toBedNumber: "B-205",
      toDormitoryName: "Dormitory Beta",
      toHostelName: "Boys Hostel B",
      status: "PENDING",
      requestedBy: "Test Admin",
    });
  });
});

// ─── requestTransferAction ───────────────────────────────────────

describe("requestTransferAction", () => {
  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await requestTransferAction({
      studentId: "student-1",
      fromBedId: "bed-1",
      toBedId: "bed-2",
      reason: "STUDENT_REQUEST",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject invalid input", async () => {
    const result = await requestTransferAction({
      studentId: "",
      fromBedId: "",
      toBedId: "",
      reason: "",
    });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toBeTruthy();
  });

  it("should reject if toBed is not AVAILABLE", async () => {
    const fromBed = makeBedWithDormitory({ id: "bed-1" });
    const toBed = makeBedWithDormitory({ id: "bed-2", status: "OCCUPIED" });

    prismaMock.bed.findUnique
      .mockResolvedValueOnce(fromBed as never)  // fromBed lookup
      .mockResolvedValueOnce(toBed as never);    // toBed lookup

    const result = await requestTransferAction({
      studentId: "student-1",
      fromBedId: "bed-1",
      toBedId: "bed-2",
      reason: "STUDENT_REQUEST",
    });

    expect(result).toEqual({ error: "Destination bed is not available." });
  });

  it("should create transfer with auto-generated number", async () => {
    const fromBed = makeBedWithDormitory({ id: "bed-1" });
    const toBed = makeBedWithDormitory({ id: "bed-2", status: "AVAILABLE" });

    prismaMock.bed.findUnique
      .mockResolvedValueOnce(fromBed as never)
      .mockResolvedValueOnce(toBed as never);

    // No existing transfers for sequence
    prismaMock.bedTransfer.findFirst.mockResolvedValue(null as never);

    const createdTransfer = makeTransfer({ transferNumber: "BTR/2026/0001" });
    prismaMock.bedTransfer.create.mockResolvedValue(createdTransfer as never);

    const result = await requestTransferAction({
      studentId: "student-1",
      fromBedId: "bed-1",
      toBedId: "bed-2",
      reason: "STUDENT_REQUEST",
      reasonDetails: "Wants to be closer to study hall",
    });

    expect(result).toHaveProperty("data");
    expect((result as { data: typeof createdTransfer }).data.transferNumber).toBe("BTR/2026/0001");

    expect(prismaMock.bedTransfer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        schoolId: "default-school",
        transferNumber: "BTR/2026/0001",
        studentId: "student-1",
        fromBedId: "bed-1",
        toBedId: "bed-2",
        reason: "STUDENT_REQUEST",
        reasonDetails: "Wants to be closer to study hall",
        requestedBy: "test-user-id",
      }),
    });
  });
});

// ─── approveTransferAction ───────────────────────────────────────

describe("approveTransferAction", () => {
  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await approveTransferAction("transfer-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject non-PENDING transfers", async () => {
    const completedTransfer = makeTransfer({ status: "COMPLETED" });
    prismaMock.bedTransfer.findUnique.mockResolvedValue(completedTransfer as never);

    const result = await approveTransferAction("transfer-1");
    expect(result).toEqual({ error: "Cannot approve a transfer with status COMPLETED." });
  });

  it("should set APPROVED status with approver info", async () => {
    const pendingTransfer = makeTransfer({ status: "PENDING" });
    prismaMock.bedTransfer.findUnique.mockResolvedValue(pendingTransfer as never);

    const approvedTransfer = makeTransfer({
      status: "APPROVED",
      approvedBy: "test-user-id",
      approvedAt: new Date("2026-04-01T12:00:00Z"),
    });
    prismaMock.bedTransfer.update.mockResolvedValue(approvedTransfer as never);

    const result = await approveTransferAction("transfer-1");

    expect(result).toHaveProperty("data");
    const data = (result as { data: typeof approvedTransfer }).data;
    expect(data.status).toBe("APPROVED");
    expect(data.approvedBy).toBe("test-user-id");
    expect(data.approvedAt).toBeTruthy();

    expect(prismaMock.bedTransfer.update).toHaveBeenCalledWith({
      where: { id: "transfer-1" },
      data: expect.objectContaining({
        status: "APPROVED",
        approvedBy: "test-user-id",
      }),
    });
  });
});

// ─── executeTransferAction ───────────────────────────────────────

describe("executeTransferAction", () => {
  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await executeTransferAction("transfer-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject non-APPROVED transfers", async () => {
    const pendingTransfer = makeTransfer({ status: "PENDING" });
    prismaMock.bedTransfer.findUnique.mockResolvedValue(pendingTransfer as never);

    const result = await executeTransferAction("transfer-1");
    expect(result).toEqual({ error: "Cannot execute a transfer with status PENDING." });
  });

  it("should atomically: vacate old bed, allocate new bed, complete transfer", async () => {
    const approvedTransfer = makeTransfer({ status: "APPROVED" });
    prismaMock.bedTransfer.findUnique.mockResolvedValue(approvedTransfer as never);

    const activeAllocation = {
      id: "alloc-1",
      bedId: "bed-1",
      studentId: "student-1",
      termId: "term-1",
      academicYearId: "ay-2025-2026",
      allocatedBy: "test-user-id",
      status: "ACTIVE",
      vacatedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    prismaMock.bedAllocation.findFirst.mockResolvedValue(activeAllocation as never);

    // Mock $transaction to execute the callback against prismaMock
    prismaMock.$transaction.mockImplementation(async (fn) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (fn as any)(prismaMock);
    });

    // 1. Vacate old allocation
    prismaMock.bedAllocation.update.mockResolvedValue({
      ...activeAllocation,
      status: "VACATED",
      vacatedAt: now,
    } as never);

    // 2. Set old bed to AVAILABLE
    prismaMock.bed.update
      .mockResolvedValueOnce({ id: "bed-1", status: "AVAILABLE" } as never)
      // 4. Set toBed to OCCUPIED
      .mockResolvedValueOnce({ id: "bed-2", status: "OCCUPIED" } as never);

    // 3. Create new allocation
    const newAllocation = {
      id: "alloc-2",
      bedId: "bed-2",
      studentId: "student-1",
      termId: "term-1",
      academicYearId: "ay-2025-2026",
      allocatedBy: "test-user-id",
      status: "ACTIVE",
      vacatedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    prismaMock.bedAllocation.create.mockResolvedValue(newAllocation as never);

    // 5. Update transfer status
    const completedTransfer = makeTransfer({ status: "COMPLETED", completedAt: now });
    prismaMock.bedTransfer.update.mockResolvedValue(completedTransfer as never);

    const result = await executeTransferAction("transfer-1");

    expect(result).toHaveProperty("data");
    expect((result as { data: typeof completedTransfer }).data.status).toBe("COMPLETED");

    // Verify old allocation was vacated
    expect(prismaMock.bedAllocation.update).toHaveBeenCalledWith({
      where: { id: "alloc-1" },
      data: expect.objectContaining({
        status: "VACATED",
      }),
    });

    // Verify old bed set to AVAILABLE
    expect(prismaMock.bed.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bed-1" },
        data: { status: "AVAILABLE" },
      }),
    );

    // Verify new allocation created for toBed
    expect(prismaMock.bedAllocation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bedId: "bed-2",
        studentId: "student-1",
        termId: "term-1",
        academicYearId: "ay-2025-2026",
        allocatedBy: "test-user-id",
      }),
    });

    // Verify toBed set to OCCUPIED
    expect(prismaMock.bed.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bed-2" },
        data: { status: "OCCUPIED" },
      }),
    );

    // Verify transfer marked COMPLETED
    expect(prismaMock.bedTransfer.update).toHaveBeenCalledWith({
      where: { id: "transfer-1" },
      data: expect.objectContaining({
        status: "COMPLETED",
      }),
    });
  });
});

// ─── rejectTransferAction ────────────────────────────────────────

describe("rejectTransferAction", () => {
  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await rejectTransferAction("transfer-1", "No longer needed");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject non-PENDING transfers", async () => {
    const approvedTransfer = makeTransfer({ status: "APPROVED" });
    prismaMock.bedTransfer.findUnique.mockResolvedValue(approvedTransfer as never);

    const result = await rejectTransferAction("transfer-1", "Changed mind");
    expect(result).toEqual({ error: "Cannot reject a transfer with status APPROVED." });
  });

  it("should set REJECTED status with reason", async () => {
    const pendingTransfer = makeTransfer({ status: "PENDING" });
    prismaMock.bedTransfer.findUnique.mockResolvedValue(pendingTransfer as never);

    const rejectedTransfer = makeTransfer({
      status: "REJECTED",
      rejectionReason: "Bed reserved for incoming student",
    });
    prismaMock.bedTransfer.update.mockResolvedValue(rejectedTransfer as never);

    const result = await rejectTransferAction("transfer-1", "Bed reserved for incoming student");

    expect(result).toHaveProperty("data");
    const data = (result as { data: typeof rejectedTransfer }).data;
    expect(data.status).toBe("REJECTED");
    expect(data.rejectionReason).toBe("Bed reserved for incoming student");

    expect(prismaMock.bedTransfer.update).toHaveBeenCalledWith({
      where: { id: "transfer-1" },
      data: {
        status: "REJECTED",
        rejectionReason: "Bed reserved for incoming student",
      },
    });
  });
});

// ─── getStudentTransferHistoryAction ─────────────────────────────

describe("getStudentTransferHistoryAction", () => {
  it("should return transfers for specific student", async () => {
    const transfer1 = makeTransfer({
      id: "transfer-1",
      transferNumber: "BTR/2026/0001",
      requestedAt: new Date("2026-03-15T10:00:00Z"),
    });
    const transfer2 = makeTransfer({
      id: "transfer-2",
      transferNumber: "BTR/2026/0002",
      fromBedId: "bed-2",
      toBedId: "bed-3",
      status: "COMPLETED",
      completedAt: new Date("2026-03-20T12:00:00Z"),
      requestedAt: new Date("2026-03-18T09:00:00Z"),
    });

    prismaMock.bedTransfer.findMany.mockResolvedValue([transfer2, transfer1] as never);

    const bed1 = makeBedWithDormitory({ id: "bed-1", bedNumber: "A-101" });
    const bed2 = makeBedWithDormitory({
      id: "bed-2",
      bedNumber: "B-205",
      dormitory: {
        id: "dorm-2",
        name: "Dormitory Beta",
        hostelId: "hostel-2",
        hostel: { id: "hostel-2", name: "Boys Hostel B" },
      },
    });
    const bed3 = makeBedWithDormitory({
      id: "bed-3",
      bedNumber: "C-310",
      dormitory: {
        id: "dorm-3",
        name: "Dormitory Gamma",
        hostelId: "hostel-1",
        hostel: { id: "hostel-1", name: "Boys Hostel A" },
      },
    });
    prismaMock.bed.findMany.mockResolvedValue([bed1, bed2, bed3] as never);

    const result = await getStudentTransferHistoryAction("student-1");

    expect(result).toHaveProperty("data");
    const data = (result as { data: unknown[] }).data;
    expect(data).toHaveLength(2);

    // First result is transfer2 (most recent)
    expect(data[0]).toMatchObject({
      id: "transfer-2",
      transferNumber: "BTR/2026/0002",
      fromBedNumber: "B-205",
      fromDormitoryName: "Dormitory Beta",
      toBedNumber: "C-310",
      toDormitoryName: "Dormitory Gamma",
      status: "COMPLETED",
    });

    expect(data[1]).toMatchObject({
      id: "transfer-1",
      transferNumber: "BTR/2026/0001",
      fromBedNumber: "A-101",
      fromDormitoryName: "Dormitory Alpha",
      status: "PENDING",
    });

    // Verify query was scoped to the student
    expect(prismaMock.bedTransfer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: "student-1" },
        orderBy: { requestedAt: "desc" },
      }),
    );
  });
});
