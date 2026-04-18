// CLI: recompute Account.currentBalance for every school from POSTED journal
// entries. Run once after the IPSAS schema refactor; safe to rerun.
//
// Usage: node scripts/recompute-balances.mjs [schoolId]
//   - no arg: recompute all schools
//   - schoolId: recompute just that school

import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

function toNum(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return Number(v);
}
const round2 = (n) => Math.round(n * 100) / 100;

async function recompute(schoolId) {
  const accounts = await db.account.findMany({
    where: { schoolId },
    select: { id: true, code: true, normalBalance: true, currentBalance: true },
  });
  const entries = await db.journalEntry.findMany({
    where: { schoolId, journalTransaction: { status: "POSTED" } },
    select: { accountId: true, side: true, amount: true },
  });

  const totals = new Map();
  for (const a of accounts) totals.set(a.id, 0);
  for (const e of entries) {
    const acc = accounts.find((a) => a.id === e.accountId);
    if (!acc) continue;
    const delta = e.side === acc.normalBalance ? toNum(e.amount) : -toNum(e.amount);
    totals.set(acc.id, (totals.get(acc.id) ?? 0) + delta);
  }

  let corrected = 0;
  for (const acc of accounts) {
    const recomputed = round2(totals.get(acc.id) ?? 0);
    const previous = round2(toNum(acc.currentBalance));
    if (Math.abs(recomputed - previous) > 0.005) {
      await db.account.update({ where: { id: acc.id }, data: { currentBalance: recomputed } });
      console.log(`  ${acc.code}: ${previous} → ${recomputed} (Δ ${round2(recomputed - previous)})`);
      corrected += 1;
    }
  }
  return { total: accounts.length, corrected };
}

async function main() {
  const target = process.argv[2];
  const schools = target
    ? [{ id: target }]
    : await db.school.findMany({ select: { id: true, name: true } });

  for (const s of schools) {
    console.log(`\n[${s.id}]${s.name ? ` ${s.name}` : ""}`);
    const { total, corrected } = await recompute(s.id);
    console.log(`  → ${total} accounts scanned, ${corrected} corrected`);
  }
}

main()
  .catch((e) => {
    console.error("recompute failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
