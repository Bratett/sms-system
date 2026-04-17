import { z } from "zod";

export const supplierInvoiceItemSchema = z.object({
  storeItemId: z.string().optional().nullable(),
  purchaseOrderItemId: z.string().optional().nullable(),
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  lineTotal: z.coerce.number().nonnegative(),
  taxRate: z.coerce.number().min(0).max(100).optional().nullable(),
});
export type SupplierInvoiceItemInput = z.infer<typeof supplierInvoiceItemSchema>;

export const createSupplierInvoiceSchema = z.object({
  supplierId: z.string().min(1),
  purchaseOrderId: z.string().optional().nullable(),
  invoiceNumber: z.string().min(1).max(120),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date().optional().nullable(),
  subTotal: z.coerce.number().nonnegative(),
  taxAmount: z.coerce.number().nonnegative().default(0),
  totalAmount: z.coerce.number().positive(),
  currency: z.string().default("GHS"),
  notes: z.string().optional().nullable(),
  documentUrl: z.string().url().optional().nullable(),
  items: z.array(supplierInvoiceItemSchema).min(1),
});
export type CreateSupplierInvoiceInput = z.infer<typeof createSupplierInvoiceSchema>;

export const updateMatchToleranceSchema = z.object({
  priceTolerancePercent: z.coerce.number().min(0).max(100),
  priceToleranceAbsolute: z.coerce.number().min(0),
  quantityTolerancePercent: z.coerce.number().min(0).max(100),
  autoApproveClean: z.coerce.boolean().default(false),
  requireGoodsReceived: z.coerce.boolean().default(true),
});
export type UpdateMatchToleranceInput = z.infer<typeof updateMatchToleranceSchema>;

export const approveInvoiceSchema = z.object({
  invoiceId: z.string().min(1),
  notes: z.string().optional().nullable(),
  override: z.coerce.boolean().default(false),
});
export type ApproveInvoiceInput = z.infer<typeof approveInvoiceSchema>;
