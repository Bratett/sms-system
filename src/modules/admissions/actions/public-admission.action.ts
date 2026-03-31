"use server";

import { db } from "@/lib/db";
import {
  publicApplicationSchema,
  statusCheckSchema,
  type PublicApplicationInput,
  type StatusCheckInput,
} from "@/modules/admissions/schemas/admission.schema";

/**
 * Submit an admission application from the public portal.
 * No authentication required — this is a public-facing action.
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

  // Generate application number
  const year = new Date().getFullYear();
  const count = await db.admissionApplication.count({
    where: { schoolId: school.id },
  });
  const applicationNumber = `APP/${year}/${String(count + 1).padStart(4, "0")}`;

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
    },
  });

  return {
    data: {
      applicationNumber: application.applicationNumber,
      firstName: application.firstName,
      lastName: application.lastName,
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
