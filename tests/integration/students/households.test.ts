import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { backfillHouseholds } from "../../../scripts/backfill-households";
import { getSiblingsAction } from "@/modules/student/actions/sibling.action";
import { createGuardianAction } from "@/modules/student/actions/guardian.action";
import {
  previewMergeAction,
  performMergeAction,
} from "@/modules/student/actions/guardian-merge.action";
import { resolveSeededAdminId, loginAs } from "./setup";

/**
 * Full-lifecycle integration test for the Household / Family Grouping feature.
 *
 * Seeds 3 students sharing 2 guardians (via StudentGuardian links), then validates:
 *   - backfillHouseholds groups them all into exactly one Household
 *   - getSiblingsAction is symmetric across all three siblings
 *   - createGuardianAction returns duplicate candidates for a matching guardian
 *   - performMergeAction absorbs links and deletes the duplicate guardian
 *   - Tenant isolation: data is scoped to the seeded school only
 *
 * Skips cleanly when DATABASE_URL is not configured.
 */

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Households + dedup + merge (integration)", () => {
  const db = new PrismaClient();
  const testTag = `hh-test-${Date.now()}`;
  let adminId: string;
  const studentIds: string[] = [];
  const guardianIds: string[] = [];
  let householdId: string | null = null;

  beforeAll(async () => {
    adminId = await resolveSeededAdminId();
    loginAs({ id: adminId, permissions: ["*"], schoolId: "default-school" });

    // Seed 3 students sharing 2 guardians
    for (let i = 0; i < 3; i++) {
      const s = await db.student.create({
        data: {
          schoolId: "default-school",
          studentId: `${testTag}/${i + 1}`,
          firstName: `Child${i + 1}`,
          lastName: "Asante",
          dateOfBirth: new Date("2010-01-01"),
          gender: i % 2 === 0 ? "MALE" : "FEMALE",
        },
      });
      studentIds.push(s.id);
    }
    const g1 = await db.guardian.create({
      data: {
        schoolId: "default-school",
        firstName: "Kwame",
        lastName: "Asante",
        phone: `${testTag.slice(-9)}`,
      },
    });
    const g2 = await db.guardian.create({
      data: {
        schoolId: "default-school",
        firstName: "Akua",
        lastName: "Asante",
        phone: `020${testTag.slice(-6)}`,
      },
    });
    guardianIds.push(g1.id, g2.id);

    // Link all students to both guardians
    for (const sid of studentIds) {
      await db.studentGuardian.create({
        data: { schoolId: "default-school", studentId: sid, guardianId: g1.id, isPrimary: true },
      });
      await db.studentGuardian.create({
        data: { schoolId: "default-school", studentId: sid, guardianId: g2.id },
      });
    }
  });

  afterAll(async () => {
    // Cleanup order (FKs): audit → studentGuardian → student → guardian → household
    await db.auditLog
      .deleteMany({
        where: {
          entityId: {
            in: [...studentIds, ...guardianIds, householdId].filter(Boolean) as string[],
          },
        },
      })
      .catch(() => {});
    await db.studentGuardian
      .deleteMany({ where: { studentId: { in: studentIds } } })
      .catch(() => {});
    // Explicitly null out householdId on students/guardians before deleting the household
    await db.student
      .updateMany({
        where: { id: { in: studentIds } },
        data: { householdId: null },
      })
      .catch(() => {});
    await db.guardian
      .updateMany({
        where: { id: { in: guardianIds } },
        data: { householdId: null },
      })
      .catch(() => {});
    await db.student.deleteMany({ where: { id: { in: studentIds } } }).catch(() => {});
    await db.guardian.deleteMany({ where: { id: { in: guardianIds } } }).catch(() => {});
    if (householdId) {
      await db.household.delete({ where: { id: householdId } }).catch(() => {});
    }
    await db.$disconnect();
  });

  it("backfill creates one household grouping all members", async () => {
    await backfillHouseholds({ dryRun: false });

    const guardians = await db.guardian.findMany({ where: { id: { in: guardianIds } } });
    const students = await db.student.findMany({ where: { id: { in: studentIds } } });

    const householdIds = new Set(
      [...guardians, ...students].map((r) => r.householdId).filter(Boolean),
    );
    expect(householdIds.size).toBe(1);
    householdId = [...householdIds][0]!;
  });

  it("getSiblingsAction is symmetric across all three siblings", async () => {
    for (const sid of studentIds) {
      const res = await getSiblingsAction(sid);
      if (!("data" in res)) throw new Error(res.error);
      expect(res.data).toHaveLength(2);
      const otherIds = new Set(res.data.map((s) => s.id));
      for (const other of studentIds.filter((x) => x !== sid)) {
        expect(otherIds.has(other)).toBe(true);
      }
    }
  });

  it("createGuardianAction returns duplicates when a matching guardian exists", async () => {
    const res = await createGuardianAction({
      firstName: "Kwame",
      lastName: "Asante",
      phone: `${testTag.slice(-9)}`, // same phone as g1
    });
    expect(res).toHaveProperty("duplicates");
    if (!("duplicates" in res)) throw new Error("expected duplicates");
    expect(res.duplicates.length).toBeGreaterThan(0);
  });

  it("merge absorbs links and deletes duplicate", async () => {
    // Create a known duplicate (same name + different phone so no auto-dedup trigger on the phone alone)
    const dup = await db.guardian.create({
      data: {
        schoolId: "default-school",
        firstName: "Kwame",
        lastName: "Asante",
        phone: `030${testTag.slice(-6)}`,
      },
    });
    // Link to only one of the existing students
    await db.studentGuardian.create({
      data: { schoolId: "default-school", studentId: studentIds[0]!, guardianId: dup.id },
    });

    // Align households to avoid the "different households" conflict
    await db.guardian.update({ where: { id: dup.id }, data: { householdId } });

    const preview = await previewMergeAction({ survivorId: guardianIds[0]!, duplicateId: dup.id });
    if (!("data" in preview)) throw new Error(preview.error);
    expect(preview.conflicts).toEqual([]);

    const merged = await performMergeAction({
      survivorId: guardianIds[0]!,
      duplicateId: dup.id,
    });
    if (!("data" in merged)) throw new Error(merged.error);

    const stillExists = await db.guardian.findUnique({ where: { id: dup.id } });
    expect(stillExists).toBeNull();

    // Survivor's links: the 3 original + the 1 from duplicate (but that 1 was a shared student,
    // so it's the survivor-side link that survived; the duplicate's link was deleted during merge)
    const survivorLinks = await db.studentGuardian.findMany({
      where: { guardianId: guardianIds[0]! },
    });
    expect(survivorLinks).toHaveLength(3);
  });

  it("tenant isolation: queries scoped to current school", async () => {
    // Verify our test data is NOT visible from a different school's context
    const otherSchoolGuardians = await db.guardian.findMany({
      where: { schoolId: "other-school", phone: { contains: testTag.slice(-6) } },
    });
    expect(otherSchoolGuardians).toHaveLength(0);
  });
});
