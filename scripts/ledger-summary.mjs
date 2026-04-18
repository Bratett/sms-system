import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

function toNum(v) { if (v == null) return 0; if (typeof v === "number") return v; return Number(v); }

const SCHOOL_ID = "default-school";

const [txnCount, reversed, entries, topAccounts, fundCount, periodCount, commitCount, subsidyCount] = await Promise.all([
  db.journalTransaction.count({ where: { schoolId: SCHOOL_ID } }),
  db.journalTransaction.count({ where: { schoolId: SCHOOL_ID, status: "REVERSED" } }),
  db.journalEntry.count({ where: { schoolId: SCHOOL_ID } }),
  db.account.findMany({
    where: { schoolId: SCHOOL_ID, NOT: { currentBalance: 0 } },
    select: { code: true, name: true, currentBalance: true, normalBalance: true, category: { select: { type: true } } },
    orderBy: { code: "asc" },
  }),
  db.fund.count({ where: { schoolId: SCHOOL_ID } }),
  db.fiscalPeriod.count({ where: { schoolId: SCHOOL_ID } }),
  db.budgetCommitment.count({ where: { schoolId: SCHOOL_ID } }),
  db.governmentSubsidy.count({ where: { schoolId: SCHOOL_ID } }),
]);

console.log(`📒 Ledger Summary — ${SCHOOL_ID}\n`);
console.log(`  Journal transactions: ${txnCount} (${reversed} reversed)`);
console.log(`  Journal entries: ${entries}`);
console.log(`  Funds: ${fundCount}`);
console.log(`  Fiscal periods: ${periodCount}`);
console.log(`  Budget commitments: ${commitCount}`);
console.log(`  Government subsidies: ${subsidyCount}`);

console.log(`\n📊 Accounts with non-zero balances:\n`);
const groups = new Map();
for (const a of topAccounts) {
  const t = a.category.type;
  if (!groups.has(t)) groups.set(t, []);
  groups.get(t).push(a);
}
for (const [type, accs] of groups) {
  console.log(`\n  ── ${type} ──`);
  for (const a of accs) {
    console.log(`    ${a.code}  ${a.name.padEnd(46)}  GHS ${toNum(a.currentBalance).toLocaleString("en-GH", { minimumFractionDigits: 2 })}  (normal=${a.normalBalance})`);
  }
}

const sums = await db.journalEntry.groupBy({
  by: ["side"],
  where: { schoolId: SCHOOL_ID, journalTransaction: { status: { in: ["POSTED", "REVERSED"] } } },
  _sum: { amount: true },
});
const d = toNum(sums.find(s => s.side === "DEBIT")?._sum.amount);
const c = toNum(sums.find(s => s.side === "CREDIT")?._sum.amount);
console.log(`\n⚖️  Σdebits = GHS ${d.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`);
console.log(`⚖️  Σcredits = GHS ${c.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`);
console.log(`${Math.abs(d - c) < 0.01 ? "✅ Trial balance is balanced" : "❌ TRIAL BALANCE OUT OF BALANCE"}`);

await db.$disconnect();
