import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  getGuardiansAction,
  getGuardianAction,
  createGuardianAction,
  updateGuardianAction,
  linkGuardianToStudentAction,
  unlinkGuardianFromStudentAction,
  getStudentGuardiansAction,
} from "@/modules/student/actions/guardian.action";

// ─── getGuardiansAction ───────────────────────────────────────────

describe("getGuardiansAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getGuardiansAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return guardians list", async () => {
    prismaMock.guardian.findMany.mockResolvedValue([
      {
        id: "g1",
        firstName: "Kofi",
        lastName: "Asante",
        phone: "0241234567",
        altPhone: null,
        email: "kofi@example.com",
        occupation: "Teacher",
        address: "Accra",
        relationship: "Father",
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { students: 2 },
      },
    ] as never);

    const result = await getGuardiansAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: Array<Record<string, unknown>> }).data;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      id: "g1",
      firstName: "Kofi",
      studentCount: 2,
    });
  });

  it("should apply search filter", async () => {
    prismaMock.guardian.findMany.mockResolvedValue([] as never);

    const result = await getGuardiansAction("Kofi");
    expect(result).toHaveProperty("data");
    expect(prismaMock.guardian.findMany).toHaveBeenCalled();
  });
});

// ─── getGuardianAction ────────────────────────────────────────────

describe("getGuardianAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getGuardianAction("g1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if guardian not found", async () => {
    prismaMock.guardian.findUnique.mockResolvedValue(null as never);
    const result = await getGuardianAction("nonexistent");
    expect(result).toEqual({ error: "Guardian not found." });
  });

  it("should return guardian with linked students", async () => {
    prismaMock.guardian.findUnique.mockResolvedValue({
      id: "g1",
      firstName: "Kofi",
      lastName: "Asante",
      phone: "0241234567",
      altPhone: null,
      email: "kofi@example.com",
      occupation: "Teacher",
      address: "Accra",
      relationship: "Father",
      createdAt: new Date(),
      updatedAt: new Date(),
      students: [
        {
          student: {
            id: "s1",
            studentId: "SCH/2026/0001",
            firstName: "Kwame",
            lastName: "Asante",
            status: "ACTIVE",
          },
          isPrimary: true,
        },
      ],
    } as never);

    const result = await getGuardianAction("g1");
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.firstName).toBe("Kofi");
    const students = data.students as Array<Record<string, unknown>>;
    expect(students).toHaveLength(1);
    expect(students[0]).toMatchObject({ id: "s1", isPrimary: true });
  });
});

// ─── createGuardianAction ─────────────────────────────────────────

describe("createGuardianAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createGuardianAction({
      firstName: "Kofi",
      lastName: "Asante",
      phone: "0241234567",
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject missing first/last name", async () => {
    const result = await createGuardianAction({
      firstName: "",
      lastName: "",
      phone: "0241234567",
    });
    expect(result).toEqual({ error: "Guardian first and last names are required." });
  });

  it("should reject missing phone", async () => {
    const result = await createGuardianAction({
      firstName: "Kofi",
      lastName: "Asante",
      phone: "",
    });
    expect(result).toEqual({ error: "Guardian phone number is required." });
  });

  it("should create guardian successfully", async () => {
    const mockGuardian = {
      id: "g1",
      firstName: "Kofi",
      lastName: "Asante",
      phone: "0241234567",
    };
    prismaMock.guardian.create.mockResolvedValue(mockGuardian as never);

    const result = await createGuardianAction({
      firstName: "Kofi",
      lastName: "Asante",
      phone: "0241234567",
    });
    expect(result).toHaveProperty("data");
    expect((result as { data: typeof mockGuardian }).data.id).toBe("g1");
    expect(prismaMock.guardian.create).toHaveBeenCalled();
  });
});

// ─── updateGuardianAction ─────────────────────────────────────────

describe("updateGuardianAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateGuardianAction("g1", { firstName: "Updated" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if guardian not found", async () => {
    prismaMock.guardian.findUnique.mockResolvedValue(null as never);
    const result = await updateGuardianAction("nonexistent", { firstName: "Updated" });
    expect(result).toEqual({ error: "Guardian not found." });
  });

  it("should update guardian fields successfully", async () => {
    const existing = {
      id: "g1",
      firstName: "Kofi",
      lastName: "Asante",
      phone: "0241234567",
    };
    prismaMock.guardian.findUnique.mockResolvedValue(existing as never);

    const updated = { ...existing, firstName: "Kweku" };
    prismaMock.guardian.update.mockResolvedValue(updated as never);

    const result = await updateGuardianAction("g1", { firstName: "Kweku" });
    expect(result).toHaveProperty("data");
    expect((result as { data: typeof updated }).data.firstName).toBe("Kweku");
    expect(prismaMock.guardian.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "g1" },
        data: expect.objectContaining({ firstName: "Kweku" }),
      })
    );
  });
});

// ─── linkGuardianToStudentAction ──────────────────────────────────

describe("linkGuardianToStudentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await linkGuardianToStudentAction("s1", "g1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if link already exists", async () => {
    prismaMock.studentGuardian.findUnique.mockResolvedValue({
      id: "sg-1",
      studentId: "s1",
      guardianId: "g1",
    } as never);

    const result = await linkGuardianToStudentAction("s1", "g1");
    expect(result).toEqual({ error: "This guardian is already linked to this student." });
  });

  it("should create link successfully", async () => {
    prismaMock.studentGuardian.findUnique.mockResolvedValue(null as never);
    prismaMock.studentGuardian.create.mockResolvedValue({
      id: "sg-1",
      studentId: "s1",
      guardianId: "g1",
      isPrimary: false,
    } as never);
    prismaMock.student.findUnique.mockResolvedValue({
      firstName: "Kwame",
      lastName: "Asante",
    } as never);
    prismaMock.guardian.findUnique.mockResolvedValue({
      firstName: "Kofi",
      lastName: "Asante",
    } as never);

    const result = await linkGuardianToStudentAction("s1", "g1");
    expect(result).toHaveProperty("data");
    expect(prismaMock.studentGuardian.create).toHaveBeenCalled();
  });

  it("should unset other primary guardians when isPrimary is true", async () => {
    prismaMock.studentGuardian.findUnique.mockResolvedValue(null as never);
    prismaMock.studentGuardian.create.mockResolvedValue({
      id: "sg-1",
      studentId: "s1",
      guardianId: "g1",
      isPrimary: true,
    } as never);
    prismaMock.studentGuardian.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.student.findUnique.mockResolvedValue({
      firstName: "Kwame",
      lastName: "Asante",
    } as never);
    prismaMock.guardian.findUnique.mockResolvedValue({
      firstName: "Kofi",
      lastName: "Asante",
    } as never);

    const result = await linkGuardianToStudentAction("s1", "g1", true);
    expect(result).toHaveProperty("data");
    expect(prismaMock.studentGuardian.updateMany).toHaveBeenCalledWith({
      where: {
        studentId: "s1",
        id: { not: "sg-1" },
      },
      data: { isPrimary: false },
    });
  });
});

// ─── unlinkGuardianFromStudentAction ──────────────────────────────

describe("unlinkGuardianFromStudentAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await unlinkGuardianFromStudentAction("s1", "g1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if link not found", async () => {
    prismaMock.studentGuardian.findUnique.mockResolvedValue(null as never);
    const result = await unlinkGuardianFromStudentAction("s1", "g1");
    expect(result).toEqual({ error: "Guardian link not found." });
  });

  it("should delete link successfully", async () => {
    prismaMock.studentGuardian.findUnique.mockResolvedValue({
      id: "sg-1",
      studentId: "s1",
      guardianId: "g1",
    } as never);
    prismaMock.studentGuardian.delete.mockResolvedValue({} as never);
    prismaMock.student.findUnique.mockResolvedValue({
      firstName: "Kwame",
      lastName: "Asante",
    } as never);
    prismaMock.guardian.findUnique.mockResolvedValue({
      firstName: "Kofi",
      lastName: "Asante",
    } as never);

    const result = await unlinkGuardianFromStudentAction("s1", "g1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.studentGuardian.delete).toHaveBeenCalledWith({
      where: { id: "sg-1" },
    });
  });
});

// ─── getStudentGuardiansAction ────────────────────────────────────

describe("getStudentGuardiansAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getStudentGuardiansAction("s1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return student guardians list", async () => {
    prismaMock.studentGuardian.findMany.mockResolvedValue([
      {
        isPrimary: true,
        guardian: {
          id: "g1",
          firstName: "Kofi",
          lastName: "Asante",
          phone: "0241234567",
          altPhone: null,
          email: "kofi@example.com",
          occupation: "Teacher",
          address: "Accra",
          relationship: "Father",
        },
      },
    ] as never);

    const result = await getStudentGuardiansAction("s1");
    expect(result).toHaveProperty("data");
    const data = (result as { data: Array<Record<string, unknown>> }).data;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      id: "g1",
      firstName: "Kofi",
      isPrimary: true,
    });
  });
});
