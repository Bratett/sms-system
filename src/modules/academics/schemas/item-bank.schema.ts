import { z } from "zod";

const questionTypes = [
  "MULTIPLE_CHOICE",
  "MULTI_SELECT",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "FILL_IN_BLANK",
  "ESSAY",
  "MATCHING",
  "NUMERIC",
] as const;
const difficulties = ["EASY", "MEDIUM", "HARD"] as const;
const blooms = ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"] as const;

export const itemBankChoiceSchema = z.object({
  text: z.string().min(1),
  isCorrect: z.coerce.boolean().default(false),
  order: z.coerce.number().int().min(0).default(0),
  explanation: z.string().optional().nullable(),
});
export type ItemBankChoiceInput = z.infer<typeof itemBankChoiceSchema>;

const itemBankQuestionBaseObject = z.object({
  subjectId: z.string().min(1),
  topic: z.string().max(200).optional().nullable(),
  stem: z.string().min(3),
  type: z.enum(questionTypes),
  difficulty: z.enum(difficulties).default("MEDIUM"),
  bloomLevel: z.enum(blooms).default("UNDERSTAND"),
  maxScore: z.coerce.number().min(0.1).default(1),
  explanation: z.string().optional().nullable(),
  correctText: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  choices: z.array(itemBankChoiceSchema).default([]),
  tagIds: z.array(z.string()).default([]),
});

type ItemBankRefineInput = {
  type?: string;
  choices?: Array<{ isCorrect: boolean }>;
};

function itemBankRefine(
  v: ItemBankRefineInput,
  ctx: { addIssue: (issue: { code: "custom"; path: (string | number)[]; message: string }) => void },
): void {
  if (!v.type) return;
  const needsChoices = ["MULTIPLE_CHOICE", "MULTI_SELECT", "TRUE_FALSE", "MATCHING"].includes(v.type);
  const choices = v.choices ?? [];
  if (needsChoices && choices.length < 2) {
    ctx.addIssue({
      code: "custom",
      path: ["choices"],
      message: `${v.type} requires at least 2 choices`,
    });
  }
  if (needsChoices && !choices.some((c) => c.isCorrect)) {
    ctx.addIssue({
      code: "custom",
      path: ["choices"],
      message: "At least one choice must be marked correct",
    });
  }
  if (v.type === "MULTIPLE_CHOICE" && choices.filter((c) => c.isCorrect).length !== 1) {
    ctx.addIssue({
      code: "custom",
      path: ["choices"],
      message: "MULTIPLE_CHOICE must have exactly one correct answer",
    });
  }
}

export const createItemBankQuestionSchema = itemBankQuestionBaseObject.superRefine(itemBankRefine);
export type CreateItemBankQuestionInput = z.infer<typeof createItemBankQuestionSchema>;

export const updateItemBankQuestionSchema = itemBankQuestionBaseObject
  .partial()
  .extend({ id: z.string().min(1) })
  .superRefine(itemBankRefine);
export type UpdateItemBankQuestionInput = z.infer<typeof updateItemBankQuestionSchema>;

export const generatePaperSchema = z
  .object({
    title: z.string().min(2),
    subjectId: z.string().min(1),
    yearGroup: z.coerce.number().int().min(1).max(12).optional().nullable(),
    termId: z.string().optional().nullable(),
    academicYearId: z.string().optional().nullable(),
    durationMins: z.coerce.number().int().min(5).optional().nullable(),
    instructions: z.string().optional().nullable(),
    blueprint: z.object({
      easy: z.coerce.number().int().min(0).default(0),
      medium: z.coerce.number().int().min(0).default(0),
      hard: z.coerce.number().int().min(0).default(0),
      topics: z.array(z.string()).default([]),
      bloomLevels: z.array(z.enum(blooms)).default([]),
      tagIds: z.array(z.string()).default([]),
    }),
  })
  .refine((v) => v.blueprint.easy + v.blueprint.medium + v.blueprint.hard > 0, {
    path: ["blueprint"],
    message: "Total question count must be greater than zero",
  });
export type GeneratePaperInput = z.infer<typeof generatePaperSchema>;
