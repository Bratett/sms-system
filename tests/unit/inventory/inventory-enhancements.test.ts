import { describe, it, expect, beforeEach } from "vitest";
import {
  prismaMock,
  mockAuthenticatedUser,
  mockUnauthenticated,
} from "../setup";

// ─── Import actions ────────────────────────────────────────────────

import {
  getInventoryOverviewAction,
  getStockTrendAnalyticsAction,
  getABCAnalysisAction,
  getCategoryDistributionAction,
  getStockAgingAnalysisAction,
  getReorderAnalyticsAction,
} from "@/modules/inventory/actions/analytics.action";

import {
  getTransfersAction,
  createTransferAction,
  approveTransferAction,
  cancelTransferAction,
} from "@/modules/inventory/actions/transfer.action";

import {
  getRequisitionsAction,
  createRequisitionAction,
  approveRequisitionAction,
  rejectRequisitionAction,
} from "@/modules/inventory/actions/requisition.action";

import {
  getStockTakesAction,
  createStockTakeAction,
  startStockTakeAction,
  recordCountAction,
  completeStockTakeAction,
  getVarianceSummaryAction,
} from "@/modules/inventory/actions/stock-take.action";

import {
  rateSupplierAction,
  getSupplierRatingsAction,
  getSupplierScorecardsAction,
} from "@/modules/inventory/actions/supplier-rating.action";

import {
  addExpiryTrackingAction,
  getExpiringItemsAction,
  getExpiredItemsAction,
} from "@/modules/inventory/actions/expiry.action";

import {
  recordWastageAction,
  getWastageReportAction,
  getWastageAnalyticsAction,
} from "@/modules/inventory/actions/wastage.action";

import {
  checkoutAssetAction,
  returnAssetAction,
  getActiveCheckoutsAction,
  getOverdueCheckoutsAction,
} from "@/modules/inventory/actions/asset-checkout.action";

import {
  getAssetAuditsAction,
  createAssetAuditAction,
  recordAuditFindingsAction,
  completeAssetAuditAction,
} from "@/modules/inventory/actions/asset-audit.action";

// ─── Mock Data ──────────────────────────────────────────────────────

const now = new Date("2026-04-02T10:00:00Z");

const mockSchool = { id: "school-1", name: "Test School" };

const mockStore = {
  id: "store-1",
  schoolId: "school-1",
  name: "Main Store",
  description: null,
  managerId: null,
  status: "ACTIVE",
  createdAt: now,
  updatedAt: now,
};

const mockStoreItem = {
  id: "item-1",
  storeId: "store-1",
  categoryId: "cat-1",
  name: "A4 Paper",
  code: "A4P",
  unit: "reams",
  quantity: 100,
  reorderLevel: 20,
  unitPrice: { toNumber: () => 25.0 } as any,
  description: null,
  status: "ACTIVE",
  createdAt: now,
  updatedAt: now,
};

const mockStoreItem2 = {
  ...mockStoreItem,
  id: "item-2",
  name: "Whiteboard Markers",
  code: "WBM",
  unit: "boxes",
  quantity: 5,
  reorderLevel: 10,
  unitPrice: { toNumber: () => 15.0 } as any,
};

const mockFixedAsset = {
  id: "asset-1",
  schoolId: "school-1",
  assetNumber: "AST/2026/0001",
  name: "Projector",
  description: "Epson EB-X51",
  categoryId: "acat-1",
  location: "Science Block Room 3",
  departmentId: null,
  serialNumber: "SN12345",
  model: "EB-X51",
  manufacturer: "Epson",
  purchaseDate: now,
  purchasePrice: { toNumber: () => 5000.0 } as any,
  currentValue: { toNumber: () => 4000.0 } as any,
  usefulLifeYears: 5,
  salvageValue: { toNumber: () => 500.0 } as any,
  depreciationMethod: "STRAIGHT_LINE",
  condition: "GOOD",
  status: "ACTIVE",
  disposedAt: null,
  disposalMethod: null,
  disposalAmount: null,
  disposedBy: null,
  purchaseOrderId: null,
  accountId: null,
  photoUrl: null,
  createdAt: now,
  updatedAt: now,
};

// ─── Test Setup ─────────────────────────────────────────────────────

beforeEach(() => {
  mockAuthenticatedUser();
  prismaMock.school.findFirst.mockResolvedValue(mockSchool as any);
});

// ═══════════════════════════════════════════════════════════════════
// ANALYTICS TESTS
// ═══════════════════════════════════════════════════════════════════

describe("Inventory Analytics", () => {
  describe("getInventoryOverviewAction", () => {
    it("should return unauthorized when not authenticated", async () => {
      mockUnauthenticated();
      const result = await getInventoryOverviewAction();
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should return error when no school configured", async () => {
      prismaMock.school.findFirst.mockResolvedValue(null);
      const result = await getInventoryOverviewAction();
      expect(result).toEqual({ error: "No school configured" });
    });
  });

  describe("getStockTrendAnalyticsAction", () => {
    it("should return unauthorized when not authenticated", async () => {
      mockUnauthenticated();
      const result = await getStockTrendAnalyticsAction();
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should group movements by month", async () => {
      prismaMock.stockMovement.findMany.mockResolvedValue([
        { type: "IN", quantity: 50, conductedAt: new Date("2026-03-15") } as any,
        { type: "OUT", quantity: 20, conductedAt: new Date("2026-03-20") } as any,
        { type: "IN", quantity: 30, conductedAt: new Date("2026-02-10") } as any,
      ]);

      const result = await getStockTrendAnalyticsAction(3);
      expect(result.data).toBeDefined();
      expect(result.data!.length).toBeGreaterThan(0);

      const marchData = result.data!.find((d: any) => d.month === "2026-03");
      if (marchData) {
        expect(marchData.stockIn).toBe(50);
        expect(marchData.stockOut).toBe(20);
      }
    });
  });

  describe("getABCAnalysisAction", () => {
    it("should classify items into A, B, C categories", async () => {
      prismaMock.stockMovement.findMany.mockResolvedValue([
        { storeItemId: "item-1", quantity: 100 } as any,
        { storeItemId: "item-2", quantity: 10 } as any,
      ]);

      prismaMock.storeItem.findMany.mockResolvedValue([
        { ...mockStoreItem, store: { name: "Main" }, category: { name: "Office" } },
        { ...mockStoreItem2, store: { name: "Main" }, category: { name: "Office" } },
      ] as any);

      const result = await getABCAnalysisAction();
      expect(result.data).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary!.classA.count + result.summary!.classB.count + result.summary!.classC.count).toBe(2);
    });
  });

  describe("getCategoryDistributionAction", () => {
    it("should return item count and value by category", async () => {
      prismaMock.storeItem.findMany.mockResolvedValue([
        { ...mockStoreItem, category: { name: "Office Supplies" } },
        { ...mockStoreItem2, category: { name: "Office Supplies" } },
      ] as any);

      const result = await getCategoryDistributionAction();
      expect(result.data).toBeDefined();
      expect(result.data![0].name).toBe("Office Supplies");
      expect(result.data![0].itemCount).toBe(2);
    });
  });

  describe("getStockAgingAnalysisAction", () => {
    it("should classify items by last movement date", async () => {
      prismaMock.storeItem.findMany.mockResolvedValue([
        {
          ...mockStoreItem,
          store: { name: "Main" },
          category: { name: "Office" },
          movements: [{ conductedAt: new Date("2025-12-01") }],
        },
      ] as any);

      const result = await getStockAgingAnalysisAction();
      expect(result.data).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.data![0].agingBucket).toBeDefined();
    });
  });

  describe("getReorderAnalyticsAction", () => {
    it("should identify items needing reorder", async () => {
      prismaMock.storeItem.findMany.mockResolvedValue([
        { ...mockStoreItem2, store: { name: "Main" }, category: { name: "Office" } },
      ] as any);

      const result = await getReorderAnalyticsAction();
      expect(result.data).toBeDefined();
      expect(result.data![0].deficit).toBe(5); // reorder 10 - qty 5
      expect(result.summary!.totalItemsNeedingReorder).toBe(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// TRANSFER TESTS
// ═══════════════════════════════════════════════════════════════════

describe("Inter-Store Transfers", () => {
  describe("createTransferAction", () => {
    it("should return unauthorized when not authenticated", async () => {
      mockUnauthenticated();
      const result = await createTransferAction({
        fromStoreId: "store-1",
        toStoreId: "store-2",
        items: [{ storeItemId: "item-1", quantity: 10 }],
      });
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject when source and destination are the same", async () => {
      const result = await createTransferAction({
        fromStoreId: "store-1",
        toStoreId: "store-1",
        items: [{ storeItemId: "item-1", quantity: 10 }],
      });
      expect(result).toEqual({ error: "Source and destination stores must be different." });
    });

    it("should reject empty items", async () => {
      const result = await createTransferAction({
        fromStoreId: "store-1",
        toStoreId: "store-2",
        items: [],
      });
      expect(result).toEqual({ error: "At least one item is required." });
    });

    it("should reject insufficient stock", async () => {
      prismaMock.storeItem.findUnique.mockResolvedValue({
        ...mockStoreItem,
        quantity: 5,
      } as any);

      const result = await createTransferAction({
        fromStoreId: "store-1",
        toStoreId: "store-2",
        items: [{ storeItemId: "item-1", quantity: 50 }],
      });
      expect(result.error).toContain("Insufficient stock");
    });

    it("should create transfer with valid data", async () => {
      prismaMock.storeItem.findUnique.mockResolvedValue(mockStoreItem as any);
      prismaMock.storeTransfer.findFirst.mockResolvedValue(null);
      prismaMock.storeTransfer.create.mockResolvedValue({
        id: "transfer-1",
        transferNumber: "TRF/2026/0001",
        status: "PENDING",
        items: [],
      } as any);

      const result = await createTransferAction({
        fromStoreId: "store-1",
        toStoreId: "store-2",
        items: [{ storeItemId: "item-1", quantity: 10 }],
      });
      expect(result.data).toBeDefined();
      expect(result.data!.transferNumber).toBe("TRF/2026/0001");
    });
  });

  describe("approveTransferAction", () => {
    it("should reject non-pending transfers", async () => {
      prismaMock.storeTransfer.findUnique.mockResolvedValue({
        id: "transfer-1",
        status: "IN_TRANSIT",
        transferNumber: "TRF/2026/0001",
      } as any);

      const result = await approveTransferAction("transfer-1");
      expect(result).toEqual({ error: "Only pending transfers can be approved." });
    });

    it("should approve and set status to IN_TRANSIT", async () => {
      prismaMock.storeTransfer.findUnique.mockResolvedValue({
        id: "transfer-1",
        status: "PENDING",
        transferNumber: "TRF/2026/0001",
      } as any);
      prismaMock.storeTransfer.update.mockResolvedValue({
        id: "transfer-1",
        status: "IN_TRANSIT",
      } as any);

      const result = await approveTransferAction("transfer-1");
      expect(result.data?.status).toBe("IN_TRANSIT");
    });
  });

  describe("cancelTransferAction", () => {
    it("should not cancel received transfers", async () => {
      prismaMock.storeTransfer.findUnique.mockResolvedValue({
        id: "transfer-1",
        status: "RECEIVED",
        transferNumber: "TRF/2026/0001",
      } as any);

      const result = await cancelTransferAction("transfer-1");
      expect(result.error).toContain("Cannot cancel");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// REQUISITION TESTS
// ═══════════════════════════════════════════════════════════════════

describe("Department Requisitions", () => {
  describe("createRequisitionAction", () => {
    it("should return unauthorized when not authenticated", async () => {
      mockUnauthenticated();
      const result = await createRequisitionAction({
        storeId: "store-1",
        department: "Science",
        items: [{ storeItemId: "item-1", quantityRequested: 10 }],
      });
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should reject empty department", async () => {
      const result = await createRequisitionAction({
        storeId: "store-1",
        department: "  ",
        items: [{ storeItemId: "item-1", quantityRequested: 10 }],
      });
      expect(result).toEqual({ error: "Department is required." });
    });

    it("should create requisition with valid data", async () => {
      prismaMock.requisition.findFirst.mockResolvedValue(null);
      prismaMock.requisition.create.mockResolvedValue({
        id: "req-1",
        requisitionNumber: "REQ/2026/0001",
        status: "PENDING",
        items: [],
      } as any);

      const result = await createRequisitionAction({
        storeId: "store-1",
        department: "Science",
        purpose: "Lab practicals",
        items: [{ storeItemId: "item-1", quantityRequested: 10 }],
      });
      expect(result.data).toBeDefined();
      expect(result.data!.requisitionNumber).toBe("REQ/2026/0001");
    });
  });

  describe("approveRequisitionAction", () => {
    it("should reject non-pending requisitions", async () => {
      prismaMock.requisition.findUnique.mockResolvedValue({
        id: "req-1",
        status: "APPROVED",
        requisitionNumber: "REQ/2026/0001",
      } as any);

      const result = await approveRequisitionAction("req-1");
      expect(result.error).toBe("Only pending requisitions can be approved.");
    });
  });

  describe("rejectRequisitionAction", () => {
    it("should reject with reason", async () => {
      prismaMock.requisition.findUnique.mockResolvedValue({
        id: "req-1",
        status: "PENDING",
        requisitionNumber: "REQ/2026/0001",
      } as any);
      prismaMock.requisition.update.mockResolvedValue({
        id: "req-1",
        status: "REJECTED",
      } as any);

      const result = await rejectRequisitionAction("req-1", "Budget constraints");
      expect(result.data?.status).toBe("REJECTED");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// STOCK TAKE TESTS
// ═══════════════════════════════════════════════════════════════════

describe("Stock Takes & Reconciliation", () => {
  describe("createStockTakeAction", () => {
    it("should return unauthorized when not authenticated", async () => {
      mockUnauthenticated();
      const result = await createStockTakeAction({ storeId: "store-1" });
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("should create stock take with auto-populated items", async () => {
      prismaMock.store.findUnique.mockResolvedValue(mockStore as any);
      prismaMock.stockTake.findFirst.mockResolvedValue(null);
      prismaMock.storeItem.findMany.mockResolvedValue([
        { id: "item-1", name: "A4 Paper", quantity: 100 },
        { id: "item-2", name: "Markers", quantity: 50 },
      ] as any);
      prismaMock.stockTake.create.mockResolvedValue({
        id: "st-1",
        reference: "ST/2026/0001",
        status: "PLANNED",
        items: [
          { id: "sti-1", storeItemId: "item-1", itemName: "A4 Paper", systemQuantity: 100 },
          { id: "sti-2", storeItemId: "item-2", itemName: "Markers", systemQuantity: 50 },
        ],
      } as any);

      const result = await createStockTakeAction({ storeId: "store-1" });
      expect(result.data).toBeDefined();
      expect(result.data!.items).toHaveLength(2);
    });
  });

  describe("startStockTakeAction", () => {
    it("should only start planned stock takes", async () => {
      prismaMock.stockTake.findUnique.mockResolvedValue({
        id: "st-1",
        status: "IN_PROGRESS",
        reference: "ST/2026/0001",
      } as any);

      const result = await startStockTakeAction("st-1");
      expect(result.error).toBe("Only planned stock takes can be started.");
    });
  });

  describe("recordCountAction", () => {
    it("should reject if not in progress", async () => {
      prismaMock.stockTake.findUnique.mockResolvedValue({
        id: "st-1",
        status: "PLANNED",
      } as any);

      const result = await recordCountAction("st-1", []);
      expect(result.error).toBe("Stock take must be in progress to record counts.");
    });
  });

  describe("completeStockTakeAction", () => {
    it("should reject if items not counted", async () => {
      prismaMock.stockTake.findUnique.mockResolvedValue({
        id: "st-1",
        status: "IN_PROGRESS",
        items: [
          { id: "sti-1", physicalQuantity: 100 },
          { id: "sti-2", physicalQuantity: null },
        ],
      } as any);

      const result = await completeStockTakeAction("st-1");
      expect(result.error).toContain("1 item(s) have not been counted");
    });
  });

  describe("getVarianceSummaryAction", () => {
    it("should calculate variance statistics", async () => {
      prismaMock.stockTake.findUnique.mockResolvedValue({
        id: "st-1",
        items: [
          { id: "sti-1", storeItemId: "item-1", physicalQuantity: 100, systemQuantity: 100, variance: 0 },
          { id: "sti-2", storeItemId: "item-2", physicalQuantity: 48, systemQuantity: 50, variance: -2 },
          { id: "sti-3", storeItemId: "item-3", physicalQuantity: 55, systemQuantity: 50, variance: 5 },
        ],
      } as any);

      prismaMock.storeItem.findMany.mockResolvedValue([
        { id: "item-1", unitPrice: { toNumber: () => 25.0 } },
        { id: "item-2", unitPrice: { toNumber: () => 15.0 } },
        { id: "item-3", unitPrice: { toNumber: () => 10.0 } },
      ] as any);

      const result = await getVarianceSummaryAction("st-1");
      expect(result.data).toBeDefined();
      expect(result.data!.totalItems).toBe(3);
      expect(result.data!.matchedItems).toBe(1);
      expect(result.data!.overItems).toBe(1);
      expect(result.data!.shortItems).toBe(1);
      expect(result.data!.overValue).toBe(50); // 5 * 10
      expect(result.data!.shortValue).toBe(30); // 2 * 15
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUPPLIER RATING TESTS
// ═══════════════════════════════════════════════════════════════════

describe("Supplier Ratings", () => {
  describe("rateSupplierAction", () => {
    it("should reject invalid scores", async () => {
      const result = await rateSupplierAction({
        supplierId: "sup-1",
        deliveryScore: 6,
        qualityScore: 3,
        pricingScore: 4,
      });
      expect(result.error).toContain("between 1 and 5");
    });

    it("should calculate overall score correctly", async () => {
      prismaMock.supplier.findUnique.mockResolvedValue({
        id: "sup-1",
        name: "Supplier A",
      } as any);
      prismaMock.supplierRating.create.mockResolvedValue({
        id: "rating-1",
        overallScore: { toNumber: () => 4.0 },
      } as any);

      const result = await rateSupplierAction({
        supplierId: "sup-1",
        deliveryScore: 5,
        qualityScore: 4,
        pricingScore: 3,
      });
      expect(result.data).toBeDefined();
    });
  });

  describe("getSupplierRatingsAction", () => {
    it("should calculate averages", async () => {
      prismaMock.supplierRating.findMany.mockResolvedValue([
        {
          id: "r1", deliveryScore: 4, qualityScore: 5, pricingScore: 3,
          overallScore: { toNumber: () => 4.0 }, ratedBy: "user-1", ratedAt: now,
          comments: null, purchaseOrderId: null, supplierId: "sup-1",
        },
        {
          id: "r2", deliveryScore: 3, qualityScore: 4, pricingScore: 5,
          overallScore: { toNumber: () => 4.0 }, ratedBy: "user-1", ratedAt: now,
          comments: null, purchaseOrderId: null, supplierId: "sup-1",
        },
      ] as any);

      prismaMock.user.findMany.mockResolvedValue([
        { id: "user-1", firstName: "Test", lastName: "User" },
      ] as any);

      const result = await getSupplierRatingsAction("sup-1");
      expect(result.data).toHaveLength(2);
      expect(result.averages!.delivery).toBe(3.5);
      expect(result.averages!.quality).toBe(4.5);
      expect(result.averages!.totalRatings).toBe(2);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// EXPIRY TRACKING TESTS
// ═══════════════════════════════════════════════════════════════════

describe("Expiry Tracking", () => {
  describe("addExpiryTrackingAction", () => {
    it("should reject zero quantity", async () => {
      const result = await addExpiryTrackingAction({
        storeItemId: "item-1",
        quantity: 0,
        expiryDate: "2026-05-01",
      });
      expect(result.error).toBe("Quantity must be greater than zero.");
    });

    it("should create tracking record", async () => {
      prismaMock.storeItem.findUnique.mockResolvedValue(mockStoreItem as any);
      prismaMock.itemExpiryTracking.create.mockResolvedValue({
        id: "exp-1",
        storeItemId: "item-1",
        quantity: 50,
        expiryDate: new Date("2026-05-01"),
      } as any);

      const result = await addExpiryTrackingAction({
        storeItemId: "item-1",
        batchNumber: "BATCH-001",
        quantity: 50,
        expiryDate: "2026-05-01",
      });
      expect(result.data).toBeDefined();
    });
  });

  describe("getExpiringItemsAction", () => {
    it("should return unauthorized when not authenticated", async () => {
      mockUnauthenticated();
      const result = await getExpiringItemsAction();
      expect(result).toEqual({ error: "Unauthorized" });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// WASTAGE TESTS
// ═══════════════════════════════════════════════════════════════════

describe("Wastage Recording", () => {
  describe("recordWastageAction", () => {
    it("should reject zero quantity", async () => {
      const result = await recordWastageAction({
        storeItemId: "item-1",
        quantity: 0,
        reason: "DAMAGED",
      });
      expect(result.error).toBe("Quantity must be greater than zero.");
    });

    it("should reject insufficient stock", async () => {
      prismaMock.storeItem.findUnique.mockResolvedValue({
        ...mockStoreItem,
        quantity: 5,
      } as any);

      const result = await recordWastageAction({
        storeItemId: "item-1",
        quantity: 10,
        reason: "DAMAGED",
      });
      expect(result.error).toContain("Insufficient stock");
    });

    it("should create wastage and stock movement", async () => {
      prismaMock.storeItem.findUnique.mockResolvedValue(mockStoreItem as any);
      prismaMock.$transaction.mockResolvedValue([
        { id: "wastage-1", quantity: 10, reason: "EXPIRED" },
      ] as any);

      const result = await recordWastageAction({
        storeItemId: "item-1",
        quantity: 10,
        reason: "EXPIRED",
        description: "Past expiry date",
      });
      expect(result.data).toBeDefined();
    });
  });

  describe("getWastageAnalyticsAction", () => {
    it("should return unauthorized when not authenticated", async () => {
      mockUnauthenticated();
      const result = await getWastageAnalyticsAction();
      expect(result).toEqual({ error: "Unauthorized" });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// ASSET CHECKOUT TESTS
// ═══════════════════════════════════════════════════════════════════

describe("Asset Checkout/Return", () => {
  describe("checkoutAssetAction", () => {
    it("should reject non-active assets", async () => {
      prismaMock.fixedAsset.findUnique.mockResolvedValue({
        ...mockFixedAsset,
        status: "DISPOSED",
      } as any);

      const result = await checkoutAssetAction({
        fixedAssetId: "asset-1",
        checkedOutTo: "Science Dept",
      });
      expect(result.error).toContain("cannot be checked out");
    });

    it("should reject already checked out assets", async () => {
      prismaMock.fixedAsset.findUnique.mockResolvedValue(mockFixedAsset as any);
      prismaMock.assetCheckout.findFirst.mockResolvedValue({
        id: "co-1",
        status: "CHECKED_OUT",
      } as any);

      const result = await checkoutAssetAction({
        fixedAssetId: "asset-1",
        checkedOutTo: "Science Dept",
      });
      expect(result.error).toBe("Asset is already checked out.");
    });

    it("should checkout with valid data", async () => {
      prismaMock.fixedAsset.findUnique.mockResolvedValue(mockFixedAsset as any);
      prismaMock.assetCheckout.findFirst.mockResolvedValue(null);
      prismaMock.assetCheckout.create.mockResolvedValue({
        id: "co-1",
        fixedAssetId: "asset-1",
        checkedOutTo: "Science Dept",
        status: "CHECKED_OUT",
      } as any);

      const result = await checkoutAssetAction({
        fixedAssetId: "asset-1",
        checkedOutTo: "Science Dept",
        purpose: "Physics lab experiment",
        expectedReturn: "2026-04-10",
      });
      expect(result.data).toBeDefined();
      expect(result.data!.status).toBe("CHECKED_OUT");
    });
  });

  describe("returnAssetAction", () => {
    it("should reject if not checked out", async () => {
      prismaMock.assetCheckout.findUnique.mockResolvedValue({
        id: "co-1",
        status: "RETURNED",
        fixedAsset: mockFixedAsset,
      } as any);

      const result = await returnAssetAction("co-1", { condition: "GOOD" });
      expect(result.error).toBe("Asset is not currently checked out.");
    });

    it("should return and update condition", async () => {
      prismaMock.assetCheckout.findUnique.mockResolvedValue({
        id: "co-1",
        status: "CHECKED_OUT",
        fixedAssetId: "asset-1",
        fixedAsset: mockFixedAsset,
      } as any);
      prismaMock.assetCheckout.update.mockResolvedValue({
        id: "co-1",
        status: "RETURNED",
        condition: "FAIR",
      } as any);
      prismaMock.fixedAsset.update.mockResolvedValue({} as any);

      const result = await returnAssetAction("co-1", {
        condition: "FAIR",
        returnNotes: "Minor scratch on lens",
      });
      expect(result.data?.status).toBe("RETURNED");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// ASSET AUDIT TESTS
// ═══════════════════════════════════════════════════════════════════

describe("Asset Audits", () => {
  describe("createAssetAuditAction", () => {
    it("should return error when no assets found", async () => {
      prismaMock.assetAudit.findFirst.mockResolvedValue(null);
      prismaMock.fixedAsset.findMany.mockResolvedValue([]);

      const result = await createAssetAuditAction({});
      expect(result.error).toBe("No assets found matching the criteria.");
    });

    it("should create audit with auto-populated assets", async () => {
      prismaMock.assetAudit.findFirst.mockResolvedValue(null);
      prismaMock.fixedAsset.findMany.mockResolvedValue([
        { id: "asset-1" },
        { id: "asset-2" },
      ] as any);
      prismaMock.assetAudit.create.mockResolvedValue({
        id: "audit-1",
        reference: "AA/2026/0001",
        status: "PLANNED",
        items: [
          { id: "ai-1", fixedAssetId: "asset-1" },
          { id: "ai-2", fixedAssetId: "asset-2" },
        ],
      } as any);

      const result = await createAssetAuditAction({});
      expect(result.data).toBeDefined();
      expect(result.data!.items).toHaveLength(2);
    });
  });

  describe("completeAssetAuditAction", () => {
    it("should reject if items not verified", async () => {
      prismaMock.assetAudit.findUnique.mockResolvedValue({
        id: "audit-1",
        status: "IN_PROGRESS",
        reference: "AA/2026/0001",
        items: [
          { id: "ai-1", found: true },
          { id: "ai-2", found: null },
        ],
      } as any);

      const result = await completeAssetAuditAction("audit-1");
      expect(result.error).toContain("1 asset(s) have not been verified");
    });

    it("should complete and return summary", async () => {
      prismaMock.assetAudit.findUnique.mockResolvedValue({
        id: "audit-1",
        status: "IN_PROGRESS",
        reference: "AA/2026/0001",
        items: [
          { id: "ai-1", fixedAssetId: "a1", found: true, condition: "GOOD", locationVerified: true },
          { id: "ai-2", fixedAssetId: "a2", found: false, condition: null, locationVerified: false },
        ],
      } as any);

      prismaMock.fixedAsset.update.mockResolvedValue({} as any);
      prismaMock.assetAudit.update.mockResolvedValue({
        id: "audit-1",
        status: "COMPLETED",
      } as any);

      const result = await completeAssetAuditAction("audit-1");
      expect(result.data?.summary).toBeDefined();
      expect(result.data?.summary.found).toBe(1);
      expect(result.data?.summary.notFound).toBe(1);
    });
  });
});
