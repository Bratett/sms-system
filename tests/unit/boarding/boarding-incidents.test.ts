import { describe, it, expect, beforeEach } from "vitest";
import {
  prismaMock,
  mockAuthenticatedUser,
  mockUnauthenticated,
} from "../setup";

// ─── Import actions after vi.mock calls (in setup.ts) ────────────

import {
  getIncidentsAction,
  getIncidentAction,
  reportIncidentAction,
  updateIncidentAction,
  escalateIncidentAction,
  getIncidentStatsAction,
} from "@/modules/boarding/actions/incident.action";

import {
  getSickBayAdmissionsAction,
  getSickBayAdmissionAction,
  admitToSickBayAction,
  dischargeSickBayAction,
  referSickBayAction,
  addMedicationLogAction,
  getSickBayStatsAction,
} from "@/modules/boarding/actions/sick-bay.action";

// ─── Mock Data ────────────────────────────────────────────────────

const now = new Date("2026-03-15T10:00:00Z");

const mockBoardingIncident = {
  id: "inc-1",
  schoolId: "default-school",
  incidentNumber: "BIN/2026/0001",
  hostelId: "hostel-1",
  dormitoryId: "dorm-1",
  studentIds: ["student-1", "student-2"],
  reportedBy: "user-1",
  date: now,
  time: "22:30",
  category: "CURFEW_VIOLATION",
  severity: "MODERATE",
  title: "Late return to hostel",
  description: "Two students returned after curfew hours",
  actionTaken: null,
  status: "REPORTED",
  resolution: null,
  resolvedBy: null,
  resolvedAt: null,
  linkedDisciplineId: null,
  parentNotified: false,
  createdAt: now,
  updatedAt: now,
};

const mockSickBayAdmission = {
  id: "sba-1",
  schoolId: "default-school",
  admissionNumber: "SBA/2026/0001",
  studentId: "student-1",
  hostelId: "hostel-1",
  admittedBy: "user-1",
  admittedAt: now,
  symptoms: "Headache and fever",
  initialDiagnosis: "Possible malaria",
  temperature: 38.5,
  severity: "MODERATE",
  status: "ADMITTED",
  treatmentNotes: null,
  dischargedBy: null,
  dischargedAt: null,
  dischargeNotes: null,
  referredTo: null,
  parentNotified: false,
  createdAt: now,
  updatedAt: now,
};

const mockMedicationLog = {
  id: "med-1",
  sickBayAdmissionId: "sba-1",
  medicationName: "Paracetamol",
  dosage: "500mg",
  administeredBy: "user-1",
  administeredAt: now,
  notes: "After meals",
  createdAt: now,
  updatedAt: now,
};

// ═══════════════════════════════════════════════════════════════════
//  INCIDENT TESTS
// ═══════════════════════════════════════════════════════════════════

describe("Boarding Incident Actions", () => {
  // ─── getIncidentsAction ──────────────────────────────────────────

  describe("getIncidentsAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await getIncidentsAction();
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should return paginated incidents with resolved names", async () => {
      mockAuthenticatedUser();

      prismaMock.boardingIncident.findMany.mockResolvedValue([mockBoardingIncident] as never);
      prismaMock.boardingIncident.count.mockResolvedValue(1 as never);

      prismaMock.student.findMany.mockResolvedValue([
        { id: "student-1", firstName: "Kwame", lastName: "Asante", studentId: "STU001" },
        { id: "student-2", firstName: "Ama", lastName: "Mensah", studentId: "STU002" },
      ] as never);

      prismaMock.user.findMany.mockResolvedValue([
        { id: "user-1", firstName: "John", lastName: "Doe" },
      ] as never);

      prismaMock.hostel.findMany.mockResolvedValue([
        { id: "hostel-1", name: "Independence Hall" },
      ] as never);

      prismaMock.dormitory.findMany.mockResolvedValue([
        { id: "dorm-1", name: "Room A1" },
      ] as never);

      const result = await getIncidentsAction({ page: 1, pageSize: 10 });

      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("pagination");
      const data = (result as { data: Array<Record<string, unknown>> }).data;
      expect(data).toHaveLength(1);
      expect(data[0].studentNames).toEqual(["Kwame Asante", "Ama Mensah"]);
      expect(data[0].reporterName).toBe("John Doe");
      expect(data[0].hostelName).toBe("Independence Hall");
      expect(data[0].dormitoryName).toBe("Room A1");
      expect((result as { pagination: Record<string, number> }).pagination).toMatchObject({
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it("should filter by status", async () => {
      mockAuthenticatedUser();

      prismaMock.boardingIncident.findMany.mockResolvedValue([] as never);
      prismaMock.boardingIncident.count.mockResolvedValue(0 as never);

      await getIncidentsAction({ status: "RESOLVED" });

      expect(prismaMock.boardingIncident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "RESOLVED" }),
        }),
      );
    });

    it("should filter by category and severity", async () => {
      mockAuthenticatedUser();

      prismaMock.boardingIncident.findMany.mockResolvedValue([] as never);
      prismaMock.boardingIncident.count.mockResolvedValue(0 as never);

      await getIncidentsAction({ category: "BULLYING", severity: "MAJOR" });

      expect(prismaMock.boardingIncident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: "BULLYING", severity: "MAJOR" }),
        }),
      );
    });
  });

  // ─── reportIncidentAction ────────────────────────────────────────

  describe("reportIncidentAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await reportIncidentAction({
        hostelId: "hostel-1",
        studentIds: ["student-1"],
        date: "2026-03-15",
        category: "FIGHTING",
        severity: "MAJOR",
        title: "Fight in dormitory",
        description: "Two students involved in a physical altercation",
      });
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject invalid input (missing required fields)", async () => {
      mockAuthenticatedUser();

      const result = await reportIncidentAction({
        hostelId: "",
        studentIds: [],
        date: "",
        category: "FIGHTING",
        severity: "MAJOR",
        title: "",
        description: "",
      });

      expect(result).toHaveProperty("error");
      expect((result as { error: string }).error.length).toBeGreaterThan(0);
    });

    it("should create incident with auto-generated number", async () => {
      mockAuthenticatedUser();

      prismaMock.boardingIncident.count.mockResolvedValue(5 as never);
      prismaMock.boardingIncident.create.mockResolvedValue({
        ...mockBoardingIncident,
        incidentNumber: `BIN/${new Date().getFullYear()}/0006`,
      } as never);

      const result = await reportIncidentAction({
        hostelId: "hostel-1",
        studentIds: ["student-1"],
        date: "2026-03-15",
        category: "CURFEW_VIOLATION",
        severity: "MODERATE",
        title: "Late return to hostel",
        description: "Student returned after curfew",
      });

      expect(result).toHaveProperty("data");
      expect(prismaMock.boardingIncident.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            incidentNumber: expect.stringMatching(/^BIN\/\d{4}\/0006$/),
          }),
        }),
      );
    });

    it("should create incident with correct schoolId", async () => {
      mockAuthenticatedUser();

      prismaMock.boardingIncident.count.mockResolvedValue(0 as never);
      prismaMock.boardingIncident.create.mockResolvedValue(mockBoardingIncident as never);

      await reportIncidentAction({
        hostelId: "hostel-1",
        studentIds: ["student-1"],
        date: "2026-03-15",
        category: "THEFT",
        severity: "MAJOR",
        title: "Missing belongings",
        description: "Student reported missing items from locker",
      });

      expect(prismaMock.boardingIncident.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schoolId: "default-school",
          }),
        }),
      );
    });
  });

  // ─── updateIncidentAction ────────────────────────────────────────

  describe("updateIncidentAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await updateIncidentAction("inc-1", { status: "RESOLVED" });
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should update incident status", async () => {
      mockAuthenticatedUser();

      prismaMock.boardingIncident.findUnique.mockResolvedValue(mockBoardingIncident as never);
      prismaMock.boardingIncident.update.mockResolvedValue({
        ...mockBoardingIncident,
        status: "INVESTIGATING",
      } as never);

      const result = await updateIncidentAction("inc-1", { status: "INVESTIGATING" });

      expect(result).toHaveProperty("data");
      expect(prismaMock.boardingIncident.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inc-1" },
          data: expect.objectContaining({ status: "INVESTIGATING" }),
        }),
      );
    });

    it("should set resolvedBy and resolvedAt when status is RESOLVED", async () => {
      mockAuthenticatedUser();

      prismaMock.boardingIncident.findUnique.mockResolvedValue(mockBoardingIncident as never);
      prismaMock.boardingIncident.update.mockResolvedValue({
        ...mockBoardingIncident,
        status: "RESOLVED",
        resolvedBy: "test-user-id",
        resolvedAt: now,
      } as never);

      const result = await updateIncidentAction("inc-1", {
        status: "RESOLVED",
        resolution: "Students counselled and warned",
      });

      expect(result).toHaveProperty("data");
      expect(prismaMock.boardingIncident.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "RESOLVED",
            resolvedBy: "test-user-id",
            resolvedAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  // ─── escalateIncidentAction ──────────────────────────────────────

  describe("escalateIncidentAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await escalateIncidentAction("inc-1");
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject already escalated incidents", async () => {
      mockAuthenticatedUser();

      prismaMock.boardingIncident.findUnique.mockResolvedValue({
        ...mockBoardingIncident,
        status: "ESCALATED",
      } as never);

      const result = await escalateIncidentAction("inc-1");
      expect(result).toEqual({ error: "Incident is already escalated." });
    });

    it("should create DisciplinaryIncident and update BoardingIncident atomically", async () => {
      mockAuthenticatedUser();

      prismaMock.boardingIncident.findUnique.mockResolvedValue(mockBoardingIncident as never);

      const mockDisciplinaryIncident = {
        id: "disc-1",
        schoolId: "default-school",
        studentId: "student-1",
        reportedBy: "user-1",
        date: now,
        type: "CURFEW VIOLATION",
        description: `[Escalated from Boarding Incident BIN/2026/0001] Two students returned after curfew hours`,
        severity: "MODERATE",
        status: "REPORTED",
        createdAt: now,
        updatedAt: now,
      };

      prismaMock.$transaction.mockResolvedValue([
        mockDisciplinaryIncident,
        { ...mockBoardingIncident, status: "ESCALATED" },
      ] as never);

      prismaMock.boardingIncident.update.mockResolvedValue({
        ...mockBoardingIncident,
        status: "ESCALATED",
        linkedDisciplineId: "disc-1",
      } as never);

      const result = await escalateIncidentAction("inc-1");

      expect(result).toHaveProperty("data");
      const data = (result as { data: { incidentId: string; disciplinaryIncidentId: string } }).data;
      expect(data.incidentId).toBe("inc-1");
      expect(data.disciplinaryIncidentId).toBe("disc-1");
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });
  });

  // ─── getIncidentStatsAction ──────────────────────────────────────

  describe("getIncidentStatsAction", () => {
    it("should return counts by status, category, severity", async () => {
      mockAuthenticatedUser();

      // The action calls boardingIncident.count many times via Promise.all
      // 7 status + 11 category + 4 severity + 1 total = 23 calls
      const countMock = prismaMock.boardingIncident.count;

      // total
      countMock.mockResolvedValueOnce(50 as never);
      // byStatus: reported, investigating, actionTaken, resolved, escalated, dismissed
      countMock.mockResolvedValueOnce(10 as never);
      countMock.mockResolvedValueOnce(8 as never);
      countMock.mockResolvedValueOnce(5 as never);
      countMock.mockResolvedValueOnce(15 as never);
      countMock.mockResolvedValueOnce(7 as never);
      countMock.mockResolvedValueOnce(5 as never);
      // byCategory: 11 categories
      countMock.mockResolvedValueOnce(6 as never);  // curfewViolation
      countMock.mockResolvedValueOnce(4 as never);  // propertyDamage
      countMock.mockResolvedValueOnce(3 as never);  // bullying
      countMock.mockResolvedValueOnce(5 as never);  // fighting
      countMock.mockResolvedValueOnce(7 as never);  // unauthorizedAbsence
      countMock.mockResolvedValueOnce(2 as never);  // substanceAbuse
      countMock.mockResolvedValueOnce(4 as never);  // theft
      countMock.mockResolvedValueOnce(8 as never);  // noiseDisturbance
      countMock.mockResolvedValueOnce(3 as never);  // healthEmergency
      countMock.mockResolvedValueOnce(1 as never);  // safetyHazard
      countMock.mockResolvedValueOnce(7 as never);  // other
      // bySeverity: minor, moderate, major, critical
      countMock.mockResolvedValueOnce(12 as never);
      countMock.mockResolvedValueOnce(20 as never);
      countMock.mockResolvedValueOnce(13 as never);
      countMock.mockResolvedValueOnce(5 as never);

      const result = await getIncidentStatsAction();

      expect(result).toHaveProperty("data");
      const data = (result as { data: Record<string, unknown> }).data;
      expect(data).toMatchObject({
        total: 50,
        byStatus: {
          reported: 10,
          investigating: 8,
          actionTaken: 5,
          resolved: 15,
          escalated: 7,
          dismissed: 5,
        },
        byCategory: {
          curfewViolation: 6,
          propertyDamage: 4,
          bullying: 3,
          fighting: 5,
          unauthorizedAbsence: 7,
          substanceAbuse: 2,
          theft: 4,
          noiseDisturbance: 8,
          healthEmergency: 3,
          safetyHazard: 1,
          other: 7,
        },
        bySeverity: {
          minor: 12,
          moderate: 20,
          major: 13,
          critical: 5,
        },
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
//  SICK BAY TESTS
// ═══════════════════════════════════════════════════════════════════

describe("Sick Bay Actions", () => {
  // ─── getSickBayAdmissionsAction ──────────────────────────────────

  describe("getSickBayAdmissionsAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await getSickBayAdmissionsAction();
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should return paginated admissions with medication counts", async () => {
      mockAuthenticatedUser();

      prismaMock.sickBayAdmission.findMany.mockResolvedValue([
        {
          ...mockSickBayAdmission,
          _count: { medications: 3 },
        },
      ] as never);
      prismaMock.sickBayAdmission.count.mockResolvedValue(1 as never);

      prismaMock.student.findMany.mockResolvedValue([
        { id: "student-1", firstName: "Kwame", lastName: "Asante", studentId: "STU001" },
      ] as never);

      prismaMock.hostel.findMany.mockResolvedValue([
        { id: "hostel-1", name: "Independence Hall" },
      ] as never);

      prismaMock.user.findMany.mockResolvedValue([
        { id: "user-1", firstName: "Nurse", lastName: "Addo" },
      ] as never);

      const result = await getSickBayAdmissionsAction({ page: 1, pageSize: 10 });

      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("pagination");
      const data = (result as { data: Array<Record<string, unknown>> }).data;
      expect(data).toHaveLength(1);
      expect(data[0].studentName).toBe("Kwame Asante");
      expect(data[0].hostelName).toBe("Independence Hall");
      expect(data[0].medicationsCount).toBe(3);
      expect((result as { pagination: Record<string, number> }).pagination).toMatchObject({
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      });
    });
  });

  // ─── admitToSickBayAction ────────────────────────────────────────

  describe("admitToSickBayAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await admitToSickBayAction({
        studentId: "student-1",
        hostelId: "hostel-1",
        symptoms: "Headache",
        severity: "MILD",
      });
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject invalid input", async () => {
      mockAuthenticatedUser();

      const result = await admitToSickBayAction({
        studentId: "",
        hostelId: "",
        symptoms: "",
        severity: "MILD",
      });

      expect(result).toHaveProperty("error");
      expect((result as { error: string }).error.length).toBeGreaterThan(0);
    });

    it("should create admission with auto-generated number", async () => {
      mockAuthenticatedUser();

      prismaMock.sickBayAdmission.count.mockResolvedValue(3 as never);
      prismaMock.sickBayAdmission.create.mockResolvedValue({
        ...mockSickBayAdmission,
        admissionNumber: `SBA/${new Date().getFullYear()}/0004`,
      } as never);

      const result = await admitToSickBayAction({
        studentId: "student-1",
        hostelId: "hostel-1",
        symptoms: "Headache and fever",
        initialDiagnosis: "Possible malaria",
        temperature: 38.5,
        severity: "MODERATE",
      });

      expect(result).toHaveProperty("data");
      expect(prismaMock.sickBayAdmission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schoolId: "default-school",
            admissionNumber: expect.stringMatching(/^SBA\/\d{4}\/0004$/),
            studentId: "student-1",
            hostelId: "hostel-1",
            symptoms: "Headache and fever",
            severity: "MODERATE",
          }),
        }),
      );
    });
  });

  // ─── dischargeSickBayAction ──────────────────────────────────────

  describe("dischargeSickBayAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await dischargeSickBayAction("sba-1", "Recovered");
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject already discharged admissions", async () => {
      mockAuthenticatedUser();

      prismaMock.sickBayAdmission.findUnique.mockResolvedValue({
        ...mockSickBayAdmission,
        status: "DISCHARGED",
      } as never);

      const result = await dischargeSickBayAction("sba-1", "Already better");
      expect(result).toEqual({ error: "Admission is already discharged or referred." });
    });

    it("should discharge with notes and timestamp", async () => {
      mockAuthenticatedUser();

      prismaMock.sickBayAdmission.findUnique.mockResolvedValue(mockSickBayAdmission as never);
      prismaMock.sickBayAdmission.update.mockResolvedValue({
        ...mockSickBayAdmission,
        status: "DISCHARGED",
        dischargedBy: "test-user-id",
        dischargedAt: now,
        dischargeNotes: "Fever subsided, student recovered",
      } as never);

      const result = await dischargeSickBayAction("sba-1", "Fever subsided, student recovered");

      expect(result).toHaveProperty("data");
      expect(prismaMock.sickBayAdmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sba-1" },
          data: expect.objectContaining({
            status: "DISCHARGED",
            dischargedBy: "test-user-id",
            dischargedAt: expect.any(Date),
            dischargeNotes: "Fever subsided, student recovered",
          }),
        }),
      );
    });
  });

  // ─── referSickBayAction ──────────────────────────────────────────

  describe("referSickBayAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await referSickBayAction("sba-1", "Korle Bu Hospital");
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should set REFERRED status with referredTo", async () => {
      mockAuthenticatedUser();

      prismaMock.sickBayAdmission.findUnique.mockResolvedValue(mockSickBayAdmission as never);
      prismaMock.sickBayAdmission.update.mockResolvedValue({
        ...mockSickBayAdmission,
        status: "REFERRED",
        referredTo: "Korle Bu Teaching Hospital",
        dischargedBy: "test-user-id",
        dischargedAt: now,
        dischargeNotes: "Requires specialist care",
      } as never);

      const result = await referSickBayAction(
        "sba-1",
        "Korle Bu Teaching Hospital",
        "Requires specialist care",
      );

      expect(result).toHaveProperty("data");
      expect(prismaMock.sickBayAdmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sba-1" },
          data: expect.objectContaining({
            status: "REFERRED",
            referredTo: "Korle Bu Teaching Hospital",
            dischargeNotes: "Requires specialist care",
            dischargedBy: "test-user-id",
            dischargedAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  // ─── addMedicationLogAction ──────────────────────────────────────

  describe("addMedicationLogAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await addMedicationLogAction({
        sickBayAdmissionId: "sba-1",
        medicationName: "Paracetamol",
        dosage: "500mg",
      });
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject invalid input", async () => {
      mockAuthenticatedUser();

      const result = await addMedicationLogAction({
        sickBayAdmissionId: "",
        medicationName: "",
        dosage: "",
      });

      expect(result).toHaveProperty("error");
      expect((result as { error: string }).error.length).toBeGreaterThan(0);
    });

    it("should create medication log entry", async () => {
      mockAuthenticatedUser();

      prismaMock.sickBayAdmission.findUnique.mockResolvedValue(mockSickBayAdmission as never);
      prismaMock.medicationLog.create.mockResolvedValue(mockMedicationLog as never);

      const result = await addMedicationLogAction({
        sickBayAdmissionId: "sba-1",
        medicationName: "Paracetamol",
        dosage: "500mg",
        notes: "After meals",
      });

      expect(result).toHaveProperty("data");
      expect(prismaMock.medicationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sickBayAdmissionId: "sba-1",
            medicationName: "Paracetamol",
            dosage: "500mg",
            administeredBy: "test-user-id",
            notes: "After meals",
          }),
        }),
      );
    });

    it("should reject if admission is already discharged", async () => {
      mockAuthenticatedUser();

      prismaMock.sickBayAdmission.findUnique.mockResolvedValue({
        ...mockSickBayAdmission,
        status: "DISCHARGED",
      } as never);

      const result = await addMedicationLogAction({
        sickBayAdmissionId: "sba-1",
        medicationName: "Ibuprofen",
        dosage: "400mg",
      });

      expect(result).toEqual({
        error: "Cannot add medication to a discharged or referred admission.",
      });
    });
  });

  // ─── getSickBayStatsAction ───────────────────────────────────────

  describe("getSickBayStatsAction", () => {
    it("should return correct counts by status and severity", async () => {
      mockAuthenticatedUser();

      const countMock = prismaMock.sickBayAdmission.count;

      // 8 calls: admitted, underObservation, discharged, referred, mild, moderate, severe, emergency
      countMock.mockResolvedValueOnce(5 as never);   // currentlyAdmitted
      countMock.mockResolvedValueOnce(3 as never);   // underObservation
      countMock.mockResolvedValueOnce(20 as never);  // totalDischarged
      countMock.mockResolvedValueOnce(2 as never);   // totalReferred
      countMock.mockResolvedValueOnce(10 as never);  // mild
      countMock.mockResolvedValueOnce(12 as never);  // moderate
      countMock.mockResolvedValueOnce(6 as never);   // severe
      countMock.mockResolvedValueOnce(2 as never);   // emergency

      const result = await getSickBayStatsAction();

      expect(result).toHaveProperty("data");
      const data = (result as { data: Record<string, unknown> }).data;
      expect(data).toMatchObject({
        currentlyAdmitted: 5,
        underObservation: 3,
        totalDischarged: 20,
        totalReferred: 2,
        bySeverity: {
          mild: 10,
          moderate: 12,
          severe: 6,
          emergency: 2,
        },
      });
    });
  });
});
