import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { getExecutiveDashboardAction } from "@/modules/reports/actions/executive-dashboard.action";

describe("getExecutiveDashboardAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects unauthenticated callers", async () => {
    mockUnauthenticated();
    const res = await getExecutiveDashboardAction();
    expect(res.error).toBe("Unauthorized");
  });

  it("returns KPI tiles, trends, and drilldowns", async () => {
    prismaMock.student.count
      .mockResolvedValueOnce(240 as never) // total
      .mockResolvedValueOnce(80 as never); // boarding
    prismaMock.staff.count.mockResolvedValue(18 as never);
    prismaMock.attendanceRecord.groupBy.mockResolvedValue([
      { status: "PRESENT", _count: { _all: 1800 } },
      { status: "LATE", _count: { _all: 60 } },
      { status: "ABSENT", _count: { _all: 120 } },
    ] as never);
    prismaMock.studentBill.aggregate.mockResolvedValue({
      _sum: { totalAmount: 100_000, paidAmount: 72_000, balanceAmount: 28_000 },
    } as never);
    prismaMock.payment.aggregate.mockResolvedValue({
      _sum: { amount: 72_000 },
      _count: { _all: 150 },
    } as never);
    prismaMock.admissionApplication.groupBy.mockResolvedValue([
      { status: "SUBMITTED", _count: { _all: 10 } },
      { status: "ACCEPTED", _count: { _all: 5 } },
    ] as never);
    prismaMock.disciplinaryIncident.count.mockResolvedValue(2 as never);
    prismaMock.mark.count.mockResolvedValue(12 as never);
    prismaMock.dunningCase.count.mockResolvedValue(3 as never);
    prismaMock.storeItem.count.mockResolvedValue(1 as never);
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        { month: new Date("2026-01-01"), count: BigInt(15) },
        { month: new Date("2026-02-01"), count: BigInt(22) },
      ] as never)
      .mockResolvedValueOnce([
        { month: new Date("2026-01-01"), amount: 12_000 },
        { month: new Date("2026-02-01"), amount: 15_000 },
      ] as never);
    prismaMock.studentBill.findMany.mockResolvedValue([] as never);
    prismaMock.terminalResult.groupBy.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.groupBy.mockResolvedValue([
      { riskLevel: "LOW", _count: { _all: 150 } },
      { riskLevel: "MODERATE", _count: { _all: 40 } },
      { riskLevel: "HIGH", _count: { _all: 5 } },
    ] as never);

    const res = await getExecutiveDashboardAction();
    expect("data" in res).toBe(true);
    if (!("data" in res)) return;

    expect(res.data.kpis.totalStudents).toBe(240);
    expect(res.data.kpis.boardingStudents).toBe(80);
    expect(res.data.kpis.dayStudents).toBe(160);
    expect(res.data.kpis.totalStaff).toBe(18);
    // (1800+60)/(1800+60+120) = 1860/1980 = 93.9…%
    expect(res.data.kpis.attendanceRate).toBeCloseTo(93.9, 1);
    expect(res.data.kpis.collectionRate).toBe(72);
    expect(res.data.kpis.admissionsSubmitted).toBe(10);
    expect(res.data.kpis.admissionsAccepted).toBe(5);
    expect(res.data.kpis.activeDunningCases).toBe(3);
    expect(res.data.kpis.inventoryOutOfStock).toBe(1);

    expect(res.data.trends.enrolments).toEqual([
      { month: "2026-01", count: 15 },
      { month: "2026-02", count: 22 },
    ]);
    expect(res.data.trends.revenue).toHaveLength(2);

    expect(res.data.drilldowns.riskDistribution).toHaveLength(3);
  });

  it("handles zero-state gracefully", async () => {
    prismaMock.student.count.mockResolvedValue(0 as never);
    prismaMock.staff.count.mockResolvedValue(0 as never);
    prismaMock.attendanceRecord.groupBy.mockResolvedValue([] as never);
    prismaMock.studentBill.aggregate.mockResolvedValue({
      _sum: { totalAmount: 0, paidAmount: 0, balanceAmount: 0 },
    } as never);
    prismaMock.payment.aggregate.mockResolvedValue({
      _sum: { amount: 0 },
      _count: { _all: 0 },
    } as never);
    prismaMock.admissionApplication.groupBy.mockResolvedValue([] as never);
    prismaMock.disciplinaryIncident.count.mockResolvedValue(0 as never);
    prismaMock.mark.count.mockResolvedValue(0 as never);
    prismaMock.dunningCase.count.mockResolvedValue(0 as never);
    prismaMock.storeItem.count.mockResolvedValue(0 as never);
    prismaMock.$queryRaw.mockResolvedValue([] as never);
    prismaMock.studentBill.findMany.mockResolvedValue([] as never);
    prismaMock.terminalResult.groupBy.mockResolvedValue([] as never);
    prismaMock.studentRiskProfile.groupBy.mockResolvedValue([] as never);

    const res = await getExecutiveDashboardAction();
    expect("data" in res).toBe(true);
    if (!("data" in res)) return;
    expect(res.data.kpis.attendanceRate).toBe(0);
    expect(res.data.kpis.collectionRate).toBe(0);
    expect(res.data.drilldowns.topDebtors).toEqual([]);
  });
});
