import { db } from "@/lib/db";

export interface CapacityResult {
  totalCapacity: number;
  enrolled: number;
  available: number;
  hasCapacity: boolean;
}

/**
 * Aggregate capacity across every ClassArm in a given academic year.
 * Used when an applicant has not yet been placed into a specific programme.
 *
 * Enrolled count is active `Enrollment` rows for that academic year at this school.
 */
export async function checkAcademicYearCapacity(opts: {
  schoolId: string;
  academicYearId: string;
}): Promise<CapacityResult> {
  const [arms, enrolled] = await Promise.all([
    db.classArm.findMany({
      where: {
        schoolId: opts.schoolId,
        class: { academicYearId: opts.academicYearId },
        status: "ACTIVE",
      },
      select: { capacity: true },
    }),
    db.enrollment.count({
      where: {
        schoolId: opts.schoolId,
        academicYearId: opts.academicYearId,
        status: "ACTIVE",
      },
    }),
  ]);

  const totalCapacity = arms.reduce((sum, a) => sum + a.capacity, 0);
  const available = Math.max(0, totalCapacity - enrolled);
  return { totalCapacity, enrolled, available, hasCapacity: available > 0 };
}

/**
 * Aggregate capacity across ClassArms belonging to a specific Programme within
 * an academic year. Use this once the applicant has picked a programme preference
 * (or for placement students whose CSSPS programme is known).
 */
export async function checkProgrammeCapacity(opts: {
  schoolId: string;
  academicYearId: string;
  programmeId: string;
}): Promise<CapacityResult> {
  const [arms, enrolled] = await Promise.all([
    db.classArm.findMany({
      where: {
        schoolId: opts.schoolId,
        status: "ACTIVE",
        class: {
          academicYearId: opts.academicYearId,
          programmeId: opts.programmeId,
        },
      },
      select: { id: true, capacity: true },
    }),
    db.enrollment.count({
      where: {
        schoolId: opts.schoolId,
        academicYearId: opts.academicYearId,
        status: "ACTIVE",
        classArm: {
          class: { programmeId: opts.programmeId },
        },
      },
    }),
  ]);

  const totalCapacity = arms.reduce((sum, a) => sum + a.capacity, 0);
  const available = Math.max(0, totalCapacity - enrolled);
  return { totalCapacity, enrolled, available, hasCapacity: available > 0 };
}

/**
 * Boarding capacity scoped to a gender (houses are gender-restricted).
 * Occupancy is the count of ACTIVE `BedAllocation` rows on beds inside
 * dormitories of hostels matching the gender at this school.
 */
export async function checkBoardingCapacity(opts: {
  schoolId: string;
  gender: "MALE" | "FEMALE";
}): Promise<CapacityResult> {
  const hostels = await db.hostel.findMany({
    where: { schoolId: opts.schoolId, gender: opts.gender, status: "ACTIVE" },
    select: { id: true, capacity: true },
  });

  const totalCapacity = hostels.reduce((sum, h) => sum + h.capacity, 0);
  if (totalCapacity === 0) {
    return { totalCapacity: 0, enrolled: 0, available: 0, hasCapacity: false };
  }

  const enrolled = await db.bedAllocation.count({
    where: {
      schoolId: opts.schoolId,
      status: "ACTIVE",
      bed: { dormitory: { hostel: { gender: opts.gender } } },
    },
  });

  const available = Math.max(0, totalCapacity - enrolled);
  return { totalCapacity, enrolled, available, hasCapacity: available > 0 };
}
