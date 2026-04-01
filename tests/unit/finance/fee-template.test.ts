import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  createFeeTemplateAction,
  getFeeTemplatesAction,
  updateFeeTemplateAction,
  deleteFeeTemplateAction,
  createFeeStructureFromTemplateAction,
} from "@/modules/finance/actions/fee-template.action";

describe("Fee Template Actions", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  describe("createFeeTemplateAction", () => {
    const validInput = {
      name: "Term Fees Template",
      description: "Standard day student fees",
      boardingStatus: "DAY" as const,
      items: [
        { name: "Tuition", amount: 500, isOptional: false },
        { name: "PTA Dues", amount: 100, isOptional: false },
      ],
    };

    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await createFeeTemplateAction(validInput);
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject invalid input - missing name", async () => {
      const result = await createFeeTemplateAction({ ...validInput, name: "" });
      expect(result.error).toBe("Invalid input");
    });

    it("should reject invalid input - no items", async () => {
      const result = await createFeeTemplateAction({ ...validInput, items: [] });
      expect(result.error).toBe("Invalid input");
    });

    it("should reject invalid input - item with zero amount", async () => {
      const result = await createFeeTemplateAction({
        ...validInput,
        items: [{ name: "Tuition", amount: 0, isOptional: false }],
      });
      expect(result.error).toBe("Invalid input");
    });

    it("should reject duplicate template name", async () => {
      prismaMock.feeTemplate.findUnique.mockResolvedValue({ id: "existing" } as never);

      const result = await createFeeTemplateAction(validInput);
      expect(result.error).toContain("already exists");
    });

    it("should create template with valid data", async () => {
      prismaMock.feeTemplate.findUnique.mockResolvedValue(null);
      const mockTemplate = { id: "tmpl-1", name: validInput.name };

      prismaMock.$transaction.mockImplementation(async (fn) => {
        const tx = {
          feeTemplate: { create: async () => mockTemplate },
          feeTemplateItem: { createMany: async () => ({ count: 2 }) },
        };
        return fn(tx as never);
      });

      const result = await createFeeTemplateAction(validInput);
      expect(result.error).toBeUndefined();
    });
  });

  describe("getFeeTemplatesAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await getFeeTemplatesAction();
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should return templates with computed fields", async () => {
      prismaMock.feeTemplate.findMany.mockResolvedValue([
        {
          id: "tmpl-1",
          name: "Test Template",
          schoolId: "default-school",
          programmeId: null,
          isActive: true,
          items: [
            { id: "item-1", amount: 500 },
            { id: "item-2", amount: 200 },
          ],
        },
      ] as never);

      const result = await getFeeTemplatesAction();
      expect(result.data).toBeDefined();
      expect(result.data![0].itemCount).toBe(2);
      expect(result.data![0].totalAmount).toBe(700);
    });
  });

  describe("updateFeeTemplateAction", () => {
    it("should reject if template not found", async () => {
      prismaMock.feeTemplate.findUnique.mockResolvedValue(null);
      const result = await updateFeeTemplateAction("nonexistent", { name: "New Name" });
      expect(result).toEqual({ error: "Fee template not found" });
    });

    it("should update template name", async () => {
      prismaMock.feeTemplate.findUnique.mockResolvedValue({ id: "tmpl-1" } as never);
      prismaMock.feeTemplate.update.mockResolvedValue({ id: "tmpl-1", name: "Updated" } as never);

      const result = await updateFeeTemplateAction("tmpl-1", { name: "Updated" });
      expect(result.data).toBeDefined();
    });
  });

  describe("deleteFeeTemplateAction", () => {
    it("should reject if template not found", async () => {
      prismaMock.feeTemplate.findUnique.mockResolvedValue(null);
      const result = await deleteFeeTemplateAction("nonexistent");
      expect(result).toEqual({ error: "Fee template not found" });
    });

    it("should delete template", async () => {
      prismaMock.feeTemplate.findUnique.mockResolvedValue({ id: "tmpl-1", name: "Test" } as never);
      prismaMock.feeTemplate.delete.mockResolvedValue({} as never);

      const result = await deleteFeeTemplateAction("tmpl-1");
      expect(result.data).toEqual({ success: true });
    });
  });

  describe("createFeeStructureFromTemplateAction", () => {
    const validInput = {
      feeTemplateId: "tmpl-1",
      academicYearId: "ay-1",
      termId: "term-1",
      name: "Term 1 Fees 2026",
    };

    it("should reject if template not found", async () => {
      prismaMock.feeTemplate.findUnique.mockResolvedValue(null);
      const result = await createFeeStructureFromTemplateAction(validInput);
      expect(result).toEqual({ error: "Fee template not found" });
    });

    it("should create fee structure from template with amount adjustments", async () => {
      prismaMock.feeTemplate.findUnique.mockResolvedValue({
        id: "tmpl-1",
        isActive: true,
        programmeId: null,
        boardingStatus: null,
        items: [
          { name: "Tuition", code: "TUI", amount: 500, isOptional: false, description: null },
          { name: "PTA", code: "PTA", amount: 100, isOptional: false, description: null },
        ],
      } as never);

      const mockStructure = { id: "fs-1", name: validInput.name };
      prismaMock.$transaction.mockImplementation(async (fn) => {
        const tx = {
          feeStructure: { create: async () => mockStructure },
          feeItem: { createMany: async () => ({ count: 2 }) },
        };
        return fn(tx as never);
      });

      const result = await createFeeStructureFromTemplateAction({
        ...validInput,
        adjustments: [{ itemName: "Tuition", newAmount: 600 }],
      });
      expect(result.error).toBeUndefined();
    });
  });
});
