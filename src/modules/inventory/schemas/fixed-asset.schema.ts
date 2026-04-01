import { z } from "zod";

export const createAssetCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  code: z.string().optional(),
  defaultUsefulLife: z.coerce.number().int().min(1).optional(),
  defaultDepreciationMethod: z.enum(["STRAIGHT_LINE", "REDUCING_BALANCE", "NONE"]).optional(),
  accountId: z.string().optional(),
});
export type CreateAssetCategoryInput = z.infer<typeof createAssetCategorySchema>;

export const createFixedAssetSchema = z.object({
  name: z.string().min(1, "Asset name is required"),
  description: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
  location: z.string().optional(),
  departmentId: z.string().optional(),
  serialNumber: z.string().optional(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  purchaseDate: z.coerce.date().optional(),
  purchasePrice: z.coerce.number().min(0, "Purchase price must be 0 or greater"),
  usefulLifeYears: z.coerce.number().int().min(1).optional(),
  salvageValue: z.coerce.number().min(0).optional().default(0),
  depreciationMethod: z.enum(["STRAIGHT_LINE", "REDUCING_BALANCE", "NONE"]).optional().default("STRAIGHT_LINE"),
  condition: z.enum(["NEW", "GOOD", "FAIR", "POOR", "UNSERVICEABLE"]).optional().default("GOOD"),
});
export type CreateFixedAssetInput = z.infer<typeof createFixedAssetSchema>;

export const updateFixedAssetSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  condition: z.enum(["NEW", "GOOD", "FAIR", "POOR", "UNSERVICEABLE"]).optional(),
  status: z.enum(["ACTIVE", "UNDER_MAINTENANCE", "DISPOSED", "WRITTEN_OFF"]).optional(),
});
export type UpdateFixedAssetInput = z.infer<typeof updateFixedAssetSchema>;

export const disposeAssetSchema = z.object({
  assetId: z.string().min(1, "Asset is required"),
  disposalMethod: z.enum(["SOLD", "DONATED", "SCRAPPED", "WRITTEN_OFF"]),
  disposalAmount: z.coerce.number().min(0).optional().default(0),
});
export type DisposeAssetInput = z.infer<typeof disposeAssetSchema>;

export const recordMaintenanceSchema = z.object({
  fixedAssetId: z.string().min(1, "Asset is required"),
  date: z.coerce.date({ message: "Date is required" }),
  type: z.enum(["REPAIR", "SERVICE", "UPGRADE", "INSPECTION"]),
  description: z.string().min(1, "Description is required"),
  cost: z.coerce.number().min(0).optional(),
  performedBy: z.string().optional(),
  nextDueDate: z.coerce.date().optional(),
});
export type RecordMaintenanceInput = z.infer<typeof recordMaintenanceSchema>;
