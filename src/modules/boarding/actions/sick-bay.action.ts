"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { audit } from "@/lib/audit";
import { dispatch } from "@/lib/notifications/dispatcher";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { admitToSickBaySchema, addMedicationSchema } from "../schemas";

// ─── Sick Bay Admissions (List) ────────────────────────────────────

export async function getSickBayAdmissionsAction(filters?: {
  status?: string;
  hostelId?: string;
  studentId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.SICK_BAY_READ);
  if (permErr) return permErr;

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.hostelId) where.hostelId = filters.hostelId;
  if (filters?.studentId) where.studentId = filters.studentId;

  const [admissions, total] = await Promise.all([
    db.sickBayAdmission.findMany({
      where,
      include: {
        _count: { select: { medications: true } },
      },
      orderBy: { admittedAt: "desc" },
      take: pageSize,
      skip,
    }),
    db.sickBayAdmission.count({ where }),
  ]);

  // Resolve student names
  const studentIds = [...new Set(admissions.map((a) => a.studentId))];
  let studentMap = new Map<string, { name: string; studentNumber: string }>();
  if (studentIds.length > 0) {
    const students = await db.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true, studentId: true },
    });
    studentMap = new Map(
      students.map((s) => [
        s.id,
        { name: `${s.firstName} ${s.lastName}`, studentNumber: s.studentId },
      ]),
    );
  }

  // Resolve hostel names
  const hostelIds = [...new Set(admissions.map((a) => a.hostelId))];
  let hostelMap = new Map<string, string>();
  if (hostelIds.length > 0) {
    const hostels = await db.hostel.findMany({
      where: { id: { in: hostelIds } },
      select: { id: true, name: true },
    });
    hostelMap = new Map(hostels.map((h) => [h.id, h.name]));
  }

  // Resolve user names (admittedBy, dischargedBy)
  const userIds = [
    ...new Set([
      ...admissions.map((a) => a.admittedBy),
      ...admissions.filter((a) => a.dischargedBy).map((a) => a.dischargedBy!),
    ]),
  ];
  let userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  }

  let data = admissions.map((a) => ({
    id: a.id,
    admissionNumber: a.admissionNumber,
    studentId: a.studentId,
    studentName: studentMap.get(a.studentId)?.name ?? "Unknown",
    studentNumber: studentMap.get(a.studentId)?.studentNumber ?? "",
    hostelId: a.hostelId,
    hostelName: hostelMap.get(a.hostelId) ?? "Unknown",
    admittedBy: userMap.get(a.admittedBy) ?? "Unknown",
    admittedAt: a.admittedAt,
    symptoms: a.symptoms,
    initialDiagnosis: a.initialDiagnosis,
    temperature: a.temperature ? Number(a.temperature) : null,
    severity: a.severity,
    status: a.status,
    treatmentNotes: a.treatmentNotes,
    dischargedBy: a.dischargedBy ? (userMap.get(a.dischargedBy) ?? "Unknown") : null,
    dischargedAt: a.dischargedAt,
    dischargeNotes: a.dischargeNotes,
    referredTo: a.referredTo,
    parentNotified: a.parentNotified,
    medicationsCount: a._count.medications,
  }));

  if (filters?.search) {
    const search = filters.search.toLowerCase();
    data = data.filter(
      (a) =>
        a.studentName.toLowerCase().includes(search) ||
        a.studentNumber.toLowerCase().includes(search) ||
        a.admissionNumber.toLowerCase().includes(search),
    );
  }

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

// ─── Single Admission ──────────────────────────────────────────────

export async function getSickBayAdmissionAction(id: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.SICK_BAY_READ);
  if (permErr) return permErr;

  const admission = await db.sickBayAdmission.findUnique({
    where: { id },
    include: {
      medications: {
        orderBy: { administeredAt: "desc" },
      },
    },
  });

  if (!admission) {
    return { error: "Sick bay admission not found." };
  }

  // Resolve student
  const student = await db.student.findUnique({
    where: { id: admission.studentId },
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
      boardingStatus: true,
      photoUrl: true,
    },
  });

  // Resolve hostel
  const hostel = await db.hostel.findUnique({
    where: { id: admission.hostelId },
    select: { id: true, name: true },
  });

  // Resolve user names (admittedBy, dischargedBy, medication administeredBy)
  const userIds = [
    admission.admittedBy,
    ...(admission.dischargedBy ? [admission.dischargedBy] : []),
    ...admission.medications.map((m) => m.administeredBy),
  ];
  const uniqueUserIds = [...new Set(userIds)];
  let userMap = new Map<string, string>();
  if (uniqueUserIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: uniqueUserIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    userMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  }

  const data = {
    id: admission.id,
    admissionNumber: admission.admissionNumber,
    student: student
      ? {
          id: student.id,
          studentId: student.studentId,
          firstName: student.firstName,
          lastName: student.lastName,
          boardingStatus: student.boardingStatus,
          photoUrl: student.photoUrl,
        }
      : null,
    hostel: hostel ? { id: hostel.id, name: hostel.name } : null,
    admittedBy: userMap.get(admission.admittedBy) ?? "Unknown",
    admittedAt: admission.admittedAt,
    symptoms: admission.symptoms,
    initialDiagnosis: admission.initialDiagnosis,
    temperature: admission.temperature ? Number(admission.temperature) : null,
    severity: admission.severity,
    status: admission.status,
    treatmentNotes: admission.treatmentNotes,
    dischargedBy: admission.dischargedBy
      ? (userMap.get(admission.dischargedBy) ?? "Unknown")
      : null,
    dischargedAt: admission.dischargedAt,
    dischargeNotes: admission.dischargeNotes,
    referredTo: admission.referredTo,
    parentNotified: admission.parentNotified,
    medications: admission.medications.map((m) => ({
      id: m.id,
      medicationName: m.medicationName,
      dosage: m.dosage,
      administeredBy: userMap.get(m.administeredBy) ?? "Unknown",
      administeredAt: m.administeredAt,
      notes: m.notes,
    })),
  };

  return { data };
}

// ─── Admit to Sick Bay ─────────────────────────────────────────────

export async function admitToSickBayAction(data: {
  studentId: string;
  hostelId: string;
  symptoms: string;
  initialDiagnosis?: string;
  temperature?: number;
  severity: "MILD" | "MODERATE" | "SEVERE" | "EMERGENCY";
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.SICK_BAY_CREATE);
  if (permErr) return permErr;

  const parsed = admitToSickBaySchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  // Get school

  // Generate admission number: SBA/YYYY/NNNN
  const year = new Date().getFullYear();
  const count = await db.sickBayAdmission.count({
    where: {
      admissionNumber: { startsWith: `SBA/${year}/` },
    },
  });
  const admissionNumber = `SBA/${year}/${String(count + 1).padStart(4, "0")}`;

  const admission = await db.sickBayAdmission.create({
    data: {
      schoolId: ctx.schoolId,
      admissionNumber,
      studentId: parsed.data.studentId,
      hostelId: parsed.data.hostelId,
      admittedBy: ctx.session.user.id,
      symptoms: parsed.data.symptoms,
      initialDiagnosis: parsed.data.initialDiagnosis || null,
      temperature: parsed.data.temperature ?? null,
      severity: parsed.data.severity,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "SickBayAdmission",
    entityId: admission.id,
    module: "boarding",
    description: `Admitted student to sick bay ${admissionNumber}`,
    newData: admission,
  });

  dispatch({
    event: NOTIFICATION_EVENTS.SICK_BAY_ADMITTED,
    title: "Student Admitted to Sick Bay",
    message: `A student has been admitted to sick bay with ${parsed.data.severity} severity.`,
    recipients: [],
    schoolId: ctx.schoolId,
  }).catch(() => {});

  return { data: admission };
}

// ─── Update Sick Bay Admission ─────────────────────────────────────

export async function updateSickBayAdmissionAction(
  id: string,
  data: {
    status?: "ADMITTED" | "UNDER_OBSERVATION" | "DISCHARGED" | "REFERRED";
    treatmentNotes?: string;
    parentNotified?: boolean;
  },
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.SICK_BAY_UPDATE);
  if (permErr) return permErr;

  const admission = await db.sickBayAdmission.findUnique({ where: { id } });
  if (!admission) {
    return { error: "Sick bay admission not found." };
  }

  // Validate status transitions
  if (data.status) {
    const validTransitions: Record<string, string[]> = {
      ADMITTED: ["UNDER_OBSERVATION", "DISCHARGED", "REFERRED"],
      UNDER_OBSERVATION: ["ADMITTED", "DISCHARGED", "REFERRED"],
      DISCHARGED: [],
      REFERRED: [],
    };
    const allowed = validTransitions[admission.status] ?? [];
    if (!allowed.includes(data.status)) {
      return {
        error: `Cannot transition from ${admission.status} to ${data.status}.`,
      };
    }
  }

  const updateData: Record<string, unknown> = {};
  if (data.status) updateData.status = data.status;
  if (data.treatmentNotes !== undefined) updateData.treatmentNotes = data.treatmentNotes;
  if (data.parentNotified !== undefined) updateData.parentNotified = data.parentNotified;

  const updated = await db.sickBayAdmission.update({
    where: { id },
    data: updateData,
  });

  return { data: updated };
}

// ─── Discharge from Sick Bay ───────────────────────────────────────

export async function dischargeSickBayAction(id: string, notes?: string) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.SICK_BAY_DISCHARGE);
  if (permErr) return permErr;

  const admission = await db.sickBayAdmission.findUnique({ where: { id } });
  if (!admission) {
    return { error: "Sick bay admission not found." };
  }

  if (admission.status === "DISCHARGED" || admission.status === "REFERRED") {
    return { error: "Admission is already discharged or referred." };
  }

  const updated = await db.sickBayAdmission.update({
    where: { id },
    data: {
      status: "DISCHARGED",
      dischargedBy: ctx.session.user.id,
      dischargedAt: new Date(),
      dischargeNotes: notes || null,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "SickBayAdmission",
    entityId: id,
    module: "boarding",
    description: `Discharged student from sick bay ${admission.admissionNumber}`,
    previousData: { status: admission.status },
    newData: { status: "DISCHARGED" },
  });

  dispatch({
    event: NOTIFICATION_EVENTS.SICK_BAY_DISCHARGED,
    title: "Student Discharged from Sick Bay",
    message: `A student has been discharged from sick bay.`,
    recipients: [],
    schoolId: admission.schoolId,
  }).catch(() => {});

  return { data: updated };
}

// ─── Refer from Sick Bay ───────────────────────────────────────────

export async function referSickBayAction(
  id: string,
  referredTo: string,
  notes?: string,
) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.SICK_BAY_DISCHARGE);
  if (permErr) return permErr;

  const admission = await db.sickBayAdmission.findUnique({ where: { id } });
  if (!admission) {
    return { error: "Sick bay admission not found." };
  }

  if (admission.status === "DISCHARGED" || admission.status === "REFERRED") {
    return { error: "Admission is already discharged or referred." };
  }

  const updated = await db.sickBayAdmission.update({
    where: { id },
    data: {
      status: "REFERRED",
      referredTo,
      dischargeNotes: notes || null,
      dischargedBy: ctx.session.user.id,
      dischargedAt: new Date(),
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "UPDATE",
    entity: "SickBayAdmission",
    entityId: id,
    module: "boarding",
    description: `Referred student from sick bay ${admission.admissionNumber} to ${referredTo}`,
    previousData: { status: admission.status },
    newData: { status: "REFERRED", referredTo },
  });

  dispatch({
    event: NOTIFICATION_EVENTS.SICK_BAY_REFERRED,
    title: "Student Referred to External Facility",
    message: `A student has been referred to ${referredTo}.`,
    recipients: [],
    schoolId: admission.schoolId,
  }).catch(() => {});

  return { data: updated };
}

// ─── Add Medication Log ────────────────────────────────────────────

export async function addMedicationLogAction(data: {
  sickBayAdmissionId: string;
  medicationName: string;
  dosage: string;
  notes?: string;
}) {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.SICK_BAY_UPDATE);
  if (permErr) return permErr;

  const parsed = addMedicationSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  // Verify admission exists
  const admission = await db.sickBayAdmission.findUnique({
    where: { id: parsed.data.sickBayAdmissionId },
  });
  if (!admission) {
    return { error: "Sick bay admission not found." };
  }

  if (admission.status === "DISCHARGED" || admission.status === "REFERRED") {
    return { error: "Cannot add medication to a discharged or referred admission." };
  }

  const medication = await db.medicationLog.create({
    data: {
      schoolId: ctx.schoolId,
      sickBayAdmissionId: parsed.data.sickBayAdmissionId,
      medicationName: parsed.data.medicationName,
      dosage: parsed.data.dosage,
      administeredBy: ctx.session.user.id,
      notes: parsed.data.notes || null,
    },
  });

  await audit({
    userId: ctx.session.user.id,
    action: "CREATE",
    entity: "MedicationLog",
    entityId: medication.id,
    module: "boarding",
    description: `Added medication ${parsed.data.medicationName} for admission ${admission.admissionNumber}`,
    newData: medication,
  });

  return { data: medication };
}

// ─── Sick Bay Stats ────────────────────────────────────────────────

export async function getSickBayStatsAction() {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const permErr = requirePermission(ctx.session, PERMISSIONS.SICK_BAY_READ);
  if (permErr) return permErr;

  const [
    currentlyAdmitted,
    underObservation,
    totalDischarged,
    totalReferred,
    mildCount,
    moderateCount,
    severeCount,
    emergencyCount,
  ] = await Promise.all([
    db.sickBayAdmission.count({ where: { status: "ADMITTED" } }),
    db.sickBayAdmission.count({ where: { status: "UNDER_OBSERVATION" } }),
    db.sickBayAdmission.count({ where: { status: "DISCHARGED" } }),
    db.sickBayAdmission.count({ where: { status: "REFERRED" } }),
    db.sickBayAdmission.count({ where: { severity: "MILD" } }),
    db.sickBayAdmission.count({ where: { severity: "MODERATE" } }),
    db.sickBayAdmission.count({ where: { severity: "SEVERE" } }),
    db.sickBayAdmission.count({ where: { severity: "EMERGENCY" } }),
  ]);

  return {
    data: {
      currentlyAdmitted,
      underObservation,
      totalDischarged,
      totalReferred,
      bySeverity: {
        mild: mildCount,
        moderate: moderateCount,
        severe: severeCount,
        emergency: emergencyCount,
      },
    },
  };
}
