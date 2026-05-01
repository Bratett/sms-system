import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser, mockUnauthenticated } from "../setup";
import { getStudentHistoryAction } from "@/modules/student/actions/history.action";

describe("getStudentHistoryAction", () => {
  beforeEach(() => {
    mockAuthenticatedUser();
  });

  it("rejects unauthenticated callers", async () => {
    mockUnauthenticated();
    const result = await getStudentHistoryAction({ studentId: "s1" });
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("rejects callers without AUDIT_LOG_READ", async () => {
    mockAuthenticatedUser({ permissions: [] });
    const result = await getStudentHistoryAction({ studentId: "s1" });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error.toLowerCase()).toContain("permission");
  });

  it("returns 'Student not found' when caller cannot see the student (cross-school)", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null as never);
    const result = await getStudentHistoryAction({ studentId: "from-other-school" });
    expect(result).toEqual({ error: "Student not found" });
  });

  it("returns rows for the Student entity directly", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1" } as never);
    prismaMock.medicalRecord.findMany.mockResolvedValue([] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([] as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);
    prismaMock.studentGuardian.findMany.mockResolvedValue([] as never);
    prismaMock.studentHouse.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.findMany.mockResolvedValue([
      {
        id: "log1", timestamp: new Date("2026-04-01"), action: "UPDATE",
        entity: "Student", entityId: "s1", module: "student",
        description: "Updated student name",
        previousData: { firstName: "Old" }, newData: { firstName: "New" },
        user: { id: "u1", firstName: "Admin", lastName: "Person", username: "admin" },
      },
    ] as never);
    prismaMock.auditLog.count.mockResolvedValue(1 as never);

    const result = await getStudentHistoryAction({ studentId: "s1" });
    expect(result).toHaveProperty("data");
    const data = result as { data: Array<{ entity: string; entityId: string | null; userName: string | null }>; pagination: { total: number } };
    expect(data.data.length).toBe(1);
    expect(data.data[0].entity).toBe("Student");
    expect(data.data[0].userName).toBe("Admin Person");
    expect(data.pagination.total).toBe(1);
  });

  it("includes related-entity audit rows via cross-reference IDs", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1" } as never);
    prismaMock.medicalRecord.findMany.mockResolvedValue([{ id: "m1" }, { id: "m2" }] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([{ id: "d1" }] as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);
    prismaMock.studentGuardian.findMany.mockResolvedValue([] as never);
    prismaMock.studentHouse.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.count.mockResolvedValue(0 as never);

    await getStudentHistoryAction({ studentId: "s1" });

    const findManyCall = prismaMock.auditLog.findMany.mock.calls.at(-1);
    expect(findManyCall?.[0]?.where).toMatchObject({
      schoolId: "default-school",
      OR: [
        { entity: "Student", entityId: "s1" },
        { entityId: { in: ["m1", "m2", "d1"] } },
      ],
    });
  });

  it("applies action filter when provided", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1" } as never);
    prismaMock.medicalRecord.findMany.mockResolvedValue([] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([] as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);
    prismaMock.studentGuardian.findMany.mockResolvedValue([] as never);
    prismaMock.studentHouse.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.count.mockResolvedValue(0 as never);

    await getStudentHistoryAction({ studentId: "s1", action: "DELETE" });

    const findManyCall = prismaMock.auditLog.findMany.mock.calls.at(-1);
    expect(findManyCall?.[0]?.where).toMatchObject({ action: "DELETE" });
  });

  it("paginates: page 2 with pageSize 10 sets skip=10, take=10", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1" } as never);
    prismaMock.medicalRecord.findMany.mockResolvedValue([] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([] as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);
    prismaMock.studentGuardian.findMany.mockResolvedValue([] as never);
    prismaMock.studentHouse.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.count.mockResolvedValue(45 as never);

    const result = await getStudentHistoryAction({ studentId: "s1", page: 2, pageSize: 10 });

    const findManyCall = prismaMock.auditLog.findMany.mock.calls.at(-1);
    expect(findManyCall?.[0]?.skip).toBe(10);
    expect(findManyCall?.[0]?.take).toBe(10);
    const data = result as { pagination: { page: number; pageSize: number; total: number; totalPages: number } };
    expect(data.pagination.totalPages).toBe(5); // ceil(45/10) = 5
  });

  it("returns empty data with zero pagination when student has no history", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "s1" } as never);
    prismaMock.medicalRecord.findMany.mockResolvedValue([] as never);
    prismaMock.studentDocument.findMany.mockResolvedValue([] as never);
    prismaMock.enrollment.findMany.mockResolvedValue([] as never);
    prismaMock.studentGuardian.findMany.mockResolvedValue([] as never);
    prismaMock.studentHouse.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.findMany.mockResolvedValue([] as never);
    prismaMock.auditLog.count.mockResolvedValue(0 as never);

    const result = await getStudentHistoryAction({ studentId: "s1" });
    expect(result).toHaveProperty("data");
    const data = result as { data: unknown[]; pagination: { total: number; totalPages: number } };
    expect(data.data).toEqual([]);
    expect(data.pagination.total).toBe(0);
    expect(data.pagination.totalPages).toBe(0);
  });
});
