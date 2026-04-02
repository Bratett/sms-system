import { z } from "zod";

export const createSupplierContractSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  contractNumber: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  terms: z.string().optional(),
  value: z.coerce.number().min(0).optional(),
  documentUrl: z.string().url().optional().or(z.literal("")),
});
export type CreateSupplierContractInput = z.infer<typeof createSupplierContractSchema>;

export const rateSupplierSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  purchaseOrderId: z.string().optional(),
  deliveryScore: z.coerce.number().int().min(1).max(5),
  qualityScore: z.coerce.number().int().min(1).max(5),
  pricingScore: z.coerce.number().int().min(1).max(5),
  comments: z.string().optional(),
});
export type RateSupplierInput = z.infer<typeof rateSupplierSchema>;

export const addExpiryTrackingSchema = z.object({
  storeItemId: z.string().min(1, "Item is required"),
  batchNumber: z.string().optional(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  expiryDate: z.string().min(1, "Expiry date is required"),
});
export type AddExpiryTrackingInput = z.infer<typeof addExpiryTrackingSchema>;

export const recordWastageSchema = z.object({
  storeItemId: z.string().min(1, "Item is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  reason: z.enum(["EXPIRED", "DAMAGED", "SPOILED", "OBSOLETE", "OTHER"]),
  description: z.string().optional(),
});
export type RecordWastageInput = z.infer<typeof recordWastageSchema>;

export const checkoutAssetSchema = z.object({
  fixedAssetId: z.string().min(1, "Asset is required"),
  checkedOutTo: z.string().min(1, "Recipient is required"),
  purpose: z.string().optional(),
  expectedReturn: z.string().optional(),
});
export type CheckoutAssetInput = z.infer<typeof checkoutAssetSchema>;

export const returnAssetSchema = z.object({
  condition: z.enum(["NEW", "GOOD", "FAIR", "POOR", "UNSERVICEABLE"]).optional(),
  returnNotes: z.string().optional(),
});
export type ReturnAssetInput = z.infer<typeof returnAssetSchema>;

export const addInsuranceSchema = z.object({
  fixedAssetId: z.string().min(1, "Asset is required"),
  provider: z.string().min(1, "Provider is required"),
  policyNumber: z.string().optional(),
  coverageAmount: z.coerce.number().min(0).optional(),
  premium: z.coerce.number().min(0).optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});
export type AddInsuranceInput = z.infer<typeof addInsuranceSchema>;

export const addWarrantySchema = z.object({
  fixedAssetId: z.string().min(1, "Asset is required"),
  provider: z.string().min(1, "Provider is required"),
  warrantyType: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  terms: z.string().optional(),
});
export type AddWarrantyInput = z.infer<typeof addWarrantySchema>;

export const createAssetAuditSchema = z.object({
  scheduledDate: z.string().optional(),
  notes: z.string().optional(),
  categoryId: z.string().optional(),
  locationFilter: z.string().optional(),
});
export type CreateAssetAuditInput = z.infer<typeof createAssetAuditSchema>;
