"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { z } from "zod";

// ─── Schemas ────────────────────────────────────────────────

const CONTRACT_TYPES = ["PERMANENT", "FIXED_TERM", "PROBATION", "NATIONAL_SERVICE"] as const;

const createContractSchema = z.object({
  staffId: z.string().min(1, "Staff ID is required"),
  contractNumber: z.string().optional(),
  type: z.enum(CONTRACT_TYPES, { message: "Contract type is required" }),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  renewalDate: z.string().optional(),
  terms: z.string().optional(),
  documentId: z.string().optional(),
});

type CreateContractInput = z.infer<typeof createContractSchema>;

const renewContractSchema = z.object({
  newEndDate: z.string().min(1, "New end date is required"),
  newTerms: z.string().optional(),
});

type RenewContractInput = z.infer<typeof renewContractSchema>;

// ─── CRUD ───────────────────────────────────────────────────

export async function getStaffContractsAction(staffId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const contracts = await db.staffContract.findMany({
    where: { staffId },
    orderBy: { startDate: "desc" },
  });

  return { data: contracts };
}

export async function getAllContractsAction(filters?: {
  status?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { schoolId: school.id };
  if (filters?.status) where.status = filters.status;
  if (filters?.type) where.type = filters.type;

  const [contracts, total] = await Promise.all([
    db.staffContract.findMany({
      where,
      include: {
        staff: { select: { firstName: true, lastName: true, staffId: true } },
      },
      orderBy: { startDate: "desc" },
      skip,
      take: pageSize,
    }),
    db.staffContract.count({ where }),
  ]);

  return { data: contracts, total, page, pageSize };
}

export async function createContractAction(data: CreateContractInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = createContractSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const staff = await db.staff.findUnique({ where: { id: parsed.data.staffId } });
  if (!staff) return { error: "Staff member not found." };

  const contract = await db.staffContract.create({
    data: {
      schoolId: school.id,
      staffId: parsed.data.staffId,
      contractNumber: parsed.data.contractNumber || null,
      type: parsed.data.type,
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      renewalDate: parsed.data.renewalDate ? new Date(parsed.data.renewalDate) : null,
      terms: parsed.data.terms || null,
      documentId: parsed.data.documentId || null,
      createdBy: session.user.id!,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "StaffContract",
    entityId: contract.id,
    module: "hr",
    description: `Created ${parsed.data.type} contract for "${staff.firstName} ${staff.lastName}"`,
    newData: contract,
  });

  return { data: contract };
}

export async function renewContractAction(contractId: string, data: RenewContractInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = renewContractSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };

  const existing = await db.staffContract.findUnique({ where: { id: contractId } });
  if (!existing) return { error: "Contract not found." };
  if (existing.status !== "ACTIVE") return { error: "Only active contracts can be renewed." };

  // Mark current as renewed
  await db.staffContract.update({
    where: { id: contractId },
    data: { status: "RENEWED" },
  });

  // Create new active contract
  const newContract = await db.staffContract.create({
    data: {
      schoolId: existing.schoolId,
      staffId: existing.staffId,
      type: existing.type,
      startDate: existing.endDate ?? new Date(),
      endDate: new Date(parsed.data.newEndDate),
      terms: parsed.data.newTerms || existing.terms,
      createdBy: session.user.id!,
    },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "StaffContract",
    entityId: contractId,
    module: "hr",
    description: `Renewed contract ${contractId} → new contract ${newContract.id}`,
    previousData: existing,
    newData: newContract,
  });

  return { data: newContract };
}

export async function getExpiringContractsAction(daysAhead: number = 30) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  const contracts = await db.staffContract.findMany({
    where: {
      schoolId: school.id,
      status: "ACTIVE",
      endDate: {
        gte: now,
        lte: futureDate,
      },
    },
    include: {
      staff: { select: { firstName: true, lastName: true, staffId: true } },
    },
    orderBy: { endDate: "asc" },
  });

  return { data: contracts };
}
