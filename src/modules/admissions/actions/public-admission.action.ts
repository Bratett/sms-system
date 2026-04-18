"use server";

import { db } from "@/lib/db";
import {
  publicApplicationSchema,
  statusCheckSchema,
  type PublicApplicationInput,
  type StatusCheckInput,
} from "@/modules/admissions/schemas/admission.schema";
import { FREE_SHS_FEE_WAIVER_REASON } from "@/modules/admissions/constants";
import { validatePlacement } from "@/modules/admissions/services/placement-validation.service";

/**
 * Submit an admission application from the public portal.
 * No authentication required — this is a public-facing action.
 *
 * @no-audit Applicant is not yet a user; the AdmissionApplication row itself
 * (with applicationNumber, createdAt, status) is the primary audit artefact.
 * Internal admission actions (accept/reject) are audited by their own callers.
 */
export async function submitPublicApplicationAction(input: PublicApplicationInput) {
  const parsed = publicApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  // Get current academic year
  const academicYear = await db.academicYear.findFirst({
    where: { isCurrent: true },
  });

  if (!academicYear) {
    return { error: "Admissions are currently closed. No active academic year." };
  }

  const data = parsed.data;

  // --- Duplicate detection ---
  const duplicateWhere: Record<string, unknown> = {
    schoolId: school.id,
    academicYearId: academicYear.id,
    firstName: { equals: data.firstName, mode: "insensitive" },
    lastName: { equals: data.lastName, mode: "insensitive" },
    dateOfBirth: new Date(data.dateOfBirth),
    guardianPhone: data.guardianPhone,
  };

  const existingApplication = await db.admissionApplication.findFirst({
    where: duplicateWhere,
  });

  if (existingApplication) {
    return {
      error: `A similar application already exists (Ref: ${existingApplication.applicationNumber}). Please use the status checker to track your existing application.`,
    };
  }

  // For placement applications, also check BECE index uniqueness
  if (data.applicationType === "PLACEMENT" && data.beceIndexNumber) {
    const existingBece = await db.admissionApplication.findFirst({
      where: {
        schoolId: school.id,
        academicYearId: academicYear.id,
        beceIndexNumber: data.beceIndexNumber.trim(),
      },
    });

    if (existingBece) {
      return {
        error: "An application with this BECE Index Number already exists for this academic year.",
      };
    }
  }

  // Placement-specific validation (format, duplicate enrollment code).
  // Staff verification happens in Phase 3 and flips `placementVerified`.
  let placementWarnings: string[] = [];
  const isPlacement = data.applicationType === "PLACEMENT";
  if (isPlacement) {
    const result = await validatePlacement({
      enrollmentCode: data.enrollmentCode,
      beceIndexNumber: data.beceIndexNumber,
      schoolId: school.id,
      academicYearId: academicYear.id,
    });
    if (!result.valid) {
      return { error: result.errors.join(" ") };
    }
    placementWarnings = result.warnings;
  }

  // Generate application number
  const year = new Date().getFullYear();
  const count = await db.admissionApplication.count({
    where: { schoolId: school.id },
  });
  const applicationNumber = `APP/${year}/${String(count + 1).padStart(4, "0")}`;

  // Free SHS: placement applications skip the application fee on submit.
  // Staff may revoke this during verification if the placement turns out invalid.
  const feeWaived = isPlacement;

  const application = await db.admissionApplication.create({
    data: {
      schoolId: school.id,
      academicYearId: academicYear.id,
      applicationNumber,
      firstName: data.firstName,
      lastName: data.lastName,
      otherNames: data.otherNames || null,
      dateOfBirth: new Date(data.dateOfBirth),
      gender: data.gender,
      previousSchool: data.previousSchool || null,
      jhsIndexNumber: data.jhsIndexNumber || null,
      jhsAggregate: data.jhsAggregate ?? null,
      programmePreference1Id: data.programmePreference1Id || null,
      programmePreference2Id: data.programmePreference2Id || null,
      guardianName: data.guardianName,
      guardianPhone: data.guardianPhone,
      guardianEmail: data.guardianEmail || null,
      guardianRelationship: data.guardianRelationship || null,
      guardianAddress: data.guardianAddress || null,
      guardianOccupation: data.guardianOccupation || null,
      boardingStatus: data.boardingStatus,
      applicationType: data.applicationType,
      applicationSource: "PORTAL",
      beceIndexNumber: data.beceIndexNumber?.trim() || null,
      enrollmentCode: data.enrollmentCode?.trim() || null,
      placementSchoolCode: data.placementSchoolCode?.trim() || null,
      notes: data.notes || null,
      status: "SUBMITTED",
      applicationFeeRequired: !feeWaived,
      applicationFeePaid: feeWaived,
      feeWaivedReason: feeWaived ? FREE_SHS_FEE_WAIVER_REASON : null,
    },
  });

  return {
    data: {
      applicationNumber: application.applicationNumber,
      firstName: application.firstName,
      lastName: application.lastName,
      feeWaived,
      warnings: placementWarnings,
    },
  };
}

/**
 * Pre-submit placement verification probe for the public form.
 * Read-only: runs the same validation the submit action performs but without
 * creating an application, so the UI can show a green "Placement verified" banner.
 */
export async function verifyPlacementAction(input: {
  enrollmentCode: string;
  beceIndexNumber: string;
}) {
  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const academicYear = await db.academicYear.findFirst({ where: { isCurrent: true } });
  if (!academicYear) return { error: "Admissions are currently closed." };

  const result = await validatePlacement({
    enrollmentCode: input.enrollmentCode,
    beceIndexNumber: input.beceIndexNumber,
    schoolId: school.id,
    academicYearId: academicYear.id,
  });

  return {
    data: {
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
    },
  };
}

/**
 * Check application status from the public portal.
 * Requires both application number and guardian phone to prevent enumeration.
 */
export async function checkApplicationStatusAction(input: StatusCheckInput) {
  const parsed = statusCheckSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input", details: parsed.error.flatten().fieldErrors };
  }

  const application = await db.admissionApplication.findFirst({
    where: {
      applicationNumber: parsed.data.applicationNumber.trim().toUpperCase(),
      guardianPhone: parsed.data.guardianPhone.trim(),
    },
    select: {
      applicationNumber: true,
      firstName: true,
      lastName: true,
      status: true,
      submittedAt: true,
      reviewedAt: true,
    },
  });

  if (!application) {
    return { error: "No application found. Please verify your application number and guardian phone number." };
  }

  return { data: application };
}

/**
 * Get active programmes for the public application form.
 * No authentication required.
 */
export async function getPublicProgrammesAction() {
  const school = await db.school.findFirst();
  if (!school) {
    return { error: "No school configured" };
  }

  const programmes = await db.programme.findMany({
    where: { schoolId: school.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return { data: programmes };
}

/**
 * Check if admissions are currently open (active academic year exists).
 */
export async function checkAdmissionsOpenAction() {
  const school = await db.school.findFirst({
    select: { id: true, name: true },
  });

  if (!school) {
    return { data: { isOpen: false, schoolName: "" } };
  }

  const academicYear = await db.academicYear.findFirst({
    where: { isCurrent: true },
    select: { id: true, name: true },
  });

  return {
    data: {
      isOpen: !!academicYear,
      schoolName: school.name,
      academicYearName: academicYear?.name ?? null,
    },
  };
}
