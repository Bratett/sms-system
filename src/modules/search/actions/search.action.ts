"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
interface SearchResultStudent {
  id: string;
  studentId: string;
  name: string;
  class: string | null;
  status: string;
}

interface SearchResultStaff {
  id: string;
  staffId: string;
  name: string;
  type: string;
  status: string;
}

interface SearchResultSubject {
  id: string;
  name: string;
  code: string | null;
}

interface SearchResultItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
}

export interface GlobalSearchResult {
  students: SearchResultStudent[];
  staff: SearchResultStaff[];
  subjects: SearchResultSubject[];
  items: SearchResultItem[];
}

export async function globalSearchAction(
  query: string,
  limit = 5,
): Promise<GlobalSearchResult | { error: string }> {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.SCHOOL_SETTINGS_READ);
  if (denied) return denied;

  if (!query || query.trim().length < 2) {
    return { students: [], staff: [], subjects: [], items: [] };
  }

  const searchTerm = query.trim();

  const [students, staff, subjects, storeItems] = await Promise.all([
    // Students: search firstName, lastName, studentId
    db.student.findMany({
      where: {
        schoolId: ctx.schoolId,
        OR: [
          { firstName: { contains: searchTerm, mode: "insensitive" } },
          { lastName: { contains: searchTerm, mode: "insensitive" } },
          { studentId: { contains: searchTerm, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        status: true,
        enrollments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            classArm: {
              select: {
                name: true,
                class: { select: { name: true } },
              },
            },
          },
        },
      },
      take: limit,
    }),

    // Staff: search firstName, lastName, staffId
    db.staff.findMany({
      where: {
        schoolId: ctx.schoolId,
        OR: [
          { firstName: { contains: searchTerm, mode: "insensitive" } },
          { lastName: { contains: searchTerm, mode: "insensitive" } },
          { staffId: { contains: searchTerm, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        staffId: true,
        firstName: true,
        lastName: true,
        staffType: true,
        status: true,
      },
      take: limit,
    }),

    // Subjects: search name, code
    db.subject.findMany({
      where: {
        schoolId: ctx.schoolId,
        OR: [
          { name: { contains: searchTerm, mode: "insensitive" } },
          { code: { contains: searchTerm, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
      take: limit,
    }),

    // Store Items: search name
    db.storeItem.findMany({
      where: {
        store: { schoolId: ctx.schoolId },
        name: { contains: searchTerm, mode: "insensitive" },
      },
      select: {
        id: true,
        name: true,
        quantity: true,
        category: { select: { name: true } },
      },
      take: limit,
    }),
  ]);

  return {
    students: students.map((s) => {
      const enrollment = s.enrollments[0];
      const className = enrollment
        ? `${enrollment.classArm.class.name} ${enrollment.classArm.name}`
        : null;
      return {
        id: s.id,
        studentId: s.studentId,
        name: `${s.firstName} ${s.lastName}`,
        class: className,
        status: s.status,
      };
    }),
    staff: staff.map((s) => ({
      id: s.id,
      staffId: s.staffId,
      name: `${s.firstName} ${s.lastName}`,
      type: s.staffType,
      status: s.status,
    })),
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
    })),
    items: storeItems.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category?.name ?? null,
      quantity: i.quantity,
    })),
  };
}
