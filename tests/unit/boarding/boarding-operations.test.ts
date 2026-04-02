import { describe, it, expect, beforeEach } from "vitest";
import {
  prismaMock,
  mockAuthenticatedUser,
  mockUnauthenticated,
} from "../setup";

// ─── Inspection Actions ──────────────────────────────────────────
import {
  getInspectionsAction,
  createInspectionAction,
  getInspectionAction,
  getInspectionTrendsAction,
} from "@/modules/boarding/actions/inspection.action";

// ─── Maintenance Actions ─────────────────────────────────────────
import {
  getMaintenanceRequestsAction,
  createMaintenanceRequestAction,
  assignMaintenanceAction,
  updateMaintenanceStatusAction,
  resolveMaintenanceAction,
  getMaintenanceStatsAction,
} from "@/modules/boarding/actions/maintenance.action";

// ─── Analytics Actions ───────────────────────────────────────────
import {
  getOccupancyTrendsAction,
  getExeatAnalyticsAction,
  getRollCallAnalyticsAction,
  getIncidentAnalyticsAction,
  getSickBayAnalyticsAction,
  getBoardingOverviewAction,
} from "@/modules/boarding/actions/analytics.action";

// ═══════════════════════════════════════════════════════════════════
// INSPECTIONS
// ═══════════════════════════════════════════════════════════════════

describe("getInspectionsAction", () => {
  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getInspectionsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return paginated inspections with resolved names", async () => {
    const now = new Date();

    prismaMock.hostelInspection.findMany.mockResolvedValue([
      {
        id: "insp-1",
        schoolId: "default-school",
        hostelId: "hostel-1",
        dormitoryId: "dorm-1",
        inspectedBy: "user-1",
        inspectionDate: now,
        type: "ROUTINE",
        overallRating: "GOOD",
        cleanlinessRating: "GOOD",
        facilityRating: "FAIR",
        safetyRating: "GOOD",
        remarks: "All good",
        issues: null,
        followUpRequired: false,
        createdAt: now,
        updatedAt: now,
      },
    ] as never);

    prismaMock.hostelInspection.count.mockResolvedValue(1 as never);

    prismaMock.hostel.findMany.mockResolvedValue([
      { id: "hostel-1", name: "Aggrey House" },
    ] as never);

    prismaMock.dormitory.findMany.mockResolvedValue([
      { id: "dorm-1", name: "Dorm A" },
    ] as never);

    prismaMock.user.findMany.mockResolvedValue([
      { id: "user-1", firstName: "Kwame", lastName: "Mensah" },
    ] as never);

    const result = await getInspectionsAction({ page: 1, pageSize: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.data![0].hostelName).toBe("Aggrey House");
    expect(result.data![0].dormitoryName).toBe("Dorm A");
    expect(result.data![0].inspectorName).toBe("Kwame Mensah");
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
  });
});

describe("createInspectionAction", () => {
  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createInspectionAction({
      hostelId: "hostel-1",
      inspectionDate: "2026-03-15",
      type: "ROUTINE",
      overallRating: "GOOD",
      cleanlinessRating: "GOOD",
      facilityRating: "FAIR",
      safetyRating: "GOOD",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject invalid input", async () => {
    const result = await createInspectionAction({
      hostelId: "",
      inspectionDate: "",
      type: "INVALID_TYPE",
      overallRating: "INVALID",
      cleanlinessRating: "GOOD",
      facilityRating: "GOOD",
      safetyRating: "GOOD",
    });
    expect(result.error).toBeDefined();
  });

  it("should create inspection with all ratings", async () => {
    const now = new Date();
    const inspectionData = {
      hostelId: "hostel-1",
      dormitoryId: "dorm-1",
      inspectionDate: "2026-03-15",
      type: "ROUTINE",
      overallRating: "GOOD",
      cleanlinessRating: "EXCELLENT",
      facilityRating: "FAIR",
      safetyRating: "GOOD",
      remarks: "Rooms were tidy, minor plumbing issue in room 12",
      issues: "Leaking faucet in bathroom B",
      followUpRequired: true,
    };

    const mockCreated = {
      id: "insp-new",
      schoolId: "default-school",
      hostelId: "hostel-1",
      dormitoryId: "dorm-1",
      inspectedBy: "test-user-id",
      inspectionDate: new Date("2026-03-15"),
      type: "ROUTINE",
      overallRating: "GOOD",
      cleanlinessRating: "EXCELLENT",
      facilityRating: "FAIR",
      safetyRating: "GOOD",
      remarks: "Rooms were tidy, minor plumbing issue in room 12",
      issues: "Leaking faucet in bathroom B",
      followUpRequired: true,
      createdAt: now,
      updatedAt: now,
    };

    prismaMock.hostelInspection.create.mockResolvedValue(mockCreated as never);

    const result = await createInspectionAction(inspectionData);

    expect(result.data).toBeDefined();
    expect(result.data!.id).toBe("insp-new");
    expect(result.data!.overallRating).toBe("GOOD");
    expect(result.data!.cleanlinessRating).toBe("EXCELLENT");
    expect(result.data!.facilityRating).toBe("FAIR");
    expect(result.data!.safetyRating).toBe("GOOD");
    expect(result.data!.followUpRequired).toBe(true);

    expect(prismaMock.hostelInspection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId: "default-school",
          hostelId: "hostel-1",
          dormitoryId: "dorm-1",
          inspectedBy: "test-user-id",
        }),
      }),
    );
  });
});

describe("getInspectionAction", () => {
  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getInspectionAction("insp-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return single inspection with full details", async () => {
    const now = new Date();

    prismaMock.hostelInspection.findUnique.mockResolvedValue({
      id: "insp-1",
      schoolId: "default-school",
      hostelId: "hostel-1",
      dormitoryId: "dorm-1",
      inspectedBy: "user-1",
      inspectionDate: now,
      type: "SURPRISE",
      overallRating: "FAIR",
      cleanlinessRating: "POOR",
      facilityRating: "FAIR",
      safetyRating: "GOOD",
      remarks: "Needs improvement",
      issues: "Dirty bathrooms",
      followUpRequired: true,
      createdAt: now,
      updatedAt: now,
    } as never);

    prismaMock.hostel.findUnique.mockResolvedValue({
      id: "hostel-1",
      name: "Aggrey House",
    } as never);

    prismaMock.dormitory.findUnique.mockResolvedValue({
      name: "Dorm B",
    } as never);

    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      firstName: "Ama",
      lastName: "Owusu",
    } as never);

    const result = await getInspectionAction("insp-1");

    expect(result.data).toBeDefined();
    expect(result.data!.hostelName).toBe("Aggrey House");
    expect(result.data!.dormitoryName).toBe("Dorm B");
    expect(result.data!.inspectorName).toBe("Ama Owusu");
    expect(result.data!.type).toBe("SURPRISE");
    expect(result.data!.followUpRequired).toBe(true);
  });

  it("should return error for non-existent inspection", async () => {
    prismaMock.hostelInspection.findUnique.mockResolvedValue(null as never);

    const result = await getInspectionAction("nonexistent");
    expect(result).toEqual({ error: "Inspection not found." });
  });
});

describe("getInspectionTrendsAction", () => {
  it("should return rating trends over time for a hostel", async () => {
    const dates = [
      new Date("2026-03-01"),
      new Date("2026-02-15"),
      new Date("2026-02-01"),
    ];

    prismaMock.hostelInspection.findMany.mockResolvedValue([
      {
        inspectionDate: dates[0],
        overallRating: "GOOD",
        cleanlinessRating: "EXCELLENT",
        facilityRating: "GOOD",
        safetyRating: "GOOD",
        type: "ROUTINE",
      },
      {
        inspectionDate: dates[1],
        overallRating: "FAIR",
        cleanlinessRating: "FAIR",
        facilityRating: "FAIR",
        safetyRating: "POOR",
        type: "SURPRISE",
      },
      {
        inspectionDate: dates[2],
        overallRating: "POOR",
        cleanlinessRating: "POOR",
        facilityRating: "CRITICAL",
        safetyRating: "FAIR",
        type: "FOLLOW_UP",
      },
    ] as never);

    const result = await getInspectionTrendsAction("hostel-1");

    expect(result.data).toHaveLength(3);
    expect(result.data![0].overallRating).toBe("GOOD");
    expect(result.data![1].overallRating).toBe("FAIR");
    expect(result.data![2].facilityRating).toBe("CRITICAL");
    expect(result.data![0].type).toBe("ROUTINE");
  });
});

// ═══════════════════════════════════════════════════════════════════
// MAINTENANCE
// ═══════════════════════════════════════════════════════════════════

describe("getMaintenanceRequestsAction", () => {
  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getMaintenanceRequestsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return paginated maintenance requests", async () => {
    const now = new Date();

    prismaMock.maintenanceRequest.findMany.mockResolvedValue([
      {
        id: "mnt-1",
        requestNumber: "MNT/2026/0001",
        schoolId: "default-school",
        hostelId: "hostel-1",
        dormitoryId: "dorm-1",
        bedId: null,
        reportedBy: "user-1",
        assignedTo: "staff-1",
        resolvedBy: null,
        title: "Broken window in Room 4",
        description: "Window pane cracked during storm",
        category: "STRUCTURAL",
        priority: "HIGH",
        status: "ASSIGNED",
        assignedAt: now,
        resolvedAt: null,
        resolutionNotes: null,
        createdAt: now,
        updatedAt: now,
      },
    ] as never);

    prismaMock.maintenanceRequest.count.mockResolvedValue(1 as never);

    prismaMock.hostel.findMany.mockResolvedValue([
      { id: "hostel-1", name: "Aggrey House" },
    ] as never);

    prismaMock.dormitory.findMany.mockResolvedValue([
      { id: "dorm-1", name: "Dorm C" },
    ] as never);

    prismaMock.bed.findMany.mockResolvedValue([] as never);

    prismaMock.user.findMany.mockResolvedValue([
      { id: "user-1", firstName: "Kofi", lastName: "Asante" },
      { id: "staff-1", firstName: "Yaw", lastName: "Boateng" },
    ] as never);

    const result = await getMaintenanceRequestsAction({ page: 1, pageSize: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.data![0].requestNumber).toBe("MNT/2026/0001");
    expect(result.data![0].hostelName).toBe("Aggrey House");
    expect(result.data![0].reporterName).toBe("Kofi Asante");
    expect(result.data![0].assigneeName).toBe("Yaw Boateng");
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
  });
});

describe("createMaintenanceRequestAction", () => {
  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createMaintenanceRequestAction({
      hostelId: "hostel-1",
      title: "Broken pipe",
      description: "Pipe leaking in bathroom",
      category: "PLUMBING",
      priority: "HIGH",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject invalid input", async () => {
    const result = await createMaintenanceRequestAction({
      hostelId: "",
      title: "",
      description: "",
      category: "INVALID",
      priority: "INVALID",
    });
    expect(result.error).toBeDefined();
  });

  it("should create request with auto-generated number", async () => {
    const now = new Date();

    prismaMock.maintenanceRequest.count.mockResolvedValue(5 as never);

    const mockCreated = {
      id: "mnt-new",
      requestNumber: "MNT/2026/0006",
      schoolId: "default-school",
      hostelId: "hostel-1",
      dormitoryId: null,
      bedId: null,
      reportedBy: "test-user-id",
      assignedTo: null,
      resolvedBy: null,
      title: "Faulty socket in Room 8",
      description: "Power socket sparking when appliances plugged in",
      category: "ELECTRICAL",
      priority: "URGENT",
      status: "OPEN",
      assignedAt: null,
      resolvedAt: null,
      resolutionNotes: null,
      createdAt: now,
      updatedAt: now,
    };

    prismaMock.maintenanceRequest.create.mockResolvedValue(mockCreated as never);

    const result = await createMaintenanceRequestAction({
      hostelId: "hostel-1",
      title: "Faulty socket in Room 8",
      description: "Power socket sparking when appliances plugged in",
      category: "ELECTRICAL",
      priority: "URGENT",
    });

    expect(result.data).toBeDefined();
    expect(result.data!.id).toBe("mnt-new");
    expect(result.data!.category).toBe("ELECTRICAL");
    expect(result.data!.priority).toBe("URGENT");

    expect(prismaMock.maintenanceRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId: "default-school",
          hostelId: "hostel-1",
          reportedBy: "test-user-id",
          requestNumber: expect.stringMatching(/^MNT\/\d{4}\/\d{4}$/),
        }),
      }),
    );
  });
});

describe("assignMaintenanceAction", () => {
  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await assignMaintenanceAction("mnt-1", "staff-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should assign to staff with ASSIGNED status", async () => {
    const now = new Date();

    prismaMock.maintenanceRequest.findUnique.mockResolvedValue({
      id: "mnt-1",
      requestNumber: "MNT/2026/0001",
      status: "OPEN",
      assignedTo: null,
      hostelId: "hostel-1",
    } as never);

    const mockUpdated = {
      id: "mnt-1",
      requestNumber: "MNT/2026/0001",
      status: "ASSIGNED",
      assignedTo: "staff-1",
      assignedAt: now,
      hostelId: "hostel-1",
    };

    prismaMock.maintenanceRequest.update.mockResolvedValue(mockUpdated as never);

    const result = await assignMaintenanceAction("mnt-1", "staff-1");

    expect(result.data).toBeDefined();
    expect(result.data!.status).toBe("ASSIGNED");
    expect(result.data!.assignedTo).toBe("staff-1");

    expect(prismaMock.maintenanceRequest.update).toHaveBeenCalledWith({
      where: { id: "mnt-1" },
      data: expect.objectContaining({
        assignedTo: "staff-1",
        status: "ASSIGNED",
      }),
    });
  });
});

describe("updateMaintenanceStatusAction", () => {
  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateMaintenanceStatusAction("mnt-1", "IN_PROGRESS");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should update status with valid transitions", async () => {
    prismaMock.maintenanceRequest.findUnique.mockResolvedValue({
      id: "mnt-1",
      requestNumber: "MNT/2026/0001",
      status: "ASSIGNED",
      hostelId: "hostel-1",
    } as never);

    const mockUpdated = {
      id: "mnt-1",
      requestNumber: "MNT/2026/0001",
      status: "IN_PROGRESS",
      hostelId: "hostel-1",
    };

    prismaMock.maintenanceRequest.update.mockResolvedValue(mockUpdated as never);

    const result = await updateMaintenanceStatusAction("mnt-1", "IN_PROGRESS");

    expect(result.data).toBeDefined();
    expect(result.data!.status).toBe("IN_PROGRESS");
  });

  it("should set resolvedAt/resolvedBy when status is RESOLVED", async () => {
    prismaMock.maintenanceRequest.findUnique.mockResolvedValue({
      id: "mnt-2",
      requestNumber: "MNT/2026/0002",
      status: "IN_PROGRESS",
      hostelId: "hostel-1",
    } as never);

    const now = new Date();
    const mockUpdated = {
      id: "mnt-2",
      requestNumber: "MNT/2026/0002",
      status: "RESOLVED",
      resolvedAt: now,
      resolvedBy: "test-user-id",
      resolutionNotes: "Pipe replaced successfully",
    };

    prismaMock.maintenanceRequest.update.mockResolvedValue(mockUpdated as never);

    const result = await updateMaintenanceStatusAction(
      "mnt-2",
      "RESOLVED",
      "Pipe replaced successfully",
    );

    expect(result.data).toBeDefined();
    expect(result.data!.status).toBe("RESOLVED");
    expect(result.data!.resolvedBy).toBe("test-user-id");
    expect(result.data!.resolutionNotes).toBe("Pipe replaced successfully");

    expect(prismaMock.maintenanceRequest.update).toHaveBeenCalledWith({
      where: { id: "mnt-2" },
      data: expect.objectContaining({
        status: "RESOLVED",
        resolvedBy: "test-user-id",
        resolutionNotes: "Pipe replaced successfully",
      }),
    });
  });
});

describe("resolveMaintenanceAction", () => {
  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await resolveMaintenanceAction("mnt-1", "Fixed");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should resolve with notes", async () => {
    const now = new Date();

    prismaMock.maintenanceRequest.findUnique.mockResolvedValue({
      id: "mnt-1",
      requestNumber: "MNT/2026/0001",
      status: "IN_PROGRESS",
      hostelId: "hostel-1",
    } as never);

    const mockUpdated = {
      id: "mnt-1",
      requestNumber: "MNT/2026/0001",
      status: "RESOLVED",
      resolvedAt: now,
      resolvedBy: "test-user-id",
      resolutionNotes: "Replaced faulty wiring and tested all outlets",
    };

    prismaMock.maintenanceRequest.update.mockResolvedValue(mockUpdated as never);

    const result = await resolveMaintenanceAction(
      "mnt-1",
      "Replaced faulty wiring and tested all outlets",
    );

    expect(result.data).toBeDefined();
    expect(result.data!.status).toBe("RESOLVED");
    expect(result.data!.resolutionNotes).toBe(
      "Replaced faulty wiring and tested all outlets",
    );
    expect(result.data!.resolvedBy).toBe("test-user-id");

    expect(prismaMock.maintenanceRequest.update).toHaveBeenCalledWith({
      where: { id: "mnt-1" },
      data: expect.objectContaining({
        status: "RESOLVED",
        resolvedBy: "test-user-id",
        resolutionNotes: "Replaced faulty wiring and tested all outlets",
      }),
    });
  });
});

describe("getMaintenanceStatsAction", () => {
  it("should return counts by status, category, priority", async () => {
    // Status counts (5 calls: OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED)
    prismaMock.maintenanceRequest.count
      .mockResolvedValueOnce(8 as never)   // OPEN
      .mockResolvedValueOnce(5 as never)   // ASSIGNED
      .mockResolvedValueOnce(3 as never)   // IN_PROGRESS
      .mockResolvedValueOnce(12 as never)  // RESOLVED
      .mockResolvedValueOnce(20 as never)  // CLOSED
      // Category counts (8 calls)
      .mockResolvedValueOnce(6 as never)   // PLUMBING
      .mockResolvedValueOnce(4 as never)   // ELECTRICAL
      .mockResolvedValueOnce(3 as never)   // FURNITURE
      .mockResolvedValueOnce(2 as never)   // STRUCTURAL
      .mockResolvedValueOnce(7 as never)   // CLEANING
      .mockResolvedValueOnce(1 as never)   // PEST_CONTROL
      .mockResolvedValueOnce(2 as never)   // SECURITY
      .mockResolvedValueOnce(5 as never)   // OTHER
      // Priority counts (4 calls)
      .mockResolvedValueOnce(10 as never)  // LOW
      .mockResolvedValueOnce(15 as never)  // MEDIUM
      .mockResolvedValueOnce(8 as never)   // HIGH
      .mockResolvedValueOnce(3 as never);  // URGENT

    const result = await getMaintenanceStatsAction();

    expect(result.data).toBeDefined();
    // Status
    expect(result.data!.open).toBe(8);
    expect(result.data!.assigned).toBe(5);
    expect(result.data!.inProgress).toBe(3);
    expect(result.data!.resolved).toBe(12);
    expect(result.data!.closed).toBe(20);
    // Category
    expect(result.data!.byCategory.plumbing).toBe(6);
    expect(result.data!.byCategory.electrical).toBe(4);
    expect(result.data!.byCategory.furniture).toBe(3);
    expect(result.data!.byCategory.structural).toBe(2);
    expect(result.data!.byCategory.cleaning).toBe(7);
    expect(result.data!.byCategory.pestControl).toBe(1);
    expect(result.data!.byCategory.security).toBe(2);
    expect(result.data!.byCategory.other).toBe(5);
    // Priority
    expect(result.data!.byPriority.low).toBe(10);
    expect(result.data!.byPriority.medium).toBe(15);
    expect(result.data!.byPriority.high).toBe(8);
    expect(result.data!.byPriority.urgent).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════

describe("getOccupancyTrendsAction", () => {
  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getOccupancyTrendsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return occupancy data by hostel with rates", async () => {
    prismaMock.hostel.findMany.mockResolvedValue([
      {
        id: "hostel-1",
        name: "Aggrey House",
        gender: "MALE",
        dormitories: [
          {
            status: "ACTIVE",
            beds: [
              { status: "OCCUPIED" },
              { status: "OCCUPIED" },
              { status: "AVAILABLE" },
              { status: "AVAILABLE" },
            ],
          },
        ],
      },
      {
        id: "hostel-2",
        name: "Slessor House",
        gender: "FEMALE",
        dormitories: [
          {
            status: "ACTIVE",
            beds: [
              { status: "OCCUPIED" },
              { status: "OCCUPIED" },
              { status: "OCCUPIED" },
            ],
          },
        ],
      },
    ] as never);

    const result = await getOccupancyTrendsAction();

    expect(result.data).toBeDefined();
    // Overall
    expect(result.data!.overall.totalBeds).toBe(7);
    expect(result.data!.overall.occupiedBeds).toBe(5);
    expect(result.data!.overall.availableBeds).toBe(2);
    expect(result.data!.overall.occupancyRate).toBeGreaterThan(0);
    // By hostel
    expect(result.data!.byHostel).toHaveLength(2);
    expect(result.data!.byHostel[0].hostelName).toBe("Aggrey House");
    expect(result.data!.byHostel[0].totalBeds).toBe(4);
    expect(result.data!.byHostel[0].occupiedBeds).toBe(2);
    expect(result.data!.byHostel[0].occupancyRate).toBe(50);
    expect(result.data!.byHostel[1].hostelName).toBe("Slessor House");
    expect(result.data!.byHostel[1].totalBeds).toBe(3);
    expect(result.data!.byHostel[1].occupiedBeds).toBe(3);
    expect(result.data!.byHostel[1].occupancyRate).toBe(100);
  });
});

describe("getExeatAnalyticsAction", () => {
  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getExeatAnalyticsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return exeat stats: byType, byStatus, approvalRate, avgApprovalTimeHours", async () => {
    const requestedAt = new Date("2026-03-01T08:00:00Z");
    const approvalAt = new Date("2026-03-01T14:00:00Z"); // 6 hours later
    const departureDate = new Date("2026-03-02T08:00:00Z");
    const returnDate = new Date("2026-03-04T16:00:00Z"); // 2.33 days later

    prismaMock.exeat.findMany.mockResolvedValue([
      {
        id: "exeat-1",
        type: "WEEKEND",
        status: "RETURNED",
        reason: "Family visit",
        requestedAt,
        departureDate,
        expectedReturnDate: new Date("2026-03-04T18:00:00Z"),
        actualReturnDate: returnDate,
        approvals: [{ actionAt: approvalAt, action: "APPROVED" }],
      },
      {
        id: "exeat-2",
        type: "EMERGENCY",
        status: "HEADMASTER_APPROVED",
        reason: "Medical appointment",
        requestedAt: new Date("2026-03-05T09:00:00Z"),
        departureDate: new Date("2026-03-06T07:00:00Z"),
        expectedReturnDate: new Date("2026-03-06T18:00:00Z"),
        actualReturnDate: null,
        approvals: [
          { actionAt: new Date("2026-03-05T11:00:00Z"), action: "APPROVED" },
        ],
      },
      {
        id: "exeat-3",
        type: "WEEKEND",
        status: "OVERDUE",
        reason: "Family visit",
        requestedAt: new Date("2026-03-10T10:00:00Z"),
        departureDate: new Date("2026-03-11T08:00:00Z"),
        expectedReturnDate: new Date("2026-03-12T18:00:00Z"),
        actualReturnDate: null,
        approvals: [],
      },
      {
        id: "exeat-4",
        type: "WEEKEND",
        status: "REJECTED",
        reason: "Visiting relatives",
        requestedAt: new Date("2026-03-12T08:00:00Z"),
        departureDate: null,
        expectedReturnDate: null,
        actualReturnDate: null,
        approvals: [
          { actionAt: new Date("2026-03-12T15:00:00Z"), action: "REJECTED" },
        ],
      },
    ] as never);

    const result = await getExeatAnalyticsAction();

    expect(result.data).toBeDefined();
    expect(result.data!.total).toBe(4);
    // byType
    expect(result.data!.byType.WEEKEND).toBe(3);
    expect(result.data!.byType.EMERGENCY).toBe(1);
    // byStatus
    expect(result.data!.byStatus.RETURNED).toBe(1);
    expect(result.data!.byStatus.HEADMASTER_APPROVED).toBe(1);
    expect(result.data!.byStatus.OVERDUE).toBe(1);
    expect(result.data!.byStatus.REJECTED).toBe(1);
    // approvalRate: RETURNED + HEADMASTER_APPROVED = 2 out of 4 = 50
    expect(result.data!.approvalRate).toBe(50);
    // avgApprovalTimeHours: average of 6hrs and 2hrs and 7hrs from the 3 with approvals
    expect(result.data!.avgApprovalTimeHours).toBeGreaterThan(0);
    // overdueCount
    expect(result.data!.overdueCount).toBe(1);
    // topReasons
    expect(result.data!.topReasons.length).toBeGreaterThan(0);
    expect(result.data!.topReasons[0].reason).toBe("family visit");
    expect(result.data!.topReasons[0].count).toBe(2);
  });
});

describe("getRollCallAnalyticsAction", () => {
  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getRollCallAnalyticsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return attendance data with chronic absentees", async () => {
    const date1 = new Date("2026-03-20");
    const date2 = new Date("2026-03-21");

    prismaMock.rollCall.findMany.mockResolvedValue([
      {
        id: "rc-1",
        date: date1,
        type: "EVENING",
        hostelId: "hostel-1",
        records: [
          { studentId: "stu-1", status: "PRESENT" },
          { studentId: "stu-2", status: "ABSENT" },
          { studentId: "stu-3", status: "ABSENT" },
          { studentId: "stu-4", status: "EXEAT" },
        ],
      },
      {
        id: "rc-2",
        date: date2,
        type: "MORNING",
        hostelId: "hostel-1",
        records: [
          { studentId: "stu-1", status: "PRESENT" },
          { studentId: "stu-2", status: "ABSENT" },
          { studentId: "stu-3", status: "ABSENT" },
          { studentId: "stu-5", status: "SICK_BAY" },
        ],
      },
    ] as never);

    // stu-2 and stu-3 each have 2 absences out of 2 roll calls, but need >3 for chronic
    // For this test, add more roll calls to trigger chronic threshold
    // Actually let's mock enough data so stu-2 crosses the >3 threshold

    // Reset and use a richer dataset
    prismaMock.rollCall.findMany.mockResolvedValue([
      {
        id: "rc-1", date: new Date("2026-03-15"), type: "EVENING", hostelId: "hostel-1",
        records: [
          { studentId: "stu-1", status: "PRESENT" },
          { studentId: "stu-2", status: "ABSENT" },
        ],
      },
      {
        id: "rc-2", date: new Date("2026-03-16"), type: "MORNING", hostelId: "hostel-1",
        records: [
          { studentId: "stu-1", status: "PRESENT" },
          { studentId: "stu-2", status: "ABSENT" },
        ],
      },
      {
        id: "rc-3", date: new Date("2026-03-17"), type: "EVENING", hostelId: "hostel-1",
        records: [
          { studentId: "stu-1", status: "PRESENT" },
          { studentId: "stu-2", status: "ABSENT" },
        ],
      },
      {
        id: "rc-4", date: new Date("2026-03-18"), type: "MORNING", hostelId: "hostel-1",
        records: [
          { studentId: "stu-1", status: "ABSENT" },
          { studentId: "stu-2", status: "ABSENT" },
        ],
      },
      {
        id: "rc-5", date: new Date("2026-03-19"), type: "EVENING", hostelId: "hostel-1",
        records: [
          { studentId: "stu-1", status: "PRESENT" },
          { studentId: "stu-2", status: "ABSENT" },
          { studentId: "stu-3", status: "SICK_BAY" },
        ],
      },
    ] as never);

    // stu-2 has 5 absences (>3 = chronic), stu-1 has 1 absence
    prismaMock.student.findMany.mockResolvedValue([
      {
        id: "stu-2",
        firstName: "Kwesi",
        lastName: "Amoah",
        studentId: "STU-2026-002",
      },
    ] as never);

    const result = await getRollCallAnalyticsAction({ hostelId: "hostel-1", days: 30 });

    expect(result.data).toBeDefined();
    expect(result.data!.totalRollCalls).toBe(5);
    expect(result.data!.overallAttendanceRate).toBeGreaterThan(0);
    expect(result.data!.dailyRates).toHaveLength(5);
    // Chronic absentees: stu-2 with 5 absences
    expect(result.data!.chronicAbsentees).toHaveLength(1);
    expect(result.data!.chronicAbsentees[0].absenceCount).toBe(5);
    expect(result.data!.chronicAbsentees[0].studentName).toContain("Kwesi Amoah");
  });
});

describe("getBoardingOverviewAction", () => {
  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getBoardingOverviewAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return comprehensive KPI data (all counts in one call)", async () => {
    prismaMock.hostel.count.mockResolvedValue(4 as never);

    prismaMock.bed.groupBy.mockResolvedValue([
      { status: "OCCUPIED", _count: { _all: 150 } },
      { status: "AVAILABLE", _count: { _all: 50 } },
      { status: "RESERVED", _count: { _all: 10 } },
      { status: "MAINTENANCE", _count: { _all: 5 } },
    ] as never);

    prismaMock.exeat.count
      .mockResolvedValueOnce(12 as never)  // activeExeats (DEPARTED)
      .mockResolvedValueOnce(3 as never);  // overdueExeats (OVERDUE)

    prismaMock.sickBayAdmission.count.mockResolvedValue(7 as never);
    prismaMock.boardingVisitor.count.mockResolvedValue(4 as never);
    prismaMock.bedTransfer.count.mockResolvedValue(2 as never);
    prismaMock.maintenanceRequest.count.mockResolvedValue(9 as never);
    prismaMock.boardingIncident.count.mockResolvedValue(5 as never);

    const result = await getBoardingOverviewAction();

    expect(result.data).toBeDefined();
    expect(result.data!.totalHostels).toBe(4);
    expect(result.data!.totalBeds).toBe(215); // 150+50+10+5
    expect(result.data!.occupiedBeds).toBe(150);
    expect(result.data!.availableBeds).toBe(50);
    expect(result.data!.occupancyRate).toBeGreaterThan(0);
    expect(result.data!.activeExeats).toBe(12);
    expect(result.data!.overdueExeats).toBe(3);
    expect(result.data!.currentSickBay).toBe(7);
    expect(result.data!.activeVisitors).toBe(4);
    expect(result.data!.pendingTransfers).toBe(2);
    expect(result.data!.openMaintenance).toBe(9);
    expect(result.data!.activeIncidents).toBe(5);
  });
});
