import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../setup";
import { runThreeWayMatch } from "@/lib/inventory/three-way-match";
import {
  createSupplierInvoiceAction,
  updateMatchToleranceAction,
  approveSupplierInvoiceAction,
} from "@/modules/inventory/actions/supplier-invoice.action";

describe("Three-way match engine", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("returns FAILED when invoice has no PO", async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: "inv-1",
      purchaseOrderId: null,
      items: [],
    } as never);
    const outcome = await runThreeWayMatch({ schoolId: "default-school", supplierInvoiceId: "inv-1" });
    expect(outcome.result).toBe("FAILED");
  });

  it("returns MISSING_GRN when no GRN and requireGoodsReceived=true", async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: "inv-1",
      purchaseOrderId: "po-1",
      items: [],
    } as never);
    prismaMock.matchToleranceSetting.findUnique.mockResolvedValue({
      requireGoodsReceived: true,
      priceTolerancePercent: 0,
      priceToleranceAbsolute: 0,
      quantityTolerancePercent: 0,
    } as never);
    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-1",
      items: [],
      goodsReceived: [],
    } as never);
    const outcome = await runThreeWayMatch({ schoolId: "default-school", supplierInvoiceId: "inv-1" });
    expect(outcome.result).toBe("MISSING_GRN");
  });

  it("returns CLEAN when everything agrees", async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: "inv-1",
      purchaseOrderId: "po-1",
      items: [
        {
          id: "ili-1",
          purchaseOrderItemId: "poi-1",
          storeItemId: "si-1",
          description: "Chalk",
          quantity: 10,
          unitPrice: 5,
        },
      ],
    } as never);
    prismaMock.matchToleranceSetting.findUnique.mockResolvedValue({
      requireGoodsReceived: true,
      priceTolerancePercent: 0,
      priceToleranceAbsolute: 0,
      quantityTolerancePercent: 0,
    } as never);
    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-1",
      items: [{ id: "poi-1", storeItemId: "si-1", quantity: 10, unitPrice: 5 }],
      goodsReceived: [
        { id: "grn-1", items: [{ storeItemId: "si-1", quantityReceived: 10 }] },
      ],
    } as never);
    const outcome = await runThreeWayMatch({ schoolId: "default-school", supplierInvoiceId: "inv-1" });
    expect(outcome.result).toBe("CLEAN");
    expect(outcome.priceVariance).toBe(0);
  });

  it("flags PRICE_VARIANCE when invoice price exceeds PO outside tolerance", async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: "inv-1",
      purchaseOrderId: "po-1",
      items: [
        {
          id: "ili-1",
          purchaseOrderItemId: "poi-1",
          storeItemId: "si-1",
          description: "Chalk",
          quantity: 10,
          unitPrice: 6,
        },
      ],
    } as never);
    prismaMock.matchToleranceSetting.findUnique.mockResolvedValue({
      requireGoodsReceived: true,
      priceTolerancePercent: 0,
      priceToleranceAbsolute: 0,
      quantityTolerancePercent: 0,
    } as never);
    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-1",
      items: [{ id: "poi-1", storeItemId: "si-1", quantity: 10, unitPrice: 5 }],
      goodsReceived: [
        { id: "grn-1", items: [{ storeItemId: "si-1", quantityReceived: 10 }] },
      ],
    } as never);
    const outcome = await runThreeWayMatch({ schoolId: "default-school", supplierInvoiceId: "inv-1" });
    expect(outcome.result).toBe("PRICE_VARIANCE");
    expect(outcome.priceVariance).toBe(10); // (6-5)*10
  });

  it("flags PO_MISMATCH for unexpected invoiced items", async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: "inv-1",
      purchaseOrderId: "po-1",
      items: [
        {
          id: "ili-1",
          purchaseOrderItemId: null,
          storeItemId: "si-x",
          description: "Rogue item",
          quantity: 1,
          unitPrice: 100,
        },
      ],
    } as never);
    prismaMock.matchToleranceSetting.findUnique.mockResolvedValue({
      requireGoodsReceived: true,
      priceTolerancePercent: 0,
      priceToleranceAbsolute: 0,
      quantityTolerancePercent: 0,
    } as never);
    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      id: "po-1",
      items: [{ id: "poi-1", storeItemId: "si-1", quantity: 1, unitPrice: 100 }],
      goodsReceived: [
        { id: "grn-1", items: [{ storeItemId: "si-1", quantityReceived: 1 }] },
      ],
    } as never);
    const outcome = await runThreeWayMatch({ schoolId: "default-school", supplierInvoiceId: "inv-1" });
    expect(outcome.result).toBe("PO_MISMATCH");
  });
});

describe("Supplier invoice actions", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects mismatched totals", async () => {
    const res = await createSupplierInvoiceAction({
      supplierId: "sup-1",
      invoiceNumber: "INV-001",
      invoiceDate: new Date(),
      subTotal: 100,
      taxAmount: 15,
      totalAmount: 200, // wrong
      items: [
        { description: "X", quantity: 1, unitPrice: 100, lineTotal: 100 },
      ],
    });
    expect("error" in res && res.error).toMatch(/does not match/);
  });

  it("updates tolerance settings", async () => {
    prismaMock.matchToleranceSetting.upsert.mockResolvedValue({
      id: "mts-1",
      schoolId: "default-school",
      priceTolerancePercent: 2,
      priceToleranceAbsolute: 5,
      quantityTolerancePercent: 1,
      autoApproveClean: false,
      requireGoodsReceived: true,
    } as never);
    const res = await updateMatchToleranceAction({
      priceTolerancePercent: 2,
      priceToleranceAbsolute: 5,
      quantityTolerancePercent: 1,
      autoApproveClean: false,
      requireGoodsReceived: true,
    });
    expect("data" in res).toBe(true);
  });

  it("blocks approval when match shows variance without override", async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: "inv-1",
      schoolId: "default-school",
      status: "VARIANCE",
      invoiceNumber: "INV-001",
      matches: [{ id: "m-1", result: "PRICE_VARIANCE" }],
      notes: null,
    } as never);
    const res = await approveSupplierInvoiceAction({ invoiceId: "inv-1", override: false });
    expect("error" in res && res.error).toMatch(/override/);
  });

  it("allows approval with override+note", async () => {
    prismaMock.supplierInvoice.findFirst.mockResolvedValue({
      id: "inv-1",
      schoolId: "default-school",
      status: "VARIANCE",
      invoiceNumber: "INV-001",
      matches: [{ id: "m-1", result: "PRICE_VARIANCE" }],
      notes: null,
    } as never);
    prismaMock.supplierInvoice.update.mockResolvedValue({ id: "inv-1", status: "APPROVED" } as never);
    prismaMock.threeWayMatch.update.mockResolvedValue({ id: "m-1" } as never);
    const res = await approveSupplierInvoiceAction({
      invoiceId: "inv-1",
      override: true,
      notes: "Supplier raised prices mid-term; acceptable.",
    });
    expect("data" in res).toBe(true);
  });
});
