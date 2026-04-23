/**
 * Backfills Household records from existing StudentGuardian link clusters.
 * Idempotent: skips guardians/students whose householdId is already set.
 *
 * Usage:
 *   npx tsx scripts/backfill-households.ts            # live run
 *   npx tsx scripts/backfill-households.ts --dry-run  # preview only
 */

import { db } from "@/lib/db";

export interface BackfillOptions {
  dryRun: boolean;
}

type GuardianLite = {
  id: string;
  firstName: string;
  lastName: string;
  householdId: string | null;
};

type StudentLite = {
  id: string;
  householdId: string | null;
};

type LinkLite = {
  studentId: string;
  guardianId: string;
  isPrimary: boolean;
};

/**
 * Union-Find / disjoint-set helper keyed on namespaced strings
 * (`g:<guardianId>` / `s:<studentId>`) so nodes from different domains
 * coexist in the same forest.
 */
class UnionFind {
  private parent = new Map<string, string>();

  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    // path compression
    let curr = x;
    while (this.parent.get(curr) !== root) {
      const next = this.parent.get(curr)!;
      this.parent.set(curr, root);
      curr = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }

  components(keys: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const k of keys) {
      const r = this.find(k);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r)!.push(k);
    }
    return groups;
  }
}

export async function backfillHouseholds(opts: BackfillOptions): Promise<void> {
  const { dryRun } = opts;
  const schools = await db.school.findMany({ select: { id: true } });

  for (const school of schools) {
    await backfillForSchool(school.id, dryRun);
  }
}

async function backfillForSchool(schoolId: string, dryRun: boolean): Promise<void> {
  const [links, guardians, students] = await Promise.all([
    db.studentGuardian.findMany({
      where: { schoolId },
      select: { studentId: true, guardianId: true, isPrimary: true },
    }),
    db.guardian.findMany({
      where: { schoolId },
      select: { id: true, firstName: true, lastName: true, householdId: true },
    }),
    db.student.findMany({
      where: { schoolId },
      select: { id: true, householdId: true },
    }),
  ]);

  // Filter to only records that need backfilling (householdId null)
  const guardiansToBackfill = guardians.filter((g: GuardianLite) => g.householdId === null);
  const studentsToBackfill = students.filter((s: StudentLite) => s.householdId === null);

  if (guardiansToBackfill.length === 0 && studentsToBackfill.length === 0) {
    console.log(`[${schoolId}] nothing to backfill`);
    return;
  }

  // Build union-find from links
  const uf = new UnionFind();
  const guardianKey = (id: string) => `g:${id}`;
  const studentKey = (id: string) => `s:${id}`;

  // Seed with all nodes that need backfilling (so isolated ones form their own component)
  for (const g of guardiansToBackfill) uf.find(guardianKey(g.id));
  for (const s of studentsToBackfill) uf.find(studentKey(s.id));

  for (const link of links as LinkLite[]) {
    uf.union(guardianKey(link.guardianId), studentKey(link.studentId));
  }

  // Determine primary guardian per student for surname selection
  const primaryByStudent = new Map<string, string>(); // studentId -> guardianId
  for (const link of links as LinkLite[]) {
    if (link.isPrimary) primaryByStudent.set(link.studentId, link.guardianId);
  }

  // Group all nodes by root
  const allNodeKeys = [
    ...guardiansToBackfill.map((g) => guardianKey(g.id)),
    ...studentsToBackfill.map((s) => studentKey(s.id)),
  ];
  const components = uf.components(allNodeKeys);

  const guardianById = new Map(guardians.map((g: GuardianLite) => [g.id, g]));

  for (const memberKeys of components.values()) {
    const memberGuardians: GuardianLite[] = [];
    const memberStudents: StudentLite[] = [];

    for (const key of memberKeys) {
      const [prefix, id] = [key[0], key.slice(2)];
      if (prefix === "g") {
        const g = guardianById.get(id);
        if (g && g.householdId === null) memberGuardians.push(g);
      } else if (prefix === "s") {
        const s = students.find((x: StudentLite) => x.id === id);
        if (s && s.householdId === null) memberStudents.push(s);
      }
    }

    // Surname rule: primary guardian's lastName (by any student); fallback: first guardian alphabetically
    let surname = "Household";
    const primaryGuardianIds = memberStudents
      .map((s) => primaryByStudent.get(s.id))
      .filter((id): id is string => id != null);
    if (primaryGuardianIds.length > 0) {
      const primary = guardianById.get(primaryGuardianIds[0]!);
      if (primary) surname = primary.lastName;
    } else if (memberGuardians.length > 0) {
      const sorted = [...memberGuardians].sort((a, b) => a.lastName.localeCompare(b.lastName));
      surname = sorted[0]!.lastName;
    }

    const householdName = `${surname} Family`;

    if (dryRun) {
      console.log(
        `[${schoolId}] WOULD CREATE household "${householdName}" with ${memberGuardians.length} guardian(s) + ${memberStudents.length} student(s)`,
      );
      continue;
    }

    const household = await db.household.create({
      data: { schoolId, name: householdName },
    });

    await Promise.all([
      ...memberGuardians.map((g) =>
        db.guardian.update({ where: { id: g.id }, data: { householdId: household.id } }),
      ),
      ...memberStudents.map((s) =>
        db.student.update({ where: { id: s.id }, data: { householdId: household.id } }),
      ),
    ]);

    console.log(
      `[${schoolId}] created household "${householdName}" (${household.id}) — ${memberGuardians.length} guardian(s), ${memberStudents.length} student(s)`,
    );
  }
}

// CLI entry point — only runs when invoked directly via `npx tsx scripts/backfill-households.ts`.
// Uses filename-suffix guard to work across both CJS and ESM module contexts
// (the repo uses tsx, which may load this file as either).
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`Running backfill-households (dryRun=${dryRun})`);
  await backfillHouseholds({ dryRun });
  console.log("Done");
  process.exit(0);
}

const invokedAsCli = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/backfill-households.ts");
if (invokedAsCli) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
