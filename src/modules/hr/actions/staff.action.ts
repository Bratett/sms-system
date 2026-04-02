"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { PERMISSIONS, denyPermission } from "@/lib/permissions";
import { encryptOptional, decryptOptional } from "@/lib/crypto/field-encrypt";
import {
  createStaffSchema,
  updateStaffSchema,
  terminateStaffSchema,
  type CreateStaffInput,
  type UpdateStaffInput,
  type TerminateStaffInput,
} from "@/modules/hr/schemas/staff.schema";

// ─── List Staff (paginated, with search & filters) ───────────

export async function getStaffAction(filters?: {
  search?: string;
  staffType?: string;
  departmentId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.STAFF_READ)) return { error: "Insufficient permissions" };

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    schoolId: school.id,
    deletedAt: null,
  };

  if (filters?.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: "insensitive" } },
      { lastName: { contains: filters.search, mode: "insensitive" } },
      { staffId: { contains: filters.search, mode: "insensitive" } },
      { phone: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  if (filters?.staffType) {
    where.staffType = filters.staffType;
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.departmentId) {
    where.employments = {
      some: {
        departmentId: filters.departmentId,
        status: "ACTIVE",
      },
    };
  }

  const [staff, total] = await Promise.all([
    db.staff.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      include: {
        employments: {
          where: { status: "ACTIVE" },
          take: 1,
          orderBy: { startDate: "desc" },
        },
      },
    }),
    db.staff.count({ where }),
  ]);

  // Get department names for active employments
  const departmentIds = [
    ...new Set(staff.map((s) => s.employments[0]?.departmentId).filter(Boolean) as string[]),
  ];

  const departments =
    departmentIds.length > 0
      ? await db.department.findMany({
          where: { id: { in: departmentIds } },
          select: { id: true, name: true },
        })
      : [];
  const deptMap = new Map(departments.map((d) => [d.id, d.name]));

  const data = staff.map((s) => {
    const employment = s.employments[0];
    return {
      id: s.id,
      staffId: s.staffId,
      firstName: s.firstName,
      lastName: s.lastName,
      otherNames: s.otherNames,
      gender: s.gender,
      phone: s.phone,
      email: s.email,
      staffType: s.staffType,
      status: s.status,
      position: employment?.position ?? null,
      departmentName: employment?.departmentId
        ? (deptMap.get(employment.departmentId) ?? null)
        : null,
      createdAt: s.createdAt,
    };
  });

  return { staff: data, total, page, pageSize };
}

// ─── Single Staff Member ─────────────────────────────────────

export async function getStaffMemberAction(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.STAFF_READ)) return { error: "Insufficient permissions" };

  const staff = await db.staff.findUnique({
    where: { id },
    include: {
      employments: {
        orderBy: { startDate: "desc" },
      },
    },
  });

  if (!staff) {
    return { error: "Staff member not found." };
  }

  // Get department names
  const departmentIds = [
    ...new Set(staff.employments.map((e) => e.departmentId).filter(Boolean) as string[]),
  ];

  const departments =
    departmentIds.length > 0
      ? await db.department.findMany({
          where: { id: { in: departmentIds } },
          select: { id: true, name: true },
        })
      : [];
  const deptMap = new Map(departments.map((d) => [d.id, d.name]));

  // Get leave balances
  const leaveBalances = await db.leaveBalance.findMany({
    where: { staffId: id },
    include: {
      leaveType: { select: { name: true } },
    },
    orderBy: { leaveType: { name: "asc" } },
  });

  // Get linked user
  let user = null;
  if (staff.userId) {
    const userRecord = await db.user.findUnique({
      where: { id: staff.userId },
      select: { id: true, username: true, email: true, status: true },
    });
    user = userRecord;
  }

  return {
    data: {
      id: staff.id,
      staffId: staff.staffId,
      firstName: staff.firstName,
      lastName: staff.lastName,
      otherNames: staff.otherNames,
      dateOfBirth: staff.dateOfBirth,
      gender: staff.gender,
      phone: staff.phone,
      email: staff.email,
      address: staff.address,
      region: staff.region,
      ghanaCardNumber: decryptOptional(staff.ghanaCardNumber),
      ssnitNumber: decryptOptional(staff.ssnitNumber),
      tinNumber: decryptOptional(staff.tinNumber),
      staffType: staff.staffType,
      specialization: staff.specialization,
      qualifications: staff.qualifications as
        | { degree: string; institution: string; year?: string }[]
        | null,
      dateOfFirstAppointment: staff.dateOfFirstAppointment,
      dateOfPostingToSchool: staff.dateOfPostingToSchool,
      photoUrl: staff.photoUrl,
      status: staff.status,
      userId: staff.userId,
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt,
      employments: staff.employments.map((e) => ({
        id: e.id,
        position: e.position,
        rank: e.rank,
        departmentId: e.departmentId,
        departmentName: e.departmentId ? (deptMap.get(e.departmentId) ?? null) : null,
        startDate: e.startDate,
        endDate: e.endDate,
        appointmentType: e.appointmentType,
        salaryGrade: e.salaryGrade,
        status: e.status,
      })),
      leaveBalances: leaveBalances.map((lb) => ({
        id: lb.id,
        leaveTypeName: lb.leaveType.name,
        totalDays: lb.totalDays,
        usedDays: lb.usedDays,
        remainingDays: lb.remainingDays,
      })),
      user,
    },
  };
}

// ─── Create Staff ────────────────────────────────────────────

export async function createStaffAction(data: CreateStaffInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.STAFF_CREATE)) return { error: "Insufficient permissions" };

  const parsed = createStaffSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  // Auto-generate staff ID: STF/YYYY/NNNN
  const year = new Date().getFullYear();
  const count = await db.staff.count();
  const staffId = `STF/${year}/${String(count + 1).padStart(4, "0")}`;

  // Optionally create user account
  let userId: string | undefined;
  if (parsed.data.createUserAccount && parsed.data.staffType === "TEACHING") {
    // Find the teacher role
    const teacherRole = await db.role.findFirst({
      where: { name: { in: ["teacher", "Teacher"] } },
    });

    if (teacherRole) {
      const username =
        `${parsed.data.firstName.toLowerCase()}.${parsed.data.lastName.toLowerCase()}`.replace(
          /\s+/g,
          "",
        );

      // Check if username exists, append number if so
      let finalUsername = username;
      let counter = 1;
      while (await db.user.findFirst({ where: { username: finalUsername } })) {
        finalUsername = `${username}${counter}`;
        counter++;
      }

      const generatedPassword = randomBytes(16).toString("hex");
      const passwordHash = await bcrypt.hash(generatedPassword, 12);

      const user = await db.user.create({
        data: {
          username: finalUsername,
          email: parsed.data.email || `${finalUsername}@school.local`,
          passwordHash,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          phone: parsed.data.phone || null,
          userRoles: {
            create: {
              roleId: teacherRole.id,
              assignedBy: session.user.id,
            },
          },
        },
      });

      userId = user.id;
    }
  }

  const staff = await db.staff.create({
    data: {
      schoolId: school.id,
      staffId,
      userId: userId || null,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      otherNames: parsed.data.otherNames || null,
      dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : null,
      gender: parsed.data.gender,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      region: parsed.data.region || null,
      ghanaCardNumber: encryptOptional(parsed.data.ghanaCardNumber),
      ssnitNumber: encryptOptional(parsed.data.ssnitNumber),
      tinNumber: encryptOptional(parsed.data.tinNumber),
      staffType: parsed.data.staffType,
      specialization: parsed.data.specialization || null,
      qualifications: parsed.data.qualifications ?? undefined,
      dateOfFirstAppointment: parsed.data.dateOfFirstAppointment
        ? new Date(parsed.data.dateOfFirstAppointment)
        : null,
      dateOfPostingToSchool: parsed.data.dateOfPostingToSchool
        ? new Date(parsed.data.dateOfPostingToSchool)
        : null,
      employments: {
        create: {
          position: parsed.data.position,
          rank: parsed.data.rank || null,
          departmentId: parsed.data.departmentId || null,
          appointmentType: parsed.data.appointmentType,
          salaryGrade: parsed.data.salaryGrade || null,
          startDate: new Date(parsed.data.startDate),
        },
      },
    },
  });

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "Staff",
    entityId: staff.id,
    module: "hr",
    description: `Registered staff "${staff.firstName} ${staff.lastName}" (${staffId})`,
    newData: staff,
  });

  return { data: staff };
}

// ─── Update Staff ────────────────────────────────────────────

export async function updateStaffAction(id: string, data: UpdateStaffInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.STAFF_UPDATE)) return { error: "Insufficient permissions" };

  const parsed = updateStaffSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.staff.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Staff member not found." };
  }

  const previousData = { ...existing };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {};
  if (parsed.data.firstName !== undefined) updateData.firstName = parsed.data.firstName;
  if (parsed.data.lastName !== undefined) updateData.lastName = parsed.data.lastName;
  if (parsed.data.otherNames !== undefined) updateData.otherNames = parsed.data.otherNames || null;
  if (parsed.data.dateOfBirth !== undefined)
    updateData.dateOfBirth = parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : null;
  if (parsed.data.gender !== undefined) updateData.gender = parsed.data.gender;
  if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;
  if (parsed.data.email !== undefined) updateData.email = parsed.data.email || null;
  if (parsed.data.address !== undefined) updateData.address = parsed.data.address || null;
  if (parsed.data.region !== undefined) updateData.region = parsed.data.region || null;
  if (parsed.data.ghanaCardNumber !== undefined)
    updateData.ghanaCardNumber = encryptOptional(parsed.data.ghanaCardNumber);
  if (parsed.data.ssnitNumber !== undefined)
    updateData.ssnitNumber = encryptOptional(parsed.data.ssnitNumber);
  if (parsed.data.tinNumber !== undefined) updateData.tinNumber = encryptOptional(parsed.data.tinNumber);
  if (parsed.data.staffType !== undefined) updateData.staffType = parsed.data.staffType;
  if (parsed.data.specialization !== undefined)
    updateData.specialization = parsed.data.specialization || null;
  if (parsed.data.qualifications !== undefined)
    updateData.qualifications = parsed.data.qualifications ?? null;
  if (parsed.data.dateOfFirstAppointment !== undefined)
    updateData.dateOfFirstAppointment = parsed.data.dateOfFirstAppointment
      ? new Date(parsed.data.dateOfFirstAppointment)
      : null;
  if (parsed.data.dateOfPostingToSchool !== undefined)
    updateData.dateOfPostingToSchool = parsed.data.dateOfPostingToSchool
      ? new Date(parsed.data.dateOfPostingToSchool)
      : null;

  const updated = await db.staff.update({
    where: { id },
    data: updateData,
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Staff",
    entityId: id,
    module: "hr",
    description: `Updated staff "${updated.firstName} ${updated.lastName}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

// ─── Terminate Staff ─────────────────────────────────────────

export async function terminateStaffAction(id: string, data: TerminateStaffInput) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.STAFF_DELETE)) return { error: "Insufficient permissions" };

  const parsed = terminateStaffSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.staff.findUnique({
    where: { id },
    include: {
      employments: { where: { status: "ACTIVE" } },
    },
  });

  if (!existing) {
    return { error: "Staff member not found." };
  }

  const previousData = { ...existing };

  // End all active employments
  await db.employment.updateMany({
    where: { staffId: id, status: "ACTIVE" },
    data: {
      status: "ENDED",
      endDate: new Date(parsed.data.endDate),
    },
  });

  // Update staff status
  const updated = await db.staff.update({
    where: { id },
    data: {
      status: parsed.data.type,
    },
  });

  // Deactivate linked user account
  if (existing.userId) {
    await db.user.update({
      where: { id: existing.userId },
      data: { status: "INACTIVE" },
    });
  }

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Staff",
    entityId: id,
    module: "hr",
    description: `${parsed.data.type.toLowerCase()} staff "${existing.firstName} ${existing.lastName}" - ${parsed.data.reason}`,
    previousData,
    newData: updated,
  });

  return { success: true };
}

// ─── Staff Stats ─────────────────────────────────────────────

export async function getStaffStatsAction() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.STAFF_READ)) return { error: "Insufficient permissions" };

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const [total, active, teaching, nonTeaching, terminated, retired, onLeave] = await Promise.all([
    db.staff.count({ where: { schoolId: school.id, deletedAt: null } }),
    db.staff.count({ where: { schoolId: school.id, status: "ACTIVE", deletedAt: null } }),
    db.staff.count({
      where: { schoolId: school.id, staffType: "TEACHING", status: "ACTIVE", deletedAt: null },
    }),
    db.staff.count({
      where: { schoolId: school.id, staffType: "NON_TEACHING", status: "ACTIVE", deletedAt: null },
    }),
    db.staff.count({ where: { schoolId: school.id, status: "TERMINATED", deletedAt: null } }),
    db.staff.count({ where: { schoolId: school.id, status: "RETIRED", deletedAt: null } }),
    db.staff.count({ where: { schoolId: school.id, status: "ON_LEAVE", deletedAt: null } }),
  ]);

  // Pending leave requests
  const pendingLeaveRequests = await db.leaveRequest.count({
    where: {
      status: "PENDING",
      staff: { schoolId: school.id },
    },
  });

  // By department
  const departments = await db.department.findMany({
    where: { schoolId: school.id },
    select: { id: true, name: true },
  });

  const departmentCounts = await Promise.all(
    departments.map(async (dept) => {
      const count = await db.employment.count({
        where: {
          departmentId: dept.id,
          status: "ACTIVE",
        },
      });
      return { id: dept.id, name: dept.name, count };
    }),
  );

  return {
    data: {
      total,
      active,
      teaching,
      nonTeaching,
      terminated,
      retired,
      onLeave,
      pendingLeaveRequests,
      byDepartment: departmentCounts,
    },
  };
}

// ─── Import Staff (Bulk) ─────────────────────────────────────

export async function importStaffAction(
  rows: {
    firstName: string;
    lastName: string;
    otherNames?: string;
    gender: string;
    phone: string;
    email?: string;
    staffType: string;
    position: string;
    appointmentType?: string;
  }[],
) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.STAFF_CREATE)) return { error: "Insufficient permissions" };

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const year = new Date().getFullYear();
  let currentCount = await db.staff.count({ where: { schoolId: school.id } });

  const imported: string[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.firstName || !row.lastName || !row.gender || !row.phone || !row.position) {
        errors.push({
          row: i + 1,
          message: "Missing required fields (firstName, lastName, gender, phone, position)",
        });
        continue;
      }

      const gender = row.gender.toUpperCase();
      if (gender !== "MALE" && gender !== "FEMALE") {
        errors.push({ row: i + 1, message: `Invalid gender: ${row.gender}` });
        continue;
      }

      const staffType = row.staffType?.toUpperCase().replace(/[\s-]/g, "_") || "TEACHING";
      if (staffType !== "TEACHING" && staffType !== "NON_TEACHING") {
        errors.push({ row: i + 1, message: `Invalid staff type: ${row.staffType}` });
        continue;
      }

      currentCount++;
      const staffId = `STF/${year}/${String(currentCount).padStart(4, "0")}`;

      const appointmentType = (row.appointmentType?.toUpperCase().replace(/[\s-]/g, "_") ||
        "PERMANENT") as "PERMANENT" | "CONTRACT" | "NATIONAL_SERVICE" | "VOLUNTEER";

      const staff = await db.staff.create({
        data: {
          schoolId: school.id,
          staffId,
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          otherNames: row.otherNames?.trim() || null,
          gender: gender as "MALE" | "FEMALE",
          phone: row.phone.trim(),
          email: row.email?.trim() || null,
          staffType: staffType as "TEACHING" | "NON_TEACHING",
          employments: {
            create: {
              position: row.position.trim(),
              appointmentType,
              startDate: new Date(),
            },
          },
        },
      });

      imported.push(staff.id);
    } catch (error) {
      errors.push({
        row: i + 1,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  if (imported.length > 0) {
    await audit({
      userId: session.user.id!,
      action: "CREATE",
      entity: "Staff",
      module: "hr",
      description: `Bulk imported ${imported.length} staff members`,
      metadata: { importedCount: imported.length, errorCount: errors.length },
    });
  }

  return { imported: imported.length, errors };
}
