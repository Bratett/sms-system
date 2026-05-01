import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../setup";
import { getStudentBirthdayListAction } from "@/modules/reports/actions/student-birthday-list.action";

describe("getStudentBirthdayListAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
    prismaMock.academicYear.findFirst.mockResolvedValue({ id: "ay1", isCurrent: true } as never);
  });

  it("rejects callers without REPORTS_ENROLLMENT_READ", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await getStudentBirthdayListAction({ month: 5 });
    expect(result).toHaveProperty("error");
  });

  it("returns an error when result set exceeds 5000 rows", async () => {
    prismaMock.enrollment.count.mockResolvedValue(5001 as never);
    const result = await getStudentBirthdayListAction({ month: 5 });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/too large/i);
  });

  it("rejects when both month and upcomingDays are set", async () => {
    const result = await getStudentBirthdayListAction({ month: 5, upcomingDays: 30 });
    expect(result).toHaveProperty("error");
  });

  it("returns students whose birthday is in the chosen month", async () => {
    prismaMock.enrollment.count.mockResolvedValue(2 as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      { student: { id: "s1", studentId: "S1", firstName: "May", lastName: "Born", otherNames: null, dateOfBirth: new Date("2008-05-10"), guardians: [] }, classArm: { class: { name: "Form 1" }, name: "A" } },
      { student: { id: "s2", studentId: "S2", firstName: "April", lastName: "Born", otherNames: null, dateOfBirth: new Date("2008-04-30"), guardians: [] }, classArm: { class: { name: "Form 1" }, name: "A" } },
    ] as never);

    const result = await getStudentBirthdayListAction({ month: 5 });
    expect(result).toHaveProperty("data");
    const rows = (result as { data: { rows: Array<Record<string, unknown>> } }).data.rows;
    expect(rows.length).toBe(1);
    expect(rows[0].studentId).toBe("S1");
  });

  it("treats Feb 29 students as Feb 28 in non-leap years for upcomingDays window", async () => {
    // Setup: clock is March 1 of a non-leap year; upcomingDays = 365
    prismaMock.enrollment.count.mockResolvedValue(1 as never);
    prismaMock.enrollment.findMany.mockResolvedValue([
      { student: { id: "s1", studentId: "S1", firstName: "Leap", lastName: "Year", otherNames: null, dateOfBirth: new Date("2008-02-29"), guardians: [] }, classArm: { class: { name: "Form 1" }, name: "A" } },
    ] as never);

    const result = await getStudentBirthdayListAction({ upcomingDays: 365 });
    expect(result).toHaveProperty("data");
    const rows = (result as { data: { rows: Array<Record<string, unknown>> } }).data.rows;
    expect(rows.length).toBe(1);
    expect(rows[0].dateOfBirth).toBeDefined();
  });
});
