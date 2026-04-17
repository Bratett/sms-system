/**
 * Smoke Test Verification Script
 *
 * Runs against the actual database to verify core functionality after deployment.
 * Usage: npx tsx tests/smoke/verify.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface CheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

const results: CheckResult[] = [];

function record(name: string, passed: boolean, detail?: string) {
  results.push({ name, passed, detail });
  const icon = passed ? "PASS" : "FAIL";
  const suffix = detail ? ` (${detail})` : "";
  console.log(`  [${icon}] ${name}${suffix}`);
}

async function checkDatabaseConnectivity() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    record("Database connectivity", true);
  } catch (err) {
    record("Database connectivity", false, String(err));
  }
}

async function checkSchoolExists() {
  try {
    const school = await prisma.school.findFirst();
    record("School exists", !!school, school ? school.name : "No school found");
  } catch (err) {
    record("School exists", false, String(err));
  }
}

async function checkAdminUserExists() {
  try {
    const admin = await prisma.userRole.findFirst({
      where: { role: { name: "super_admin" } },
      include: { user: { select: { email: true } }, role: { select: { name: true } } },
    });
    record(
      "Admin user exists with super_admin role",
      !!admin,
      admin ? admin.user.email : "No super_admin found",
    );
  } catch (err) {
    record("Admin user exists with super_admin role", false, String(err));
  }
}

async function checkRolePermissions() {
  try {
    const roles = await prisma.role.findMany({
      include: { _count: { select: { rolePermissions: true } } },
    });
    const rolesWithPermissions = roles.filter((r) => r._count.rolePermissions > 0);
    const allHavePermissions = roles.length >= 15 && rolesWithPermissions.length >= 15;
    record(
      "All 15 roles have permissions assigned",
      allHavePermissions,
      `${rolesWithPermissions.length}/${roles.length} roles have permissions`,
    );
  } catch (err) {
    record("All 15 roles have permissions assigned", false, String(err));
  }
}

async function checkPermissionsCount() {
  try {
    const count = await prisma.permission.count();
    record("156 permissions exist", count === 156, `Found ${count} permissions`);
  } catch (err) {
    record("156 permissions exist", false, String(err));
  }
}

async function checkGradingScale() {
  try {
    const grades = await prisma.gradeDefinition.findMany();
    record(
      "Grading scale has 9 grade definitions (A1-F9)",
      grades.length === 9,
      `Found ${grades.length} grade definitions`,
    );
  } catch (err) {
    record("Grading scale has 9 grade definitions (A1-F9)", false, String(err));
  }
}

async function checkPrismaModels() {
  const models: [string, { count: () => Promise<number> }][] = [
    ["Student", prisma.student],
    ["Staff", prisma.staff],
    ["Class", prisma.class],
    ["Subject", prisma.subject],
    ["Payment", prisma.payment],
    ["Hostel", prisma.hostel],
    ["StoreItem", prisma.storeItem],
    ["Announcement", prisma.announcement],
    ["DisciplinaryIncident", prisma.disciplinaryIncident],
    ["GraduationBatch", prisma.graduationBatch],
    ["Notification", prisma.notification],
    ["AuditLog", prisma.auditLog],
    ["Transcript", prisma.transcript],
    ["Document", prisma.document],
    ["CounselingRecord", prisma.counselingRecord],
    ["WelfareNote", prisma.welfareNote],
    ["Commendation", prisma.commendation],
    ["MedicalRecord", prisma.medicalRecord],
    ["AlumniProfile", prisma.alumniProfile],
    ["Room", prisma.room],
    ["Period", prisma.period],
    ["ExamSchedule", prisma.examSchedule],
    ["PromotionRule", prisma.promotionRule],
    ["StaffDisciplinary", prisma.staffDisciplinary],
    ["PerformanceNote", prisma.performanceNote],
  ];

  for (const [name, model] of models) {
    try {
      const count = await (model as { count: () => Promise<number> }).count();
      record(`Prisma model accessible: ${name}`, true, `${count} records`);
    } catch (err) {
      record(`Prisma model accessible: ${name}`, false, String(err));
    }
  }
}

async function main() {
  console.log("\n=== Ghana SHS Management System - Smoke Test ===\n");

  await checkDatabaseConnectivity();
  await checkSchoolExists();
  await checkAdminUserExists();
  await checkRolePermissions();
  await checkPermissionsCount();
  await checkGradingScale();
  await checkPrismaModels();

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  console.log(`\n=== Summary: ${passed}/${total} checks passed ===\n`);

  await prisma.$disconnect();

  if (passed < total) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(async (err) => {
  console.error("Smoke test failed with error:", err);
  await prisma.$disconnect();
  process.exit(1);
});
