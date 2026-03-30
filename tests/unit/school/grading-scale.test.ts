import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  getGradingScalesAction,
  getGradingScaleAction,
  createGradingScaleAction,
  updateGradingScaleAction,
  deleteGradingScaleAction,
  setDefaultGradingScaleAction,
} from "@/modules/school/actions/grading-scale.action";

const sampleGrades = [
  { grade: "A1", minScore: 80, maxScore: 100, interpretation: "Excellent", gradePoint: 1 },
  { grade: "B2", minScore: 70, maxScore: 79, interpretation: "Very Good", gradePoint: 2 },
];

// ─── getGradingScalesAction ───────────────────────────────────────

describe("getGradingScalesAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getGradingScalesAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await getGradingScalesAction();
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return grading scales list", async () => {
    prismaMock.gradingScale.findMany.mockResolvedValue([
      {
        id: "gs-1",
        name: "WAEC Standard",
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        gradeDefinitions: [
          { id: "gd-1", grade: "A1", minScore: 80, maxScore: 100, interpretation: "Excellent", gradePoint: 1 },
        ],
      },
    ] as never);

    const result = await getGradingScalesAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: Array<Record<string, unknown>> }).data;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      id: "gs-1",
      name: "WAEC Standard",
      isDefault: true,
      gradeCount: 1,
    });
  });
});

// ─── getGradingScaleAction ────────────────────────────────────────

describe("getGradingScaleAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getGradingScaleAction("gs-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if scale not found", async () => {
    prismaMock.gradingScale.findUnique.mockResolvedValue(null as never);
    const result = await getGradingScaleAction("nonexistent");
    expect(result).toEqual({ error: "Grading scale not found." });
  });

  it("should return grading scale with definitions", async () => {
    prismaMock.gradingScale.findUnique.mockResolvedValue({
      id: "gs-1",
      name: "WAEC Standard",
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      gradeDefinitions: [
        { id: "gd-1", grade: "A1", minScore: 80, maxScore: 100, interpretation: "Excellent", gradePoint: 1 },
      ],
    } as never);

    const result = await getGradingScaleAction("gs-1");
    expect(result).toHaveProperty("data");
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.name).toBe("WAEC Standard");
    expect((data.gradeDefinitions as unknown[]).length).toBe(1);
  });
});

// ─── createGradingScaleAction ─────────────────────────────────────

describe("createGradingScaleAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createGradingScaleAction({
      name: "Test Scale",
      grades: sampleGrades,
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await createGradingScaleAction({
      name: "Test Scale",
      grades: sampleGrades,
    });
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should reject if no grade definitions provided", async () => {
    const result = await createGradingScaleAction({
      name: "Empty Scale",
      grades: [],
    });
    expect(result).toEqual({ error: "At least one grade definition is required." });
  });

  it("should create grading scale successfully", async () => {
    const mockScale = {
      id: "gs-new",
      name: "Test Scale",
      isDefault: false,
      gradeDefinitions: [
        { id: "gd-1", grade: "A1", minScore: 80, maxScore: 100 },
      ],
    };
    prismaMock.gradingScale.create.mockResolvedValue(mockScale as never);

    const result = await createGradingScaleAction({
      name: "Test Scale",
      grades: sampleGrades,
    });
    expect(result).toHaveProperty("data");
    expect((result as { data: typeof mockScale }).data.name).toBe("Test Scale");
    expect(prismaMock.gradingScale.create).toHaveBeenCalled();
  });

  it("should unset other defaults when isDefault is true", async () => {
    prismaMock.gradingScale.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.gradingScale.create.mockResolvedValue({
      id: "gs-new",
      name: "New Default",
      isDefault: true,
      gradeDefinitions: [],
    } as never);

    const result = await createGradingScaleAction({
      name: "New Default",
      isDefault: true,
      grades: sampleGrades,
    });
    expect(result).toHaveProperty("data");
    expect(prismaMock.gradingScale.updateMany).toHaveBeenCalledWith({
      where: { schoolId: "default-school", isDefault: true },
      data: { isDefault: false },
    });
  });
});

// ─── updateGradingScaleAction ─────────────────────────────────────

describe("updateGradingScaleAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateGradingScaleAction("gs-1", { name: "Updated" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await updateGradingScaleAction("gs-1", { name: "Updated" });
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return error if scale not found", async () => {
    prismaMock.gradingScale.findUnique.mockResolvedValue(null as never);
    const result = await updateGradingScaleAction("nonexistent", { name: "Updated" });
    expect(result).toEqual({ error: "Grading scale not found." });
  });

  it("should update grading scale name", async () => {
    prismaMock.gradingScale.findUnique.mockResolvedValue({
      id: "gs-1",
      name: "Old Name",
      isDefault: false,
      gradeDefinitions: [],
    } as never);

    const updated = {
      id: "gs-1",
      name: "New Name",
      isDefault: false,
      gradeDefinitions: [],
    };
    prismaMock.gradingScale.update.mockResolvedValue(updated as never);

    const result = await updateGradingScaleAction("gs-1", { name: "New Name" });
    expect(result).toHaveProperty("data");
    expect((result as { data: typeof updated }).data.name).toBe("New Name");
  });

  it("should replace grade definitions when grades provided", async () => {
    prismaMock.gradingScale.findUnique.mockResolvedValue({
      id: "gs-1",
      name: "Scale",
      isDefault: false,
      gradeDefinitions: [{ id: "gd-old" }],
    } as never);
    prismaMock.gradeDefinition.deleteMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.gradingScale.update.mockResolvedValue({
      id: "gs-1",
      name: "Scale",
      gradeDefinitions: sampleGrades,
    } as never);

    const result = await updateGradingScaleAction("gs-1", {
      grades: sampleGrades,
    });
    expect(result).toHaveProperty("data");
    expect(prismaMock.gradeDefinition.deleteMany).toHaveBeenCalledWith({
      where: { gradingScaleId: "gs-1" },
    });
  });
});

// ─── deleteGradingScaleAction ─────────────────────────────────────

describe("deleteGradingScaleAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deleteGradingScaleAction("gs-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if scale not found", async () => {
    prismaMock.gradingScale.findUnique.mockResolvedValue(null as never);
    const result = await deleteGradingScaleAction("nonexistent");
    expect(result).toEqual({ error: "Grading scale not found." });
  });

  it("should reject deletion of default scale", async () => {
    prismaMock.gradingScale.findUnique.mockResolvedValue({
      id: "gs-1",
      name: "Default Scale",
      isDefault: true,
      gradeDefinitions: [],
    } as never);

    const result = await deleteGradingScaleAction("gs-1");
    expect(result).toEqual({
      error: "Cannot delete the default grading scale. Set another scale as default first.",
    });
  });

  it("should delete non-default scale successfully", async () => {
    prismaMock.gradingScale.findUnique.mockResolvedValue({
      id: "gs-1",
      name: "Old Scale",
      isDefault: false,
      gradeDefinitions: [],
    } as never);
    prismaMock.gradingScale.delete.mockResolvedValue({} as never);

    const result = await deleteGradingScaleAction("gs-1");
    expect(result).toEqual({ success: true });
    expect(prismaMock.gradingScale.delete).toHaveBeenCalledWith({
      where: { id: "gs-1" },
    });
  });
});

// ─── setDefaultGradingScaleAction ─────────────────────────────────

describe("setDefaultGradingScaleAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await setDefaultGradingScaleAction("gs-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no school configured", async () => {
    prismaMock.school.findFirst.mockResolvedValue(null as never);
    const result = await setDefaultGradingScaleAction("gs-1");
    expect(result).toEqual({ error: "No school configured" });
  });

  it("should return error if scale not found", async () => {
    prismaMock.gradingScale.findUnique.mockResolvedValue(null as never);
    const result = await setDefaultGradingScaleAction("nonexistent");
    expect(result).toEqual({ error: "Grading scale not found." });
  });

  it("should return error if scale is already default", async () => {
    prismaMock.gradingScale.findUnique.mockResolvedValue({
      id: "gs-1",
      name: "Current Default",
      isDefault: true,
    } as never);

    const result = await setDefaultGradingScaleAction("gs-1");
    expect(result).toEqual({ error: "This scale is already the default." });
  });

  it("should set scale as default and unset others", async () => {
    prismaMock.gradingScale.findUnique.mockResolvedValue({
      id: "gs-2",
      name: "New Default",
      isDefault: false,
    } as never);
    prismaMock.gradingScale.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.gradingScale.update.mockResolvedValue({
      id: "gs-2",
      name: "New Default",
      isDefault: true,
    } as never);

    const result = await setDefaultGradingScaleAction("gs-2");
    expect(result).toHaveProperty("data");
    expect(prismaMock.gradingScale.updateMany).toHaveBeenCalledWith({
      where: { schoolId: "default-school", isDefault: true },
      data: { isDefault: false },
    });
    expect(prismaMock.gradingScale.update).toHaveBeenCalledWith({
      where: { id: "gs-2" },
      data: { isDefault: true },
    });
  });
});
