"use server";

import React from "react";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toNum } from "@/lib/decimal";
import { renderPdfToBuffer } from "@/lib/pdf/generator";
import { Payslip, type PayslipProps } from "@/lib/pdf/templates/payslip";
import { PERMISSIONS, denyPermission } from "@/lib/permissions";
import { uploadFile, generateFileKey } from "@/lib/storage/r2";

// ─── Generate Single Payslip PDF ────────────────────────────

export async function generatePayslipPdfAction(staffId: string, payrollPeriodId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.PAYROLL_READ)) return { error: "Insufficient permissions" };

  const entry = await db.payrollEntry.findFirst({
    where: { staffId, payrollPeriodId },
  });
  if (!entry) return { error: "Payroll entry not found for this staff and period." };

  const [staff, period, school] = await Promise.all([
    db.staff.findUnique({
      where: { id: staffId },
      include: {
        employments: {
          where: { status: "ACTIVE" },
          take: 1,
          orderBy: { startDate: "desc" },
          include: {
            // Inline to avoid extra query
          },
        },
      },
    }),
    db.payrollPeriod.findUnique({ where: { id: payrollPeriodId } }),
    db.school.findFirst(),
  ]);

  if (!staff || !period || !school) return { error: "Missing data for payslip generation." };

  // Get department name
  const deptId = staff.employments[0]?.departmentId;
  let departmentName = "N/A";
  if (deptId) {
    const dept = await db.department.findUnique({ where: { id: deptId }, select: { name: true } });
    if (dept) departmentName = dept.name;
  }

  const details = entry.details as {
    allowances: { name: string; amount: number }[];
    deductions: { name: string; amount: number }[];
  } | null;

  const monthName = new Date(period.year, period.month - 1).toLocaleString("default", { month: "long" });

  const props: PayslipProps = {
    schoolName: school.name,
    staffName: `${staff.firstName} ${staff.lastName}`,
    staffId: staff.staffId,
    department: departmentName,
    month: monthName,
    year: period.year,
    basicSalary: toNum(entry.basicSalary),
    allowances: details?.allowances ?? [],
    deductions: details?.deductions ?? [],
    totalAllowances: toNum(entry.totalAllowances),
    totalDeductions: toNum(entry.totalDeductions),
    netPay: toNum(entry.netPay),
    paymentMethod: "Bank Transfer",
    bankDetails: "See HR for details",
  };

  const buffer = await renderPdfToBuffer(React.createElement(Payslip, props));

  // Convert Buffer to base64 for client download
  const base64 = buffer.toString("base64");
  const fileName = `Payslip_${staff.staffId}_${period.month}_${period.year}.pdf`;

  await audit({
    userId: session.user.id!,
    action: "EXPORT",
    entity: "PayrollEntry",
    entityId: entry.id,
    module: "hr",
    description: `Generated payslip PDF for "${staff.firstName} ${staff.lastName}" (${period.month}/${period.year})`,
  });

  return {
    data: {
      base64,
      fileName,
      contentType: "application/pdf",
    },
  };
}

// ─── Bulk Generate & Store Payslips in R2 ───────────────────

export async function bulkGeneratePayslipsAction(payrollPeriodId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  if (denyPermission(session, PERMISSIONS.PAYROLL_APPROVE)) return { error: "Insufficient permissions" };

  const school = await db.school.findFirst();
  if (!school) return { error: "No school configured" };

  const period = await db.payrollPeriod.findUnique({
    where: { id: payrollPeriodId },
  });
  if (!period) return { error: "Payroll period not found." };
  if (period.status === "DRAFT") return { error: "Cannot generate payslips for a DRAFT period. Approve it first." };

  const entries = await db.payrollEntry.findMany({
    where: { payrollPeriodId },
  });
  if (entries.length === 0) return { error: "No payroll entries found." };

  // Get all staff data in one query
  const staffIds = [...new Set(entries.map((e) => e.staffId))];
  const staffRecords = await db.staff.findMany({
    where: { id: { in: staffIds } },
    include: {
      employments: {
        where: { status: "ACTIVE" },
        take: 1,
        orderBy: { startDate: "desc" },
      },
    },
  });
  const staffMap = new Map(staffRecords.map((s) => [s.id, s]));

  // Get department names
  const deptIds = [...new Set(
    staffRecords.flatMap((s) => s.employments.map((e) => e.departmentId)).filter(Boolean) as string[],
  )];
  const departments = deptIds.length > 0
    ? await db.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } })
    : [];
  const deptMap = new Map(departments.map((d) => [d.id, d.name]));

  const monthName = new Date(period.year, period.month - 1).toLocaleString("default", { month: "long" });
  let generated = 0;
  const errors: { staffId: string; message: string }[] = [];

  for (const entry of entries) {
    try {
      const staff = staffMap.get(entry.staffId);
      if (!staff) continue;

      const deptId = staff.employments[0]?.departmentId;
      const departmentName = deptId ? (deptMap.get(deptId) ?? "N/A") : "N/A";

      const details = entry.details as {
        allowances: { name: string; amount: number }[];
        deductions: { name: string; amount: number }[];
      } | null;

      const props: PayslipProps = {
        schoolName: school.name,
        staffName: `${staff.firstName} ${staff.lastName}`,
        staffId: staff.staffId,
        department: departmentName,
        month: monthName,
        year: period.year,
        basicSalary: toNum(entry.basicSalary),
        allowances: details?.allowances ?? [],
        deductions: details?.deductions ?? [],
        totalAllowances: toNum(entry.totalAllowances),
        totalDeductions: toNum(entry.totalDeductions),
        netPay: toNum(entry.netPay),
        paymentMethod: "Bank Transfer",
        bankDetails: "See HR for details",
      };

      const buffer = await renderPdfToBuffer(React.createElement(Payslip, props));
      const fileName = `Payslip_${staff.staffId}_${period.month}_${period.year}.pdf`;
      const fileKey = generateFileKey("payslips", period.id, fileName);

      await uploadFile(fileKey, buffer, "application/pdf");

      // Store as a Document linked to the staff member
      await db.document.create({
        data: {
          schoolId: school.id,
          title: `Payslip - ${monthName} ${period.year}`,
          category: "STAFF",
          fileKey,
          fileName,
          fileSize: buffer.length,
          contentType: "application/pdf",
          entityType: "Staff",
          entityId: staff.id,
          uploadedBy: session.user.id!,
          accessLevel: "RESTRICTED",
        },
      });

      generated++;
    } catch (error) {
      errors.push({
        staffId: entry.staffId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  await audit({
    userId: session.user.id!,
    action: "EXPORT",
    entity: "PayrollPeriod",
    entityId: payrollPeriodId,
    module: "hr",
    description: `Bulk generated ${generated} payslip PDFs for ${period.month}/${period.year}`,
    metadata: { periodId: payrollPeriodId, generated, errorCount: errors.length },
  });

  return { data: { generated, errors } };
}
