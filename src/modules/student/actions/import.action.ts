"use server";

import { db } from "@/lib/db";
import { requireSchoolContext } from "@/lib/auth-context";
import { PERMISSIONS, assertPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

interface ImportError {
  row: number;
  message: string;
}

interface ImportResult {
  imported: number;
  errors: ImportError[];
}

export async function importStudentsAction(
  rows: Array<Record<string, string>>
): Promise<{ data?: ImportResult; error?: string }> {
  const ctx = await requireSchoolContext();
  if ("error" in ctx) return ctx;
  const denied = assertPermission(ctx.session, PERMISSIONS.STUDENTS_IMPORT);
  if (denied) return denied;

  const academicYear = await db.academicYear.findFirst({
    where: { isCurrent: true },
  });

  if (!academicYear) {
    return { error: "No active academic year. Please set a current academic year first." };
  }

  // Pre-fetch class arms for matching by name
  const classArms = await db.classArm.findMany({
    where: {
      status: "ACTIVE",
      class: { schoolId: ctx.schoolId },
    },
    include: {
      class: { select: { name: true } },
    },
  });

  const classArmMap = new Map<string, string>();
  for (const ca of classArms) {
    // Map multiple formats: "SHS 1 Science - A", "SHS 1 Science A", class arm id
    classArmMap.set(ca.id, ca.id);
    classArmMap.set(`${ca.class.name} - ${ca.name}`.toLowerCase(), ca.id);
    classArmMap.set(`${ca.class.name} ${ca.name}`.toLowerCase(), ca.id);
    classArmMap.set(`${ca.class.name}${ca.name}`.toLowerCase(), ca.id);
  }

  const errors: ImportError[] = [];
  let imported = 0;

  // Get current student count for ID generation
  let studentCount = await db.student.count({
    where: { schoolId: ctx.schoolId },
  });
  const year = new Date().getFullYear();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // +2 because row 1 is headers, and we're 1-indexed

    // Normalize keys (trim whitespace, lowercase for matching)
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key.trim().toLowerCase().replace(/\s+/g, "")] = (value ?? "").trim();
    }

    // Extract fields with flexible key matching
    const firstName =
      normalized["firstname"] || normalized["first_name"] || normalized["first name"] || "";
    const lastName =
      normalized["lastname"] || normalized["last_name"] || normalized["last name"] || "";
    const otherNames =
      normalized["othernames"] || normalized["other_names"] || normalized["other names"] || "";
    const dateOfBirth =
      normalized["dateofbirth"] || normalized["date_of_birth"] || normalized["dob"] || "";
    const gender =
      normalized["gender"] || normalized["sex"] || "";
    const boardingStatus =
      normalized["boardingstatus"] || normalized["boarding_status"] || normalized["boarding"] || "";
    const className =
      normalized["classarm"] || normalized["class_arm"] || normalized["class"] || normalized["classarmid"] || "";

    // Guardian fields
    const guardianName =
      normalized["guardianname"] || normalized["guardian_name"] || normalized["parentname"] || normalized["parent_name"] || "";
    const guardianPhone =
      normalized["guardianphone"] || normalized["guardian_phone"] || normalized["parentphone"] || normalized["parent_phone"] || "";
    const guardianEmail =
      normalized["guardianemail"] || normalized["guardian_email"] || "";
    const guardianRelationship =
      normalized["guardianrelationship"] || normalized["guardian_relationship"] || normalized["relationship"] || "";
    const guardianAddress =
      normalized["guardianaddress"] || normalized["guardian_address"] || "";
    const guardianOccupation =
      normalized["guardianoccupation"] || normalized["guardian_occupation"] || "";

    // Validate required fields
    if (!firstName) {
      errors.push({ row: rowNumber, message: "First name is required." });
      continue;
    }
    if (!lastName) {
      errors.push({ row: rowNumber, message: "Last name is required." });
      continue;
    }
    if (!dateOfBirth) {
      errors.push({ row: rowNumber, message: "Date of birth is required." });
      continue;
    }
    if (!gender) {
      errors.push({ row: rowNumber, message: "Gender is required." });
      continue;
    }

    // Parse and validate gender
    const genderUpper = gender.toUpperCase();
    let parsedGender: "MALE" | "FEMALE";
    if (genderUpper === "MALE" || genderUpper === "M") {
      parsedGender = "MALE";
    } else if (genderUpper === "FEMALE" || genderUpper === "F") {
      parsedGender = "FEMALE";
    } else {
      errors.push({ row: rowNumber, message: `Invalid gender "${gender}". Use MALE/M or FEMALE/F.` });
      continue;
    }

    // Parse date of birth
    let parsedDob: Date;
    try {
      parsedDob = new Date(dateOfBirth);
      if (isNaN(parsedDob.getTime())) {
        throw new Error("Invalid date");
      }
    } catch {
      errors.push({ row: rowNumber, message: `Invalid date of birth "${dateOfBirth}". Use YYYY-MM-DD format.` });
      continue;
    }

    // Parse boarding status
    let parsedBoarding: "DAY" | "BOARDING" = "DAY";
    if (boardingStatus) {
      const bUpper = boardingStatus.toUpperCase();
      if (bUpper === "BOARDING" || bUpper === "B") {
        parsedBoarding = "BOARDING";
      } else if (bUpper === "DAY" || bUpper === "D") {
        parsedBoarding = "DAY";
      }
    }

    // Resolve class arm ID
    let classArmId: string | null = null;
    if (className) {
      classArmId = classArmMap.get(className.toLowerCase()) || classArmMap.get(className) || null;
      if (!classArmId) {
        errors.push({ row: rowNumber, message: `Class arm "${className}" not found.` });
        continue;
      }
    }

    try {
      studentCount++;
      const studentId = `STU/${year}/${String(studentCount).padStart(4, "0")}`;

      await db.$transaction(async (tx) => {
        // Create Student
        const student = await tx.student.create({
          data: {
            schoolId: ctx.schoolId,
            studentId,
            firstName,
            lastName,
            otherNames: otherNames || null,
            dateOfBirth: parsedDob,
            gender: parsedGender,
            boardingStatus: parsedBoarding,
            status: "ACTIVE",
          },
        });

        // Create Guardian if guardian fields present
        if (guardianName && guardianPhone) {
          const nameParts = guardianName.trim().split(/\s+/);
          const gFirstName = nameParts[0] || guardianName;
          const gLastName = nameParts.slice(1).join(" ") || guardianName;

          const guardian = await tx.guardian.create({
            data: {
              schoolId: ctx.schoolId,
              firstName: gFirstName,
              lastName: gLastName,
              phone: guardianPhone,
              email: guardianEmail || null,
              occupation: guardianOccupation || null,
              address: guardianAddress || null,
              relationship: guardianRelationship || null,
            },
          });

          await tx.studentGuardian.create({
            data: {
              schoolId: ctx.schoolId,
              studentId: student.id,
              guardianId: guardian.id,
              isPrimary: true,
            },
          });
        }

        // Create Enrollment if class arm present
        if (classArmId) {
          await tx.enrollment.create({
            data: {
              schoolId: ctx.schoolId,
              studentId: student.id,
              classArmId,
              academicYearId: academicYear.id,
              status: "ACTIVE",
            },
          });
        }
      });

      imported++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push({ row: rowNumber, message: `Database error: ${message}` });
    }
  }

  await audit({
    userId: ctx.session.user.id!,
    action: "CREATE",
    entity: "Student",
    module: "student",
    description: `Bulk imported ${imported} students from CSV. ${errors.length} errors.`,
    metadata: {
      totalRows: rows.length,
      imported,
      errorCount: errors.length,
    },
  });

  return { data: { imported, errors } };
}
