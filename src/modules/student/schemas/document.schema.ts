import { z } from "zod";

// ─── DocumentType catalog ──────────────────────────────────────────

export const createDocumentTypeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isRequired: z.boolean().default(false),
  expiryMonths: z.number().int().positive().nullable().optional(),
  appliesTo: z.enum(["ALL", "BOARDING_ONLY", "DAY_ONLY"]).default("ALL"),
  sortOrder: z.number().int().default(0),
});

export const updateDocumentTypeSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isRequired: z.boolean().optional(),
  expiryMonths: z.number().int().positive().nullable().optional(),
  appliesTo: z.enum(["ALL", "BOARDING_ONLY", "DAY_ONLY"]).optional(),
  sortOrder: z.number().int().optional(),
});

// ─── StudentDocument ───────────────────────────────────────────────

export const recordUploadedStudentDocumentSchema = z.object({
  studentId: z.string().cuid(),
  documentTypeId: z.string().cuid(),
  title: z.string().min(1).max(200),
  fileKey: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().nonnegative(),
  contentType: z.string().min(1).max(100),
  notes: z.string().max(500).optional(),
});

export const updateStudentDocumentSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1).max(200).optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const rejectStudentDocumentSchema = z.object({
  id: z.string().cuid(),
  reason: z.string().min(5).max(500),
});
