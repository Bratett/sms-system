"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  createStudentSchema,
  updateStudentSchema,
  type CreateStudentInput,
  type UpdateStudentInput,
} from "@/modules/student/schemas/student.schema";

// ─── List Students (paginated, with search & filters) ───────────

export async function getStudentsAction(filters: {
  search?: string;
  classArmId?: string;
  programmeId?: string;
  status?: string;
  gender?: string;
  boardingStatus?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  // Build the where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    schoolId: school.id,
  };

  if (filters.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: "insensitive" } },
      { lastName: { contains: filters.search, mode: "insensitive" } },
      { studentId: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.gender) {
    where.gender = filters.gender;
  }

  if (filters.boardingStatus) {
    where.boardingStatus = filters.boardingStatus;
  }

  if (filters.classArmId) {
    where.enrollments = {
      some: {
        classArmId: filters.classArmId,
        status: "ACTIVE",
      },
    };
  }

  if (filters.programmeId) {
    where.enrollments = {
      some: {
        classArm: {
          class: {
            programmeId: filters.programmeId,
          },
        },
        status: "ACTIVE",
      },
    };
  }

  const [students, total] = await Promise.all([
    db.student.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      include: {
        enrollments: {
          where: { status: "ACTIVE" },
          take: 1,
          orderBy: { enrollmentDate: "desc" },
          include: {
            classArm: {
              include: {
                class: {
                  select: {
                    id: true,
                    name: true,
                    programmeId: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.student.count({ where }),
  ]);

  // Get programme names
  const programmeIds = [
    ...new Set(
      students
        .map((s) => s.enrollments[0]?.classArm?.class?.programmeId)
        .filter(Boolean) as string[],
    ),
  ];

  const programmes =
    programmeIds.length > 0
      ? await db.programme.findMany({
          where: { id: { in: programmeIds } },
          select: { id: true, name: true },
        })
      : [];
  const programmeMap = new Map(programmes.map((p) => [p.id, p.name]));

  const data = students.map((s) => {
    const enrollment = s.enrollments[0];
    const classArm = enrollment?.classArm;
    const cls = classArm?.class;

    return {
      id: s.id,
      studentId: s.studentId,
      firstName: s.firstName,
      lastName: s.lastName,
      otherNames: s.otherNames,
      gender: s.gender,
      dateOfBirth: s.dateOfBirth,
      boardingStatus: s.boardingStatus,
      status: s.status,
      photoUrl: s.photoUrl,
      className: cls?.name ?? null,
      classArmName: classArm ? `${cls?.name ?? ""} ${classArm.name}` : null,
      programmeName: cls?.programmeId ? (programmeMap.get(cls.programmeId) ?? null) : null,
      createdAt: s.createdAt,
    };
  });

  return { students: data, total, page, pageSize };
}

// ─── Single Student Profile ─────────────────────────────────────

export async function getStudentAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const student = await db.student.findUnique({
    where: { id },
    include: {
      guardians: {
        include: {
          guardian: true,
        },
      },
      enrollments: {
        orderBy: { enrollmentDate: "desc" },
        include: {
          classArm: {
            include: {
              class: {
                select: {
                  id: true,
                  name: true,
                  yearGroup: true,
                  programmeId: true,
                  academicYearId: true,
                },
              },
            },
          },
        },
      },
      houseAssignment: true,
    },
  });

  if (!student) {
    return { error: "Student not found." };
  }

  // Get programme + academic year names for enrollments
  const programmeIds = [
    ...new Set(
      student.enrollments.map((e) => e.classArm?.class?.programmeId).filter(Boolean) as string[],
    ),
  ];
  const academicYearIds = [
    ...new Set(
      student.enrollments.map((e) => e.classArm?.class?.academicYearId).filter(Boolean) as string[],
    ),
  ];

  const [programmes, academicYears] = await Promise.all([
    programmeIds.length > 0
      ? db.programme.findMany({
          where: { id: { in: programmeIds } },
          select: { id: true, name: true },
        })
      : [],
    academicYearIds.length > 0
      ? db.academicYear.findMany({
          where: { id: { in: academicYearIds } },
          select: { id: true, name: true },
        })
      : [],
  ]);

  const programmeMap = new Map(programmes.map((p) => [p.id, p.name]));
  const academicYearMap = new Map(academicYears.map((ay) => [ay.id, ay.name]));

  return {
    data: {
      id: student.id,
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      otherNames: student.otherNames,
      dateOfBirth: student.dateOfBirth,
      gender: student.gender,
      nationality: student.nationality,
      hometown: student.hometown,
      region: student.region,
      religion: student.religion,
      bloodGroup: student.bloodGroup,
      medicalConditions: student.medicalConditions,
      allergies: student.allergies,
      photoUrl: student.photoUrl,
      boardingStatus: student.boardingStatus,
      status: student.status,
      enrollmentDate: student.enrollmentDate,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
      guardians: student.guardians.map((sg) => ({
        id: sg.guardian.id,
        firstName: sg.guardian.firstName,
        lastName: sg.guardian.lastName,
        phone: sg.guardian.phone,
        altPhone: sg.guardian.altPhone,
        email: sg.guardian.email,
        occupation: sg.guardian.occupation,
        address: sg.guardian.address,
        relationship: sg.guardian.relationship,
        isPrimary: sg.isPrimary,
      })),
      enrollments: student.enrollments.map((e) => ({
        id: e.id,
        classArmId: e.classArmId,
        classArmName: e.classArm
          ? `${e.classArm.class?.name ?? ""} ${e.classArm.name}`
          : null,
        className: e.classArm?.class?.name ?? null,
        yearGroup: e.classArm?.class?.yearGroup ?? null,
        programmeName: e.classArm?.class?.programmeId
          ? (programmeMap.get(e.classArm.class.programmeId) ?? null)
          : null,
        academicYearName: e.classArm?.class?.academicYearId
          ? (academicYearMap.get(e.classArm.class.academicYearId) ?? null)
          : null,
        enrollmentDate: e.enrollmentDate,
        status: e.status,
      })),
      houseAssignment: student.houseAssignment
        ? {
            id: student.houseAssignment.id,
            houseId: student.houseAssignment.houseId,
          }
        : null,
    },
  };
}

// ─── Create Student ─────────────────────────────────────────────

export async function createStudentAction(data: CreateStudentInput) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const parsed = createStudentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  // Auto-generate student ID: SCH/YYYY/NNNN
  const year = new Date().getFullYear();
  const count = await db.student.count({ where: { schoolId: school.id } });
  const studentId = `SCH/${year}/${String(count + 1).padStart(4, "0")}`;

  const student = await db.student.create({
    data: {
      schoolId: school.id,
      studentId,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      otherNames: parsed.data.otherNames || null,
      dateOfBirth: new Date(parsed.data.dateOfBirth),
      gender: parsed.data.gender,
      nationality: parsed.data.nationality || "Ghanaian",
      hometown: parsed.data.hometown || null,
      region: parsed.data.region || null,
      religion: parsed.data.religion || null,
      bloodGroup: parsed.data.bloodGroup || null,
      medicalConditions: parsed.data.medicalConditions || null,
      allergies: parsed.data.allergies || null,
      boardingStatus: parsed.data.boardingStatus,
    },
  });

  // If classArmId provided, create enrollment
  if (parsed.data.classArmId) {
    // Get the academic year from the class arm
    const classArm = await db.classArm.findUnique({
      where: { id: parsed.data.classArmId },
      include: { class: { select: { academicYearId: true } } },
    });

    if (classArm) {
      await db.enrollment.create({
        data: {
          studentId: student.id,
          classArmId: parsed.data.classArmId,
          academicYearId: classArm.class.academicYearId,
        },
      });
    }
  }

  await audit({
    userId: session.user.id!,
    action: "CREATE",
    entity: "Student",
    entityId: student.id,
    module: "student",
    description: `Registered student "${student.firstName} ${student.lastName}" (${studentId})`,
    newData: student,
  });

  return { data: student };
}

// ─── Update Student ─────────────────────────────────────────────

export async function updateStudentAction(id: string, data: UpdateStudentInput) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const parsed = updateStudentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.student.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Student not found." };
  }

  const previousData = { ...existing };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {};
  if (parsed.data.firstName !== undefined) updateData.firstName = parsed.data.firstName;
  if (parsed.data.lastName !== undefined) updateData.lastName = parsed.data.lastName;
  if (parsed.data.otherNames !== undefined) updateData.otherNames = parsed.data.otherNames || null;
  if (parsed.data.dateOfBirth !== undefined)
    updateData.dateOfBirth = new Date(parsed.data.dateOfBirth);
  if (parsed.data.gender !== undefined) updateData.gender = parsed.data.gender;
  if (parsed.data.nationality !== undefined)
    updateData.nationality = parsed.data.nationality || null;
  if (parsed.data.hometown !== undefined) updateData.hometown = parsed.data.hometown || null;
  if (parsed.data.region !== undefined) updateData.region = parsed.data.region || null;
  if (parsed.data.religion !== undefined) updateData.religion = parsed.data.religion || null;
  if (parsed.data.bloodGroup !== undefined) updateData.bloodGroup = parsed.data.bloodGroup || null;
  if (parsed.data.medicalConditions !== undefined)
    updateData.medicalConditions = parsed.data.medicalConditions || null;
  if (parsed.data.allergies !== undefined) updateData.allergies = parsed.data.allergies || null;
  if (parsed.data.boardingStatus !== undefined)
    updateData.boardingStatus = parsed.data.boardingStatus;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;

  const updated = await db.student.update({
    where: { id },
    data: updateData,
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Student",
    entityId: id,
    module: "student",
    description: `Updated student "${updated.firstName} ${updated.lastName}"`,
    previousData,
    newData: updated,
  });

  return { data: updated };
}

// ─── Delete (Soft) ──────────────────────────────────────────────

export async function deleteStudentAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const existing = await db.student.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Student not found." };
  }

  const previousData = { ...existing };

  const updated = await db.student.update({
    where: { id },
    data: { status: "WITHDRAWN" },
  });

  // Also deactivate active enrollments
  await db.enrollment.updateMany({
    where: { studentId: id, status: "ACTIVE" },
    data: { status: "WITHDRAWN" },
  });

  await audit({
    userId: session.user.id!,
    action: "UPDATE",
    entity: "Student",
    entityId: id,
    module: "student",
    description: `Withdrew student "${existing.firstName} ${existing.lastName}" (${existing.studentId})`,
    previousData,
    newData: updated,
  });

  return { success: true };
}

// ─── Enroll Student ─────────────────────────────────────────────

export async function enrollStudentAction(
  studentId: string,
  classArmId: string,
  academicYearId: string,
) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student) {
    return { error: "Student not found." };
  }

  // Check if there is already an enrollment for this student + academic year
  const existingEnrollment = await db.enrollment.findUnique({
    where: {
      studentId_academicYearId: {
        studentId,
        academicYearId,
      },
    },
  });

  if (existingEnrollment) {
    // Update existing enrollment
    const previousData = { ...existingEnrollment };
    const updated = await db.enrollment.update({
      where: { id: existingEnrollment.id },
      data: {
        classArmId,
        previousClassArmId: existingEnrollment.classArmId,
        status: "ACTIVE",
      },
    });

    await audit({
      userId: session.user.id!,
      action: "UPDATE",
      entity: "Enrollment",
      entityId: updated.id,
      module: "student",
      description: `Updated enrollment for student "${student.firstName} ${student.lastName}"`,
      previousData,
      newData: updated,
    });

    return { data: updated };
  } else {
    // Create new enrollment
    const enrollment = await db.enrollment.create({
      data: {
        studentId,
        classArmId,
        academicYearId,
      },
    });

    await audit({
      userId: session.user.id!,
      action: "CREATE",
      entity: "Enrollment",
      entityId: enrollment.id,
      module: "student",
      description: `Enrolled student "${student.firstName} ${student.lastName}"`,
      newData: enrollment,
    });

    return { data: enrollment };
  }
}

// ─── Student Stats ──────────────────────────────────────────────

export async function getStudentStatsAction() {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const [
    total,
    active,
    suspended,
    withdrawn,
    male,
    female,
    day,
    boarding,
  ] = await Promise.all([
    db.student.count({ where: { schoolId: school.id } }),
    db.student.count({ where: { schoolId: school.id, status: "ACTIVE" } }),
    db.student.count({ where: { schoolId: school.id, status: "SUSPENDED" } }),
    db.student.count({ where: { schoolId: school.id, status: "WITHDRAWN" } }),
    db.student.count({ where: { schoolId: school.id, gender: "MALE", status: "ACTIVE" } }),
    db.student.count({ where: { schoolId: school.id, gender: "FEMALE", status: "ACTIVE" } }),
    db.student.count({ where: { schoolId: school.id, boardingStatus: "DAY", status: "ACTIVE" } }),
    db.student.count({
      where: { schoolId: school.id, boardingStatus: "BOARDING", status: "ACTIVE" },
    }),
  ]);

  return {
    data: {
      total,
      byStatus: { active, suspended, withdrawn },
      byGender: { male, female },
      byBoardingStatus: { day, boarding },
    },
  };
}
