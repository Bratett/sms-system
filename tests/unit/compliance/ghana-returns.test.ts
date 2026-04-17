import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../setup";
import type { EmployerContext, StatutoryReturnPeriod } from "@/lib/compliance/ghana/types";
import { generatePayeReturn } from "@/lib/compliance/ghana/paye-return";
import {
  generateSsnitTier1Return,
  generateSsnitTier2Return,
} from "@/lib/compliance/ghana/ssnit-return";
import { generateGetFundReturn } from "@/lib/compliance/ghana/getfund-return";
import { generateVatReturn } from "@/lib/compliance/ghana/vat-return";
import { exportStatutoryReturn } from "@/lib/compliance/ghana/exporter";

const employer: EmployerContext = {
  schoolId: "default-school",
  schoolName: "Ghana SHS",
  tin: "C0001234567",
  ssnitEmployerNumber: "EMP/123",
  getFundCode: "GF-A",
  graVatTin: null,
  ghanaEducationServiceCode: "GAR/001",
};

const marchPeriod: StatutoryReturnPeriod = {
  from: new Date(Date.UTC(2026, 2, 1)),
  to: new Date(Date.UTC(2026, 3, 1)),
  label: "March 2026",
};

function payrollEntry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "pe1",
    staffId: "s1",
    staff: {
      id: "s1",
      staffId: "STF/001",
      firstName: "Kofi",
      lastName: "Mensah",
      tinNumber: "C001",
      ssnitNumber: "SSNIT001",
    },
    basicSalary: 3000,
    totalAllowances: 500,
    totalDeductions: 600,
    netPay: 2900,
    details: {
      allowances: [{ name: "Transport", amount: 500 }],
      deductions: [
        { name: "PAYE (Income Tax)", type: "tax", employee: 400 },
        { name: "SSNIT (Tier 1)", type: "social_security", employee: 165, employer: 390 },
        { name: "SSNIT (Tier 2)", type: "pension", employee: 150, employer: 0 },
      ],
      reliefs: 100,
    },
    ...overrides,
  };
}

describe("generatePayeReturn", () => {
  beforeEach(() => prismaMock.payrollEntry.findMany.mockReset());

  it("returns one row per payroll entry with PAYE extracted", async () => {
    prismaMock.payrollEntry.findMany.mockResolvedValue([payrollEntry()] as never);
    const r = await generatePayeReturn("default-school", employer, marchPeriod);
    expect(r.kind).toBe("GH_PAYE");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].paye).toBe(400);
    expect(r.rows[0].grossSalary).toBe(3500);
    expect(r.totals.employees).toBe(1);
    expect(r.totals.paye).toBe(400);
  });

  it("zeroes PAYE when no tax deduction is recorded", async () => {
    prismaMock.payrollEntry.findMany.mockResolvedValue([
      payrollEntry({ details: { deductions: [] } }),
    ] as never);
    const r = await generatePayeReturn("default-school", employer, marchPeriod);
    expect(r.rows[0].paye).toBe(0);
    expect(r.totals.paye).toBe(0);
  });
});

describe("generateSsnitTier1Return", () => {
  beforeEach(() => prismaMock.payrollEntry.findMany.mockReset());

  it("picks the Tier 1 row and reports employee + employer contributions", async () => {
    prismaMock.payrollEntry.findMany.mockResolvedValue([payrollEntry()] as never);
    const r = await generateSsnitTier1Return("default-school", employer, marchPeriod);
    expect(r.kind).toBe("GH_SSNIT_TIER1");
    expect(r.rows[0].employeeContribution).toBe(165);
    expect(r.rows[0].employerContribution).toBe(390);
    expect(r.rows[0].totalContribution).toBe(555);
  });
});

describe("generateSsnitTier2Return", () => {
  beforeEach(() => prismaMock.payrollEntry.findMany.mockReset());

  it("does not confuse Tier 2 with Tier 1 (name disambiguation)", async () => {
    prismaMock.payrollEntry.findMany.mockResolvedValue([payrollEntry()] as never);
    const r = await generateSsnitTier2Return("default-school", employer, marchPeriod);
    expect(r.rows[0].employeeContribution).toBe(150);
    expect(r.rows[0].employerContribution).toBe(0);
  });
});

describe("generateGetFundReturn", () => {
  it("lists subsidies and computes variance expected - received", async () => {
    prismaMock.governmentSubsidy.findMany.mockResolvedValue([
      {
        id: "g1",
        name: "Free SHS disbursement",
        subsidyType: "FREE_SHS",
        term: { name: "Term 1" },
        expectedAmount: 10000,
        receivedAmount: 8000,
        status: "PARTIALLY_RECEIVED",
      },
    ] as never);
    const r = await generateGetFundReturn("default-school", employer, marchPeriod);
    expect(r.kind).toBe("GH_GETFUND");
    expect(r.rows[0].variance).toBe(-2000);
    expect(r.totals.variance).toBe(-2000);
  });
});

describe("generateVatReturn", () => {
  it("computes outstanding = amount - paid", async () => {
    prismaMock.taxRecord.findMany.mockResolvedValue([
      {
        id: "t1",
        taxType: "VAT",
        period: "2026-Q1",
        amount: 500,
        paidAmount: 200,
        dueDate: new Date("2026-04-30"),
        paidDate: null,
        referenceNumber: "GRA-1",
        status: "PENDING",
      },
    ] as never);
    const r = await generateVatReturn("default-school", employer, marchPeriod);
    expect(r.rows[0].outstanding).toBe(300);
    expect(r.totals.outstanding).toBe(300);
  });
});

describe("exportStatutoryReturn", () => {
  it("produces a CSV buffer with a TOTALS row appended", async () => {
    prismaMock.payrollEntry.findMany.mockResolvedValue([payrollEntry()] as never);
    const ret = await generatePayeReturn("default-school", employer, marchPeriod);
    const { buffer, filename } = exportStatutoryReturn(ret, "csv");
    const text = buffer.toString("utf8");
    expect(filename).toMatch(/^GH_PAYE-2026-03-01\.csv$/);
    expect(text).toContain("TOTALS");
    expect(text).toContain("400"); // paye total
  });

  it("handles empty return sets with a placeholder row", async () => {
    prismaMock.payrollEntry.findMany.mockResolvedValue([] as never);
    const ret = await generatePayeReturn("default-school", employer, marchPeriod);
    const { buffer } = exportStatutoryReturn(ret, "csv");
    expect(buffer.toString("utf8")).toContain("No records for March 2026");
  });
});
