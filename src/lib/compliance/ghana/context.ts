import { db } from "@/lib/db";
import type { EmployerContext, MissingIdentifier } from "./types";

/**
 * Load the statutory identifiers every return depends on and flag any that
 * are required for a given return but missing. Generators call `requireIds`
 * with the list of identifiers they need; callers surface the result to the
 * admin before attempting to file so the error is actionable.
 */

export async function loadEmployerContext(
  schoolId: string,
): Promise<EmployerContext | null> {
  const school = await db.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      name: true,
      tin: true,
      ssnitEmployerNumber: true,
      getFundCode: true,
      graVatTin: true,
      ghanaEducationServiceCode: true,
    },
  });
  if (!school) return null;
  return {
    schoolId: school.id,
    schoolName: school.name,
    tin: school.tin,
    ssnitEmployerNumber: school.ssnitEmployerNumber,
    getFundCode: school.getFundCode,
    graVatTin: school.graVatTin,
    ghanaEducationServiceCode: school.ghanaEducationServiceCode,
  };
}

export function missingIdentifiers(
  employer: EmployerContext,
  required: (keyof EmployerContext)[],
): MissingIdentifier[] {
  const issues: MissingIdentifier[] = [];
  for (const field of required) {
    if (!employer[field]) {
      issues.push({
        field,
        reason: `Missing "${String(field)}" — set it in School settings before generating this return.`,
      });
    }
  }
  return issues;
}
