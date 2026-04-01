"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";
import {
  createPettyCashFundSchema,
  recordPettyCashTransactionSchema,
  requestReplenishmentSchema,
  type CreatePettyCashFundInput,
  type RecordPettyCashTransactionInput,
  type RequestReplenishmentInput,
} from "@/modules/accounting/schemas/petty-cash.schema";

export async function getPettyCashFundsAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const funds = await db.pettyCashFund.findMany({
    where: { schoolId: school.id },
    include: {
      _count: { select: { transactions: true, replenishments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const userIds = [...new Set(funds.map((f) => f.custodianId))];
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } });
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const data = funds.map((f) => ({
    ...f,
    custodianName: userMap.get(f.custodianId) ?? "Unknown",
    transactionCount: f._count.transactions,
    utilizationRate: toNum(f.authorizedLimit) > 0 ? ((toNum(f.authorizedLimit) - toNum(f.currentBalance)) / toNum(f.authorizedLimit)) * 100 : 0,
  }));

  return { data };
}

export async function createPettyCashFundAction(data: CreatePettyCashFundInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = createPettyCashFundSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const school = await db.school.findFirst();
  if (!school) return { error: "School not found" };

  const fund = await db.pettyCashFund.create({
    data: { schoolId: school.id, ...parsed.data, currentBalance: parsed.data.authorizedLimit },
  });

  await audit({ userId: session.user.id!, action: "CREATE", entity: "PettyCashFund", entityId: fund.id, module: "accounting", description: `Created petty cash fund "${parsed.data.name}" (GHS ${parsed.data.authorizedLimit})` });

  return { data: fund };
}

export async function recordPettyCashTransactionAction(data: RecordPettyCashTransactionInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = recordPettyCashTransactionSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const fund = await db.pettyCashFund.findUnique({ where: { id: parsed.data.pettyCashFundId } });
  if (!fund) return { error: "Petty cash fund not found" };
  if (!fund.isActive) return { error: "Fund is inactive" };

  if (parsed.data.type === "DISBURSEMENT" && parsed.data.amount > toNum(fund.currentBalance)) {
    return { error: `Insufficient balance. Available: GHS ${toNum(fund.currentBalance).toFixed(2)}` };
  }

  const balanceChange = parsed.data.type === "DISBURSEMENT" ? -parsed.data.amount : parsed.data.amount;

  await db.$transaction(async (tx) => {
    await tx.pettyCashTransaction.create({
      data: { ...parsed.data, recordedBy: session.user.id! },
    });

    await tx.pettyCashFund.update({
      where: { id: fund.id },
      data: { currentBalance: { increment: balanceChange } },
    });
  });

  await audit({ userId: session.user.id!, action: "CREATE", entity: "PettyCashTransaction", entityId: fund.id, module: "accounting", description: `${parsed.data.type} of GHS ${parsed.data.amount} from "${fund.name}"` });

  return { data: { success: true, newBalance: toNum(fund.currentBalance) + balanceChange } };
}

export async function getPettyCashTransactionsAction(fundId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const transactions = await db.pettyCashTransaction.findMany({
    where: { pettyCashFundId: fundId },
    orderBy: { date: "desc" },
  });

  const userIds = [...new Set(transactions.map((t) => t.recordedBy))];
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } });
  const userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  const data = transactions.map((t) => ({ ...t, recordedByName: userMap.get(t.recordedBy) ?? "Unknown" }));

  return { data };
}

export async function requestReplenishmentAction(data: RequestReplenishmentInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = requestReplenishmentSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const fund = await db.pettyCashFund.findUnique({ where: { id: parsed.data.pettyCashFundId } });
  if (!fund) return { error: "Fund not found" };

  const replenishment = await db.pettyCashReplenishment.create({
    data: { pettyCashFundId: fund.id, amount: parsed.data.amount, requestedBy: session.user.id! },
  });

  await audit({ userId: session.user.id!, action: "CREATE", entity: "PettyCashReplenishment", entityId: replenishment.id, module: "accounting", description: `Requested replenishment of GHS ${parsed.data.amount} for "${fund.name}"` });

  return { data: replenishment };
}

export async function approveReplenishmentAction(replenishmentId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const replenishment = await db.pettyCashReplenishment.findUnique({
    where: { id: replenishmentId },
    include: { pettyCashFund: true },
  });
  if (!replenishment) return { error: "Replenishment not found" };
  if (replenishment.status !== "PENDING") return { error: "Only pending requests can be approved" };

  await db.$transaction(async (tx) => {
    await tx.pettyCashReplenishment.update({
      where: { id: replenishmentId },
      data: { status: "DISBURSED", approvedBy: session.user.id!, approvedAt: new Date() },
    });

    await tx.pettyCashFund.update({
      where: { id: replenishment.pettyCashFundId },
      data: { currentBalance: { increment: replenishment.amount } },
    });

    await tx.pettyCashTransaction.create({
      data: {
        pettyCashFundId: replenishment.pettyCashFundId,
        type: "REPLENISHMENT",
        amount: replenishment.amount,
        description: `Approved replenishment #${replenishmentId.slice(-6)}`,
        recordedBy: session.user.id!,
        date: new Date(),
      },
    });
  });

  return { data: { success: true } };
}
