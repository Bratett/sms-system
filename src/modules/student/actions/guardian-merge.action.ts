"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  findPotentialDuplicates,
  type DuplicateMatch,
  type GuardianLite,
} from "@/lib/guardian-matching";

type FieldFill = { from: unknown; to: unknown };

export type MergePreviewData = {
  survivor: { id: string; firstName: string; lastName: string };
  duplicate: { id: string; firstName: string; lastName: string };
  fieldFills: Record<string, FieldFill>;
  linksToTransfer: number;
  linksAlreadyShared: number;
};

// ─── Preview Merge ─────────────────────────────────────────────────

export async function previewMergeAction(input: {
  duplicateId: string;
  survivorId: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.GUARDIANS_MERGE);
  if (denied) return denied;

  const survivor = await db.guardian.findFirst({
    where: { id: input.survivorId, schoolId: ctx.schoolId },
  });
  if (!survivor) return { error: "Guardian not found" };
  const duplicate = await db.guardian.findFirst({
    where: { id: input.duplicateId, schoolId: ctx.schoolId },
  });
  if (!duplicate) return { error: "Guardian not found" };
  if (survivor.id === duplicate.id) {
    return { error: "Cannot merge a guardian into itself" };
  }

  const conflicts: string[] = [];
  if (survivor.userId != null && duplicate.userId != null) {
    conflicts.push("both have parent portal accounts");
  }
  if (
    survivor.householdId != null &&
    duplicate.householdId != null &&
    survivor.householdId !== duplicate.householdId
  ) {
    conflicts.push("different households");
  }

  const duplicateLinks = await db.studentGuardian.findMany({
    where: { guardianId: duplicate.id },
  });
  const survivorLinks = await db.studentGuardian.findMany({
    where: { guardianId: survivor.id },
  });
  const survivorStudentIds = new Set(survivorLinks.map((l) => l.studentId));

  const linksAlreadyShared = duplicateLinks.filter((l) => survivorStudentIds.has(l.studentId)).length;
  const linksToTransfer = duplicateLinks.length - linksAlreadyShared;

  const fieldFills: Record<string, FieldFill> = {};
  const optionalFields = ["altPhone", "email", "occupation", "address", "relationship"] as const;
  for (const field of optionalFields) {
    if (survivor[field] == null && duplicate[field] != null) {
      fieldFills[field] = { from: null, to: duplicate[field] };
    }
  }
  if (survivor.householdId == null && duplicate.householdId != null) {
    fieldFills.householdId = { from: null, to: duplicate.householdId };
  }

  return {
    data: {
      survivor: { id: survivor.id, firstName: survivor.firstName, lastName: survivor.lastName },
      duplicate: { id: duplicate.id, firstName: duplicate.firstName, lastName: duplicate.lastName },
      fieldFills,
      linksToTransfer,
      linksAlreadyShared,
    } as MergePreviewData,
    conflicts,
  };
}

// ─── Perform Merge ─────────────────────────────────────────────────

export async function performMergeAction(input: {
  duplicateId: string;
  survivorId: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.GUARDIANS_MERGE);
  if (denied) return denied;

  // Re-run preview to catch conflicts (defense in depth).
  const preview = await previewMergeAction(input);
  if ("error" in preview) return preview;
  if (preview.conflicts.length > 0) {
    return { error: `Merge blocked by conflicts: ${preview.conflicts.join(", ")}` };
  }

  // Wrap all mutations in a transaction for atomicity.
  let result: Awaited<ReturnType<typeof mergeInTransaction>>;
  try {
    result = await mergeInTransaction(input, ctx.schoolId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Merge failed" };
  }

  // Audit OUTSIDE the transaction — audit write failure shouldn't roll back the merge
  await audit({
    userId: ctx.session.user.id!,
    schoolId: ctx.schoolId,
    action: "DELETE",
    entity: "Guardian",
    entityId: result.duplicate.id,
    module: "student",
    description: `Merged guardian "${result.duplicate.firstName} ${result.duplicate.lastName}" into "${result.survivor.firstName} ${result.survivor.lastName}"`,
    previousData: { duplicate: result.duplicate, absorbedLinks: result.absorbedLinks },
  });

  return { data: { survivorId: result.survivor.id, absorbedLinks: result.absorbedLinks.length } };
}

async function mergeInTransaction(
  input: { duplicateId: string; survivorId: string },
  schoolId: string,
) {
  return await db.$transaction(async (tx) => {
    const survivor = await tx.guardian.findFirst({
      where: { id: input.survivorId, schoolId },
    });
    const duplicate = await tx.guardian.findFirst({
      where: { id: input.duplicateId, schoolId },
    });
    if (!survivor || !duplicate) {
      throw new Error("Guardian no longer exists");
    }

    const duplicateLinks = await tx.studentGuardian.findMany({
      where: { guardianId: duplicate.id },
    });
    const survivorLinks = await tx.studentGuardian.findMany({
      where: { guardianId: survivor.id },
    });
    const survivorStudentIds = new Set(survivorLinks.map((l) => l.studentId));

    const absorbedLinks: Array<{ studentId: string; isPrimary: boolean }> = [];

    for (const link of duplicateLinks) {
      if (survivorStudentIds.has(link.studentId)) {
        await tx.studentGuardian.delete({ where: { id: link.id } });
        continue;
      }
      await tx.studentGuardian.update({
        where: { id: link.id },
        data: { guardianId: survivor.id },
      });
      absorbedLinks.push({ studentId: link.studentId, isPrimary: link.isPrimary });
    }

    const updateData: Record<string, unknown> = {};
    const optionalFields = ["altPhone", "email", "occupation", "address", "relationship"] as const;
    for (const field of optionalFields) {
      if (survivor[field] == null && duplicate[field] != null) {
        updateData[field] = duplicate[field];
      }
    }
    if (survivor.householdId == null && duplicate.householdId != null) {
      updateData.householdId = duplicate.householdId;
    }
    if (Object.keys(updateData).length > 0) {
      await tx.guardian.update({ where: { id: survivor.id }, data: updateData });
    }

    await tx.guardian.delete({ where: { id: duplicate.id } });

    return { survivor, duplicate, absorbedLinks };
  });
}

// ─── Scan All Guardians for Duplicates ─────────────────────────────

export type DuplicateCluster = {
  cluster: DuplicateMatch[];
  confidence: "high" | "medium";
};

export async function scanGuardianDuplicatesAction(): Promise<
  { data: DuplicateCluster[] } | { error: string }
> {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.GUARDIANS_MERGE);
  if (denied) return denied;

  const guardians = await db.guardian.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true },
  });

  const clusters: DuplicateCluster[] = [];
  const seen = new Set<string>();

  for (const g of guardians as GuardianLite[]) {
    if (seen.has(g.id)) continue;
    const matches = findPotentialDuplicates(g, guardians as GuardianLite[]);
    if (matches.length === 0) continue;
    const selfAsMatch: DuplicateMatch = { guardian: g, reasons: [] };
    const cluster = [selfAsMatch, ...matches];
    for (const m of cluster) seen.add(m.guardian.id);

    const anyHighSignal = matches.some(
      (m) => m.reasons.includes("phone") || m.reasons.includes("email"),
    );
    clusters.push({ cluster, confidence: anyHighSignal ? "high" : "medium" });
  }

  return { data: clusters };
}
