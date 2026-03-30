import { describe, it, expect, beforeEach } from "vitest";
import {
  prismaMock,
  mockAuthenticatedUser,
  mockUnauthenticated,
} from "../setup";

import {
  getItemsAction,
  getItemAction,
  createItemAction,
  updateItemAction,
  deleteItemAction,
  getLowStockAlertsAction,
} from "@/modules/inventory/actions/item.action";

import {
  getStoresAction,
  createStoreAction,
  updateStoreAction,
  deleteStoreAction,
  getCategoriesAction,
  createCategoryAction,
  deleteCategoryAction,
} from "@/modules/inventory/actions/store.action";

import {
  getSuppliersAction,
  createSupplierAction,
  updateSupplierAction,
  deleteSupplierAction,
} from "@/modules/inventory/actions/supplier.action";

import {
  recordStockInAction,
  recordStockOutAction,
  adjustStockAction,
  getStockMovementsAction,
} from "@/modules/inventory/actions/stock.action";

import {
  getPurchaseRequestsAction,
  createPurchaseRequestAction,
  approvePurchaseRequestAction,
  rejectPurchaseRequestAction,
  getPurchaseOrdersAction,
  createPurchaseOrderAction,
  updatePurchaseOrderStatusAction,
  receiveGoodsAction,
} from "@/modules/inventory/actions/procurement.action";

import {
  getStockLevelReportAction,
  getStockMovementReportAction,
  getStockValuationAction,
} from "@/modules/inventory/actions/inventory-report.action";

// ─── Items ─────────────────────────────────────────────────────────

describe("getItemsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getItemsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return paginated items", async () => {
    prismaMock.storeItem.findMany.mockResolvedValue([
      {
        id: "item-1",
        storeId: "store-1",
        categoryId: null,
        name: "Chalk",
        code: "CHK-001",
        unit: "box",
        quantity: 50,
        reorderLevel: 10,
        unitPrice: 5,
        description: null,
        status: "ACTIVE",
        createdAt: new Date(),
        store: { id: "store-1", name: "Main Store" },
        category: null,
      },
    ] as never);
    prismaMock.storeItem.count.mockResolvedValue(1 as never);

    const result = await getItemsAction();
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total", 1);
  });
});

describe("getItemAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getItemAction("item-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if item not found", async () => {
    prismaMock.storeItem.findUnique.mockResolvedValue(null);
    const result = await getItemAction("nonexistent");
    expect(result).toEqual({ error: "Item not found." });
  });

  it("should return item with movements", async () => {
    prismaMock.storeItem.findUnique.mockResolvedValue({
      id: "item-1",
      storeId: "store-1",
      name: "Chalk",
      code: "CHK-001",
      unit: "box",
      quantity: 50,
      reorderLevel: 10,
      unitPrice: 5,
      description: null,
      status: "ACTIVE",
      categoryId: null,
      store: { id: "store-1", name: "Main Store" },
      category: null,
      movements: [
        {
          id: "mv-1",
          type: "IN",
          quantity: 50,
          previousQuantity: 0,
          newQuantity: 50,
          reason: "Initial stock",
          referenceType: null,
          referenceId: null,
          issuedTo: null,
          conductedBy: "user-1",
          conductedAt: new Date(),
        },
      ],
    } as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "user-1", firstName: "Admin", lastName: "User" },
    ] as never);

    const result = await getItemAction("item-1");
    expect(result).toHaveProperty("data");
    expect((result as { data: { movements: unknown[] } }).data.movements).toHaveLength(1);
  });
});

describe("createItemAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createItemAction({ storeId: "store-1", name: "Chalk" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject duplicate item name in same store", async () => {
    prismaMock.storeItem.findUnique.mockResolvedValue({ id: "item-1" } as never);
    const result = await createItemAction({ storeId: "store-1", name: "Chalk" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("already exists");
  });

  it("should create item successfully", async () => {
    prismaMock.storeItem.findUnique.mockResolvedValue(null);
    prismaMock.storeItem.create.mockResolvedValue({
      id: "item-1",
      name: "Chalk",
      storeId: "store-1",
    } as never);

    const result = await createItemAction({ storeId: "store-1", name: "Chalk" });
    expect(result).toHaveProperty("data");
  });
});

describe("updateItemAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updateItemAction("item-1", { name: "Updated" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if item not found", async () => {
    prismaMock.storeItem.findUnique.mockResolvedValue(null);
    const result = await updateItemAction("nonexistent", { name: "Updated" });
    expect(result).toEqual({ error: "Item not found." });
  });

  it("should reject duplicate name when renaming", async () => {
    prismaMock.storeItem.findUnique
      .mockResolvedValueOnce({
        id: "item-1",
        name: "Chalk",
        storeId: "store-1",
      } as never)
      .mockResolvedValueOnce({ id: "item-2", name: "Marker" } as never);

    const result = await updateItemAction("item-1", { name: "Marker" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("already exists");
  });

  it("should update item successfully", async () => {
    prismaMock.storeItem.findUnique.mockResolvedValue({
      id: "item-1",
      name: "Chalk",
      storeId: "store-1",
      categoryId: null,
      code: null,
      unit: "box",
      reorderLevel: 10,
      unitPrice: 5,
      description: null,
      status: "ACTIVE",
    } as never);
    prismaMock.storeItem.update.mockResolvedValue({
      id: "item-1",
      name: "Chalk",
      unitPrice: 10,
    } as never);

    const result = await updateItemAction("item-1", { unitPrice: 10 });
    expect(result).toHaveProperty("data");
  });
});

describe("deleteItemAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deleteItemAction("item-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if item not found", async () => {
    prismaMock.storeItem.findUnique.mockResolvedValue(null);
    const result = await deleteItemAction("nonexistent");
    expect(result).toEqual({ error: "Item not found." });
  });

  it("should reject deletion if item has movement history", async () => {
    prismaMock.storeItem.findUnique.mockResolvedValue({
      id: "item-1",
      name: "Chalk",
      _count: { movements: 5 },
    } as never);

    const result = await deleteItemAction("item-1");
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Cannot delete");
  });

  it("should delete item with no movements", async () => {
    prismaMock.storeItem.findUnique.mockResolvedValue({
      id: "item-1",
      name: "Chalk",
      _count: { movements: 0 },
    } as never);
    prismaMock.storeItem.delete.mockResolvedValue({ id: "item-1" } as never);

    const result = await deleteItemAction("item-1");
    expect(result).toEqual({ success: true });
  });
});

describe("getLowStockAlertsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getLowStockAlertsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return stores with low stock items", async () => {
    prismaMock.store.findMany.mockResolvedValue([
      {
        id: "store-1",
        name: "Main Store",
        items: [
          { id: "item-1", name: "Chalk", code: null, quantity: 5, reorderLevel: 10, unit: "box", unitPrice: 5, category: null },
          { id: "item-2", name: "Marker", code: null, quantity: 50, reorderLevel: 10, unit: "pcs", unitPrice: 2, category: null },
        ],
      },
    ] as never);

    const result = await getLowStockAlertsAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: { items: unknown[] }[] }).data;
    expect(data).toHaveLength(1);
    expect(data[0].items).toHaveLength(1);
  });
});

// ─── Stores ────────────────────────────────────────────────────────

describe("getStoresAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getStoresAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return stores with item counts and values", async () => {
    prismaMock.store.findMany.mockResolvedValue([
      {
        id: "store-1",
        name: "Main Store",
        description: null,
        managerId: null,
        status: "ACTIVE",
        createdAt: new Date(),
        items: [
          { id: "item-1", quantity: 10, unitPrice: 5, reorderLevel: 5 },
        ],
      },
    ] as never);

    const result = await getStoresAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: { itemCount: number }[] }).data;
    expect(data[0].itemCount).toBe(1);
  });
});

describe("createStoreAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createStoreAction({ name: "Main Store" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject duplicate store name", async () => {
    prismaMock.store.findUnique.mockResolvedValue({ id: "store-1" } as never);
    const result = await createStoreAction({ name: "Main Store" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("already exists");
  });

  it("should create store successfully", async () => {
    prismaMock.store.findUnique.mockResolvedValue(null);
    prismaMock.store.create.mockResolvedValue({
      id: "store-1",
      name: "Main Store",
    } as never);

    const result = await createStoreAction({ name: "Main Store" });
    expect(result).toHaveProperty("data");
  });
});

describe("deleteStoreAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await deleteStoreAction("store-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if store not found", async () => {
    prismaMock.store.findUnique.mockResolvedValue(null);
    const result = await deleteStoreAction("nonexistent");
    expect(result).toEqual({ error: "Store not found." });
  });

  it("should reject deletion if store has active items", async () => {
    prismaMock.store.findUnique.mockResolvedValue({
      id: "store-1",
      name: "Main Store",
      items: [{ id: "item-1" }],
    } as never);

    const result = await deleteStoreAction("store-1");
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Cannot delete");
  });

  it("should delete store with no items", async () => {
    prismaMock.store.findUnique.mockResolvedValue({
      id: "store-1",
      name: "Main Store",
      items: [],
    } as never);
    prismaMock.store.delete.mockResolvedValue({ id: "store-1" } as never);

    const result = await deleteStoreAction("store-1");
    expect(result).toEqual({ success: true });
  });
});

describe("createCategoryAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createCategoryAction({ name: "Stationery" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject duplicate category name", async () => {
    prismaMock.itemCategory.findUnique.mockResolvedValue({ id: "cat-1" } as never);
    const result = await createCategoryAction({ name: "Stationery" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("already exists");
  });

  it("should create category successfully", async () => {
    prismaMock.itemCategory.findUnique.mockResolvedValue(null);
    prismaMock.itemCategory.create.mockResolvedValue({
      id: "cat-1",
      name: "Stationery",
    } as never);

    const result = await createCategoryAction({ name: "Stationery" });
    expect(result).toHaveProperty("data");
  });
});

describe("deleteCategoryAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject deletion if category has items", async () => {
    prismaMock.itemCategory.findUnique.mockResolvedValue({
      id: "cat-1",
      name: "Stationery",
      _count: { items: 3 },
    } as never);

    const result = await deleteCategoryAction("cat-1");
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Cannot delete");
  });

  it("should delete category with no items", async () => {
    prismaMock.itemCategory.findUnique.mockResolvedValue({
      id: "cat-1",
      name: "Stationery",
      _count: { items: 0 },
    } as never);
    prismaMock.itemCategory.delete.mockResolvedValue({ id: "cat-1" } as never);

    const result = await deleteCategoryAction("cat-1");
    expect(result).toEqual({ success: true });
  });
});

// ─── Suppliers ─────────────────────────────────────────────────────

describe("getSuppliersAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getSuppliersAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return suppliers", async () => {
    prismaMock.supplier.findMany.mockResolvedValue([
      {
        id: "sup-1",
        name: "ABC Supplies",
        contactPerson: "John",
        phone: "0200000000",
        email: null,
        address: null,
        status: "ACTIVE",
        createdAt: new Date(),
        _count: { purchaseOrders: 2 },
      },
    ] as never);

    const result = await getSuppliersAction();
    expect(result).toHaveProperty("data");
    expect((result as { data: unknown[] }).data).toHaveLength(1);
  });
});

describe("createSupplierAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createSupplierAction({ name: "ABC Supplies" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject duplicate supplier name", async () => {
    prismaMock.supplier.findUnique.mockResolvedValue({ id: "sup-1" } as never);
    const result = await createSupplierAction({ name: "ABC Supplies" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("already exists");
  });

  it("should create supplier successfully", async () => {
    prismaMock.supplier.findUnique.mockResolvedValue(null);
    prismaMock.supplier.create.mockResolvedValue({
      id: "sup-1",
      name: "ABC Supplies",
    } as never);

    const result = await createSupplierAction({ name: "ABC Supplies" });
    expect(result).toHaveProperty("data");
  });
});

describe("deleteSupplierAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject deletion if supplier has purchase orders", async () => {
    prismaMock.supplier.findUnique.mockResolvedValue({
      id: "sup-1",
      name: "ABC Supplies",
      _count: { purchaseOrders: 2 },
    } as never);

    const result = await deleteSupplierAction("sup-1");
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Cannot delete");
  });

  it("should delete supplier with no orders", async () => {
    prismaMock.supplier.findUnique.mockResolvedValue({
      id: "sup-1",
      name: "ABC Supplies",
      _count: { purchaseOrders: 0 },
    } as never);
    prismaMock.supplier.delete.mockResolvedValue({ id: "sup-1" } as never);

    const result = await deleteSupplierAction("sup-1");
    expect(result).toEqual({ success: true });
  });
});

// ─── Stock Movements ───────────────────────────────────────────────

describe("recordStockInAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await recordStockInAction({ storeItemId: "item-1", quantity: 10 });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject zero or negative quantity", async () => {
    const result = await recordStockInAction({ storeItemId: "item-1", quantity: 0 });
    expect(result).toEqual({ error: "Quantity must be greater than zero." });
  });

  it("should return error if item not found", async () => {
    prismaMock.storeItem.findUnique.mockResolvedValue(null);
    const result = await recordStockInAction({ storeItemId: "nonexistent", quantity: 10 });
    expect(result).toEqual({ error: "Item not found." });
  });

  it("should record stock in and update quantity", async () => {
    prismaMock.storeItem.findUnique.mockResolvedValue({
      id: "item-1",
      name: "Chalk",
      quantity: 50,
    } as never);

    const mockMovement = {
      id: "mv-1",
      type: "IN",
      quantity: 10,
      previousQuantity: 50,
      newQuantity: 60,
    };

    prismaMock.$transaction.mockResolvedValue([mockMovement] as never);

    const result = await recordStockInAction({ storeItemId: "item-1", quantity: 10 });
    expect(result).toHaveProperty("data");
  });
});

describe("recordStockOutAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await recordStockOutAction({ storeItemId: "item-1", quantity: 5 });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject zero or negative quantity", async () => {
    const result = await recordStockOutAction({ storeItemId: "item-1", quantity: -1 });
    expect(result).toEqual({ error: "Quantity must be greater than zero." });
  });

  it("should return error if item not found", async () => {
    prismaMock.storeItem.findUnique.mockResolvedValue(null);
    const result = await recordStockOutAction({ storeItemId: "nonexistent", quantity: 5 });
    expect(result).toEqual({ error: "Item not found." });
  });

  it("should reject if insufficient stock", async () => {
    prismaMock.storeItem.findUnique.mockResolvedValue({
      id: "item-1",
      name: "Chalk",
      quantity: 3,
      unit: "box",
    } as never);

    const result = await recordStockOutAction({ storeItemId: "item-1", quantity: 10 });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain("Insufficient stock");
  });

  it("should record stock out successfully", async () => {
    prismaMock.storeItem.findUnique.mockResolvedValue({
      id: "item-1",
      name: "Chalk",
      quantity: 50,
      unit: "box",
    } as never);

    prismaMock.$transaction.mockResolvedValue([{
      id: "mv-1",
      type: "OUT",
      quantity: 5,
      previousQuantity: 50,
      newQuantity: 45,
    }] as never);

    const result = await recordStockOutAction({ storeItemId: "item-1", quantity: 5 });
    expect(result).toHaveProperty("data");
  });
});

describe("adjustStockAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await adjustStockAction({ storeItemId: "item-1", newQuantity: 100, reason: "Recount" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject negative quantity", async () => {
    const result = await adjustStockAction({ storeItemId: "item-1", newQuantity: -5, reason: "Recount" });
    expect(result).toEqual({ error: "Quantity cannot be negative." });
  });

  it("should reject empty reason", async () => {
    const result = await adjustStockAction({ storeItemId: "item-1", newQuantity: 100, reason: "   " });
    expect(result).toEqual({ error: "A reason is required for stock adjustments." });
  });

  it("should return error if item not found", async () => {
    prismaMock.storeItem.findUnique.mockResolvedValue(null);
    const result = await adjustStockAction({ storeItemId: "nonexistent", newQuantity: 100, reason: "Recount" });
    expect(result).toEqual({ error: "Item not found." });
  });

  it("should adjust stock successfully", async () => {
    prismaMock.storeItem.findUnique.mockResolvedValue({
      id: "item-1",
      name: "Chalk",
      quantity: 50,
    } as never);

    prismaMock.$transaction.mockResolvedValue([{
      id: "mv-1",
      type: "ADJUSTMENT",
      quantity: 50,
      previousQuantity: 50,
      newQuantity: 100,
    }] as never);

    const result = await adjustStockAction({ storeItemId: "item-1", newQuantity: 100, reason: "Recount" });
    expect(result).toHaveProperty("data");
  });
});

describe("getStockMovementsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getStockMovementsAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return paginated stock movements", async () => {
    prismaMock.stockMovement.findMany.mockResolvedValue([] as never);
    prismaMock.stockMovement.count.mockResolvedValue(0 as never);

    const result = await getStockMovementsAction();
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total", 0);
  });
});

// ─── Procurement ───────────────────────────────────────────────────

describe("createPurchaseRequestAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createPurchaseRequestAction({
      storeId: "store-1",
      items: [{ storeItemId: "item-1", quantityRequested: 100 }],
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no items provided", async () => {
    const result = await createPurchaseRequestAction({
      storeId: "store-1",
      items: [],
    });
    expect(result).toEqual({ error: "At least one item is required." });
  });

  it("should create purchase request successfully", async () => {
    prismaMock.purchaseRequest.create.mockResolvedValue({
      id: "pr-1",
      storeId: "store-1",
      status: "PENDING",
      items: [{ storeItemId: "item-1", quantityRequested: 100 }],
    } as never);

    const result = await createPurchaseRequestAction({
      storeId: "store-1",
      items: [{ storeItemId: "item-1", quantityRequested: 100 }],
    });

    expect(result).toHaveProperty("data");
  });
});

describe("approvePurchaseRequestAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await approvePurchaseRequestAction("pr-1");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if not found", async () => {
    prismaMock.purchaseRequest.findUnique.mockResolvedValue(null);
    const result = await approvePurchaseRequestAction("nonexistent");
    expect(result).toEqual({ error: "Purchase request not found." });
  });

  it("should reject non-pending requests", async () => {
    prismaMock.purchaseRequest.findUnique.mockResolvedValue({
      id: "pr-1",
      status: "APPROVED",
    } as never);

    const result = await approvePurchaseRequestAction("pr-1");
    expect(result).toEqual({ error: "Only pending requests can be approved." });
  });

  it("should approve purchase request successfully", async () => {
    prismaMock.purchaseRequest.findUnique.mockResolvedValue({
      id: "pr-1",
      status: "PENDING",
    } as never);
    prismaMock.purchaseRequest.update.mockResolvedValue({
      id: "pr-1",
      status: "APPROVED",
    } as never);

    const result = await approvePurchaseRequestAction("pr-1");
    expect(result).toHaveProperty("data");
    expect((result as { data: { status: string } }).data.status).toBe("APPROVED");
  });
});

describe("rejectPurchaseRequestAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject non-pending requests", async () => {
    prismaMock.purchaseRequest.findUnique.mockResolvedValue({
      id: "pr-1",
      status: "APPROVED",
    } as never);

    const result = await rejectPurchaseRequestAction("pr-1");
    expect(result).toEqual({ error: "Only pending requests can be rejected." });
  });

  it("should reject purchase request successfully", async () => {
    prismaMock.purchaseRequest.findUnique.mockResolvedValue({
      id: "pr-1",
      status: "PENDING",
    } as never);
    prismaMock.purchaseRequest.update.mockResolvedValue({
      id: "pr-1",
      status: "REJECTED",
    } as never);

    const result = await rejectPurchaseRequestAction("pr-1");
    expect(result).toHaveProperty("data");
    expect((result as { data: { status: string } }).data.status).toBe("REJECTED");
  });
});

describe("createPurchaseOrderAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await createPurchaseOrderAction({
      supplierId: "sup-1",
      items: [{ storeItemId: "item-1", quantity: 100, unitPrice: 5 }],
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should reject if no items provided", async () => {
    const result = await createPurchaseOrderAction({
      supplierId: "sup-1",
      items: [],
    });
    expect(result).toEqual({ error: "At least one item is required." });
  });

  it("should create purchase order with auto-generated number", async () => {
    prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);
    prismaMock.purchaseOrder.create.mockResolvedValue({
      id: "po-1",
      orderNumber: "PO/2025/0001",
      totalAmount: 500,
      items: [],
    } as never);

    const result = await createPurchaseOrderAction({
      supplierId: "sup-1",
      items: [{ storeItemId: "item-1", quantity: 100, unitPrice: 5 }],
    });

    expect(result).toHaveProperty("data");
  });
});

describe("updatePurchaseOrderStatusAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await updatePurchaseOrderStatusAction("po-1", "SENT");
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if order not found", async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue(null);
    const result = await updatePurchaseOrderStatusAction("nonexistent", "SENT");
    expect(result).toEqual({ error: "Purchase order not found." });
  });

  it("should update status successfully", async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-1",
      orderNumber: "PO/2025/0001",
      status: "DRAFT",
    } as never);
    prismaMock.purchaseOrder.update.mockResolvedValue({
      id: "po-1",
      status: "SENT",
    } as never);

    const result = await updatePurchaseOrderStatusAction("po-1", "SENT");
    expect(result).toHaveProperty("data");
  });
});

describe("receiveGoodsAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await receiveGoodsAction({
      purchaseOrderId: "po-1",
      items: [{ storeItemId: "item-1", quantityReceived: 50 }],
    });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return error if order not found", async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue(null);
    const result = await receiveGoodsAction({
      purchaseOrderId: "nonexistent",
      items: [{ storeItemId: "item-1", quantityReceived: 50 }],
    });
    expect(result).toEqual({ error: "Purchase order not found." });
  });

  it("should reject receiving goods for cancelled order", async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-1",
      status: "CANCELLED",
      items: [],
    } as never);

    const result = await receiveGoodsAction({
      purchaseOrderId: "po-1",
      items: [{ storeItemId: "item-1", quantityReceived: 50 }],
    });
    expect(result).toEqual({ error: "Cannot receive goods for a cancelled order." });
  });
});

// ─── Inventory Reports ─────────────────────────────────────────────

describe("getStockLevelReportAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getStockLevelReportAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return stock levels with status indicators", async () => {
    prismaMock.storeItem.findMany.mockResolvedValue([
      {
        id: "item-1",
        name: "Chalk",
        code: "CHK-001",
        unit: "box",
        quantity: 0,
        reorderLevel: 10,
        unitPrice: 5,
        status: "ACTIVE",
        store: { id: "store-1", name: "Main Store" },
        category: { id: "cat-1", name: "Stationery" },
      },
      {
        id: "item-2",
        name: "Marker",
        code: "MRK-001",
        unit: "pcs",
        quantity: 5,
        reorderLevel: 10,
        unitPrice: 2,
        status: "ACTIVE",
        store: { id: "store-1", name: "Main Store" },
        category: { id: "cat-1", name: "Stationery" },
      },
      {
        id: "item-3",
        name: "Paper",
        code: "PPR-001",
        unit: "ream",
        quantity: 50,
        reorderLevel: 10,
        unitPrice: 15,
        status: "ACTIVE",
        store: { id: "store-1", name: "Main Store" },
        category: null,
      },
    ] as never);

    const result = await getStockLevelReportAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: { status: string }[] }).data;
    expect(data[0].status).toBe("OUT_OF_STOCK");
    expect(data[1].status).toBe("LOW_STOCK");
    expect(data[2].status).toBe("IN_STOCK");
  });
});

describe("getStockMovementReportAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getStockMovementReportAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return aggregated movement data", async () => {
    prismaMock.stockMovement.findMany.mockResolvedValue([
      {
        storeItemId: "item-1",
        type: "IN",
        quantity: 100,
        storeItem: {
          id: "item-1",
          name: "Chalk",
          unit: "box",
          category: { name: "Stationery" },
          store: { name: "Main Store" },
        },
      },
      {
        storeItemId: "item-1",
        type: "OUT",
        quantity: 30,
        storeItem: {
          id: "item-1",
          name: "Chalk",
          unit: "box",
          category: { name: "Stationery" },
          store: { name: "Main Store" },
        },
      },
    ] as never);

    const result = await getStockMovementReportAction();
    expect(result).toHaveProperty("data");
    const data = (result as { data: { totalIn: number; totalOut: number }[] }).data;
    expect(data).toHaveLength(1);
    expect(data[0].totalIn).toBe(100);
    expect(data[0].totalOut).toBe(30);
  });
});

describe("getStockValuationAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("should reject unauthenticated users", async () => {
    mockUnauthenticated();
    const result = await getStockValuationAction();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("should return store valuations with grand total", async () => {
    prismaMock.store.findMany.mockResolvedValue([
      {
        id: "store-1",
        name: "Main Store",
        items: [
          { quantity: 10, unitPrice: 5 },
          { quantity: 20, unitPrice: 10 },
        ],
      },
    ] as never);

    const result = await getStockValuationAction();
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("grandTotal", 250);
  });
});
