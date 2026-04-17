"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import {
  createItemBankQuestionSchema,
  updateItemBankQuestionSchema,
  generatePaperSchema,
  type CreateItemBankQuestionInput,
  type UpdateItemBankQuestionInput,
  type GeneratePaperInput,
} from "../schemas/item-bank.schema";

// parse helper removed — call schema.safeParse directly below.

// ─── Questions ───────────────────────────────────────────────────────

export async function listItemBankQuestionsAction(filters?: {
  subjectId?: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  bloomLevel?: string;
  status?: "DRAFT" | "UNDER_REVIEW" | "PUBLISHED" | "RETIRED";
  topic?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ITEM_BANK_READ);
  if (denied) return denied;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (filters?.subjectId) where.subjectId = filters.subjectId;
  if (filters?.difficulty) where.difficulty = filters.difficulty;
  if (filters?.bloomLevel) where.bloomLevel = filters.bloomLevel;
  if (filters?.status) where.status = filters.status;
  if (filters?.topic) where.topic = { contains: filters.topic, mode: "insensitive" };

  const [questions, total] = await Promise.all([
    db.itemBankQuestion.findMany({
      where,
      include: {
        choices: { orderBy: { order: "asc" } },
        tagLinks: { include: { tag: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.itemBankQuestion.count({ where }),
  ]);

  return { data: { questions, pagination: { page, pageSize, total } } };
}

export async function createItemBankQuestionAction(input: CreateItemBankQuestionInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ITEM_BANK_AUTHOR);
  if (denied) return denied;
  const parsed = createItemBankQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const subject = await db.subject.findFirst({
    where: { id: data.subjectId, schoolId: ctx.schoolId },
    select: { id: true },
  });
  if (!subject) return { error: "Subject not found for this tenant" };

  const created = await db.$transaction(async (tx) => {
    const q = await tx.itemBankQuestion.create({
      data: {
        schoolId: ctx.schoolId,
        subjectId: data.subjectId,
        topic: data.topic ?? null,
        stem: data.stem,
        type: data.type,
        difficulty: data.difficulty,
        bloomLevel: data.bloomLevel,
        maxScore: data.maxScore,
        explanation: data.explanation ?? null,
        correctText: data.correctText ?? null,
        metadata: (data.metadata as object | undefined) ?? undefined,
        status: "DRAFT",
        authoredBy: ctx.session.user.id,
      },
    });
    if (data.choices.length > 0) {
      await tx.itemBankChoice.createMany({
        data: data.choices.map((c, idx) => ({
          questionId: q.id,
          schoolId: ctx.schoolId,
          text: c.text,
          isCorrect: c.isCorrect,
          order: c.order ?? idx,
          explanation: c.explanation ?? null,
        })),
      });
    }
    if (data.tagIds.length > 0) {
      // verify all tags belong to tenant
      const valid = await tx.itemBankTag.findMany({
        where: { id: { in: data.tagIds }, schoolId: ctx.schoolId },
        select: { id: true },
      });
      if (valid.length > 0) {
        await tx.itemBankQuestionTag.createMany({
          data: valid.map((t) => ({
            questionId: q.id,
            tagId: t.id,
            schoolId: ctx.schoolId,
          })),
          skipDuplicates: true,
        });
      }
    }
    return q;
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "ItemBankQuestion",
    entityId: created.id,
    module: "academics",
    description: `Authored item-bank question (${data.type}, ${data.difficulty})`,
  });
  revalidatePath("/academics/item-bank");
  return { data: created };
}

export async function updateItemBankQuestionAction(input: UpdateItemBankQuestionInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ITEM_BANK_AUTHOR);
  if (denied) return denied;
  const parsed = updateItemBankQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const existing = await db.itemBankQuestion.findFirst({
    where: { id: data.id, schoolId: ctx.schoolId },
  });
  if (!existing) return { error: "Question not found" };

  const updated = await db.$transaction(async (tx) => {
    const q = await tx.itemBankQuestion.update({
      where: { id: data.id },
      data: {
        subjectId: data.subjectId ?? undefined,
        topic: data.topic ?? undefined,
        stem: data.stem ?? undefined,
        type: data.type ?? undefined,
        difficulty: data.difficulty ?? undefined,
        bloomLevel: data.bloomLevel ?? undefined,
        maxScore: data.maxScore ?? undefined,
        explanation: data.explanation ?? undefined,
        correctText: data.correctText ?? undefined,
        metadata: (data.metadata as object | undefined) ?? undefined,
      },
    });
    if (data.choices) {
      await tx.itemBankChoice.deleteMany({ where: { questionId: q.id } });
      if (data.choices.length > 0) {
        await tx.itemBankChoice.createMany({
          data: data.choices.map((c, idx) => ({
            questionId: q.id,
            schoolId: ctx.schoolId,
            text: c.text,
            isCorrect: c.isCorrect,
            order: c.order ?? idx,
            explanation: c.explanation ?? null,
          })),
        });
      }
    }
    if (data.tagIds) {
      await tx.itemBankQuestionTag.deleteMany({ where: { questionId: q.id } });
      if (data.tagIds.length > 0) {
        const valid = await tx.itemBankTag.findMany({
          where: { id: { in: data.tagIds }, schoolId: ctx.schoolId },
          select: { id: true },
        });
        await tx.itemBankQuestionTag.createMany({
          data: valid.map((t) => ({
            questionId: q.id,
            tagId: t.id,
            schoolId: ctx.schoolId,
          })),
          skipDuplicates: true,
        });
      }
    }
    return q;
  });
  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "ItemBankQuestion",
    entityId: updated.id,
    module: "academics",
    description: "Updated item-bank question",
  });
  revalidatePath("/academics/item-bank");
  return { data: updated };
}

export async function reviewItemBankQuestionAction(
  id: string,
  decision: "PUBLISHED" | "RETIRED" | "UNDER_REVIEW",
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permission =
    decision === "PUBLISHED"
      ? PERMISSIONS.ITEM_BANK_PUBLISH
      : PERMISSIONS.ITEM_BANK_REVIEW;
  const denied = assertPermission(ctx.session, permission);
  if (denied) return denied;

  const existing = await db.itemBankQuestion.findFirst({
    where: { id, schoolId: ctx.schoolId },
  });
  if (!existing) return { error: "Question not found" };

  const updated = await db.itemBankQuestion.update({
    where: { id },
    data: {
      status: decision,
      reviewedBy: ctx.session.user.id,
      reviewedAt: new Date(),
    },
  });
  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "ItemBankQuestion",
    entityId: id,
    module: "academics",
    description: `Item-bank question review: ${decision}`,
  });
  revalidatePath("/academics/item-bank");
  return { data: updated };
}

export async function deleteItemBankQuestionAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ITEM_BANK_AUTHOR);
  if (denied) return denied;

  const existing = await db.itemBankQuestion.findFirst({
    where: { id, schoolId: ctx.schoolId },
    select: { id: true, usageCount: true },
  });
  if (!existing) return { error: "Question not found" };
  if (existing.usageCount > 0) {
    return { error: "Cannot delete a question already used in a paper. Retire it instead." };
  }

  await db.itemBankQuestion.delete({ where: { id } });
  await audit({
    userId: ctx.session.user.id,
    action: "DELETE",
    entity: "ItemBankQuestion",
    entityId: id,
    module: "academics",
    description: "Deleted unused item-bank question",
  });
  revalidatePath("/academics/item-bank");
  return { data: { ok: true } };
}

// ─── Tags ────────────────────────────────────────────────────────────

export async function listItemBankTagsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ITEM_BANK_READ);
  if (denied) return denied;
  const tags = await db.itemBankTag.findMany({
    where: { schoolId: ctx.schoolId },
    orderBy: { name: "asc" },
  });
  return { data: tags };
}

export async function upsertItemBankTagAction(input: { id?: string; name: string; color?: string | null }) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ITEM_BANK_AUTHOR);
  if (denied) return denied;

  const name = input.name.trim();
  if (!name) return { error: "Name required" };

  const row = input.id
    ? await db.itemBankTag.update({
        where: { id: input.id },
        data: { name, color: input.color ?? null },
      })
    : await db.itemBankTag.upsert({
        where: { schoolId_name: { schoolId: ctx.schoolId, name } },
        create: { schoolId: ctx.schoolId, name, color: input.color ?? null },
        update: { color: input.color ?? null },
      });
  revalidatePath("/academics/item-bank");
  return { data: row };
}

// ─── Paper generation ────────────────────────────────────────────────

export async function generatePaperAction(input: GeneratePaperInput) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ITEM_BANK_PUBLISH);
  if (denied) return denied;
  const parsed = generatePaperSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const baseWhere: Record<string, unknown> = {
    schoolId: ctx.schoolId,
    subjectId: data.subjectId,
    status: "PUBLISHED",
  };
  if (data.blueprint.topics.length > 0) {
    baseWhere.topic = { in: data.blueprint.topics };
  }
  if (data.blueprint.bloomLevels.length > 0) {
    baseWhere.bloomLevel = { in: data.blueprint.bloomLevels };
  }
  if (data.blueprint.tagIds.length > 0) {
    baseWhere.tagLinks = { some: { tagId: { in: data.blueprint.tagIds } } };
  }

  const [easy, medium, hard] = await Promise.all([
    pickRandom({ ...baseWhere, difficulty: "EASY" }, data.blueprint.easy),
    pickRandom({ ...baseWhere, difficulty: "MEDIUM" }, data.blueprint.medium),
    pickRandom({ ...baseWhere, difficulty: "HARD" }, data.blueprint.hard),
  ]);

  const selected = [...easy, ...medium, ...hard];
  if (selected.length === 0) {
    return {
      error:
        "No published questions matched the blueprint. Publish more items or loosen the filter.",
    };
  }

  const totalScore = selected.reduce((s, q) => s + (q.maxScore ?? 1), 0);

  const paper = await db.$transaction(async (tx) => {
    const paper = await tx.itemBankPaper.create({
      data: {
        schoolId: ctx.schoolId,
        title: data.title,
        subjectId: data.subjectId,
        yearGroup: data.yearGroup ?? null,
        termId: data.termId ?? null,
        academicYearId: data.academicYearId ?? null,
        totalScore,
        durationMins: data.durationMins ?? null,
        instructions: data.instructions ?? null,
        status: "READY",
        generatorSpec: data.blueprint as unknown as object,
        createdBy: ctx.session.user.id,
      },
    });
    await tx.itemBankPaperQuestion.createMany({
      data: selected.map((q, idx) => ({
        paperId: paper.id,
        questionId: q.id,
        schoolId: ctx.schoolId,
        order: idx + 1,
      })),
    });
    // bump usageCount on picked questions
    await tx.itemBankQuestion.updateMany({
      where: { id: { in: selected.map((q) => q.id) } },
      data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
    });
    return paper;
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "ItemBankPaper",
    entityId: paper.id,
    module: "academics",
    description: `Generated paper "${data.title}" with ${selected.length} questions`,
    metadata: { blueprint: data.blueprint, totalScore },
  });

  revalidatePath("/academics/item-bank");
  return { data: { paperId: paper.id, questionCount: selected.length, totalScore } };
}

async function pickRandom(
  where: Record<string, unknown>,
  count: number,
): Promise<{ id: string; maxScore: number }[]> {
  if (count <= 0) return [];
  // Two-query random selection — no postgres `RANDOM()` dependency, works with
  // tenant RLS unchanged. Good enough up to ~10_000 published items per subject.
  const ids = await db.itemBankQuestion.findMany({
    where,
    select: { id: true, maxScore: true },
    take: 500,
  });
  if (ids.length === 0) return [];
  const shuffled = ids.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export async function getItemBankPaperAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ITEM_BANK_READ);
  if (denied) return denied;

  const paper = await db.itemBankPaper.findFirst({
    where: { id, schoolId: ctx.schoolId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { question: { include: { choices: { orderBy: { order: "asc" } } } } },
      },
    },
  });
  if (!paper) return { error: "Paper not found" };
  return { data: paper };
}

export async function listItemBankPapersAction(subjectId?: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.ITEM_BANK_READ);
  if (denied) return denied;
  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (subjectId) where.subjectId = subjectId;
  const papers = await db.itemBankPaper.findMany({
    where,
    include: { _count: { select: { questions: true } } },
    orderBy: { createdAt: "desc" },
  });
  return { data: papers };
}
