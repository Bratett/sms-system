import { z } from "zod";

export const dunningStageSchema = z.object({
  order: z.coerce.number().int().min(1),
  name: z.string().min(1),
  daysOverdue: z.coerce.number().int().min(0),
  channels: z.array(z.enum(["sms", "email", "in_app"])).min(1),
  templateKey: z.string().optional().nullable(),
  applyPenaltyId: z.string().optional().nullable(),
  escalateToRole: z.string().optional().nullable(),
  blockPortal: z.coerce.boolean().default(false),
});
export type DunningStageInput = z.infer<typeof dunningStageSchema>;

const dunningPolicyBaseObject = z.object({
  name: z.string().min(2).max(120),
  description: z.string().optional().nullable(),
  scope: z
    .enum([
      "ALL_OUTSTANDING",
      "PROGRAMME",
      "FEE_STRUCTURE",
      "BOARDING_ONLY",
      "DAY_ONLY",
    ])
    .default("ALL_OUTSTANDING"),
  programmeId: z.string().optional().nullable(),
  feeStructureId: z.string().optional().nullable(),
  boardingStatus: z.enum(["DAY", "BOARDING"]).optional().nullable(),
  minBalance: z.coerce.number().min(0).default(0),
  suppressOnInstallment: z.coerce.boolean().default(true),
  suppressOnAid: z.coerce.boolean().default(true),
  isActive: z.coerce.boolean().default(true),
  stages: z.array(dunningStageSchema).min(1, "At least one stage is required"),
});

type PolicyShape = {
  scope?: string;
  programmeId?: string | null;
  feeStructureId?: string | null;
  stages?: Array<{ order: number }>;
};

export const createDunningPolicySchema = dunningPolicyBaseObject
  .refine((v: PolicyShape) => v.scope !== "PROGRAMME" || !!v.programmeId, {
    path: ["programmeId"],
    message: "programmeId required when scope=PROGRAMME",
  })
  .refine((v: PolicyShape) => v.scope !== "FEE_STRUCTURE" || !!v.feeStructureId, {
    path: ["feeStructureId"],
    message: "feeStructureId required when scope=FEE_STRUCTURE",
  })
  .refine(
    (v: PolicyShape) => {
      if (!v.stages) return true;
      const orders = v.stages.map((s) => s.order);
      return new Set(orders).size === orders.length;
    },
    { path: ["stages"], message: "Stage orders must be unique" },
  );
export type CreateDunningPolicyInput = z.infer<typeof createDunningPolicySchema>;

const updateBase = dunningPolicyBaseObject.partial().extend({ id: z.string().min(1) });
export const updateDunningPolicySchema = updateBase
  .refine((v: PolicyShape) => v.scope !== "PROGRAMME" || !!v.programmeId, {
    path: ["programmeId"],
    message: "programmeId required when scope=PROGRAMME",
  })
  .refine((v: PolicyShape) => v.scope !== "FEE_STRUCTURE" || !!v.feeStructureId, {
    path: ["feeStructureId"],
    message: "feeStructureId required when scope=FEE_STRUCTURE",
  })
  .refine(
    (v: PolicyShape) => {
      if (!v.stages) return true;
      const orders = v.stages.map((s) => s.order);
      return new Set(orders).size === orders.length;
    },
    { path: ["stages"], message: "Stage orders must be unique" },
  );
export type UpdateDunningPolicyInput = z.infer<typeof updateDunningPolicySchema>;

export const runDunningSchema = z.object({
  policyId: z.string().min(1),
  triggerType: z.enum(["MANUAL", "SCHEDULED", "WEBHOOK"]).default("MANUAL"),
  dryRun: z.coerce.boolean().default(false),
});
export type RunDunningInput = z.infer<typeof runDunningSchema>;
