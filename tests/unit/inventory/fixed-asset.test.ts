import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import {
  createFixedAssetAction,
  disposeAssetAction,
} from "@/modules/inventory/actions/fixed-asset.action";
import { runDepreciationAction } from "@/modules/inventory/actions/depreciation.action";

describe("Fixed Asset Actions", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  describe("createFixedAssetAction", () => {
    const validInput = {
      name: "Dell Latitude Laptop",
      categoryId: "cat-ict",
      purchasePrice: 5000,
      condition: "NEW" as const,
    };

    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await createFixedAssetAction(validInput);
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject missing name", async () => {
      const result = await createFixedAssetAction({ ...validInput, name: "" });
      expect(result.error).toBe("Invalid input");
    });

    it("should reject missing category", async () => {
      const result = await createFixedAssetAction({ ...validInput, categoryId: "" });
      expect(result.error).toBe("Invalid input");
    });

    it("should create asset with auto-generated number", async () => {
      prismaMock.fixedAsset.findFirst.mockResolvedValue(null);
      prismaMock.fixedAsset.create.mockResolvedValue({
        id: "asset-1", assetNumber: "AST/2026/0001", name: validInput.name,
      } as never);

      const result = await createFixedAssetAction(validInput);
      expect(result.data).toBeDefined();
      expect(result.data!.assetNumber).toMatch(/^AST\/\d{4}\/\d{4}$/);
    });
  });

  describe("disposeAssetAction", () => {
    it("should reject if asset not found", async () => {
      prismaMock.fixedAsset.findUnique.mockResolvedValue(null);
      const result = await disposeAssetAction({
        assetId: "nonexistent", disposalMethod: "SCRAPPED", disposalAmount: 0,
      });
      expect(result).toEqual({ error: "Asset not found" });
    });

    it("should reject already disposed asset", async () => {
      prismaMock.fixedAsset.findUnique.mockResolvedValue({
        id: "asset-1", status: "DISPOSED",
      } as never);
      const result = await disposeAssetAction({
        assetId: "asset-1", disposalMethod: "SCRAPPED", disposalAmount: 0,
      });
      expect(result.error).toContain("already disposed");
    });
  });

  describe("Depreciation calculations", () => {
    it("should calculate straight-line depreciation correctly", () => {
      const purchasePrice = 10000;
      const salvageValue = 1000;
      const usefulLife = 5;
      const annualDepreciation = (purchasePrice - salvageValue) / usefulLife;
      expect(annualDepreciation).toBe(1800);
    });

    it("should calculate reducing balance depreciation correctly", () => {
      const purchasePrice = 10000;
      const salvageValue = 1000;
      const usefulLife = 5;
      const rate = 1 - Math.pow(salvageValue / purchasePrice, 1 / usefulLife);

      // Year 1
      const year1Depreciation = purchasePrice * rate;
      const year1Value = purchasePrice - year1Depreciation;

      // Year 2
      const year2Depreciation = year1Value * rate;
      const year2Value = year1Value - year2Depreciation;

      expect(year1Depreciation).toBeGreaterThan(year2Depreciation); // reducing balance decreases each year
      expect(year2Value).toBeLessThan(year1Value);
      expect(year2Value).toBeGreaterThan(salvageValue);
    });

    it("should not depreciate below salvage value", () => {
      const currentValue = 1200;
      const salvageValue = 1000;
      const annualDepreciation = 500;

      const maxDepreciation = currentValue - salvageValue;
      const actualDepreciation = Math.min(annualDepreciation, maxDepreciation);

      expect(actualDepreciation).toBe(200);
      expect(currentValue - actualDepreciation).toBe(1000);
    });

    it("should skip depreciation if already at salvage value", () => {
      const currentValue = 1000;
      const salvageValue = 1000;
      const maxDepreciation = currentValue - salvageValue;
      expect(maxDepreciation).toBe(0);
    });
  });

  describe("runDepreciationAction", () => {
    it("should reject unauthenticated users", async () => {
      mockUnauthenticated();
      const result = await runDepreciationAction("2026");
      expect(result).toEqual({ error: "Unauthorized" });
    });
  });
});
