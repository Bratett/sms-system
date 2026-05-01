import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import { NextRequest } from "next/server";
import { loginAs, resolveSeededAdminId } from "../students/setup";
import { GET as rosterXlsxGET } from "@/app/api/reports/students/roster/xlsx/route";

/**
 * Live-DB integration coverage for the Student Reporting Suite.
 *
 * One representative end-to-end exercise of the action → renderer → route →
 * audit chain via the roster XLSX route. Other routes are covered by unit
 * tests in `tests/unit/reports/`.
 *
 * Skips cleanly when DATABASE_URL is not configured.
 */
const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Student report downloads (integration)", () => {
  const db = new PrismaClient();
  const tag = `report-dl-${Date.now()}`;

  const SCHOOL_ID = "default-school";
  let adminId = "";

  let yearId = "";
  let programmeId = "";
  let classId = "";
  let armId = "";
  let stu1Id = "";
  let stu2Id = "";
  let enrol1Id = "";
  let enrol2Id = "";

  beforeAll(async () => {
    // Use the seeded admin so AuditLog.userId FK resolves.
    adminId = await resolveSeededAdminId();
    loginAs({ id: adminId });

    const year = await db.academicYear.create({
      data: {
        schoolId: SCHOOL_ID,
        name: `${tag}-year`,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        isCurrent: false,
      },
    });
    yearId = year.id;

    const programme = await db.programme.create({
      data: {
        schoolId: SCHOOL_ID,
        name: `${tag}-prog`,
        code: `${tag.slice(-8)}-P`,
        duration: 3,
      },
    });
    programmeId = programme.id;

    const cls = await db.class.create({
      data: {
        schoolId: SCHOOL_ID,
        name: `${tag}-class`,
        programmeId,
        academicYearId: yearId,
        yearGroup: 1,
        maxCapacity: 40,
      },
    });
    classId = cls.id;

    const arm = await db.classArm.create({
      data: {
        classId,
        schoolId: SCHOOL_ID,
        name: "A",
        capacity: 40,
      },
    });
    armId = arm.id;

    const s1 = await db.student.create({
      data: {
        schoolId: SCHOOL_ID,
        studentId: `${tag}-S1`,
        firstName: "Adwoa",
        lastName: "Mensah",
        dateOfBirth: new Date("2010-05-10"),
        gender: "FEMALE",
        boardingStatus: "DAY",
        status: "ACTIVE",
      },
    });
    stu1Id = s1.id;

    const s2 = await db.student.create({
      data: {
        schoolId: SCHOOL_ID,
        studentId: `${tag}-S2`,
        firstName: "Kwame",
        lastName: "Boateng",
        dateOfBirth: new Date("2010-04-01"),
        gender: "MALE",
        boardingStatus: "BOARDING",
        status: "ACTIVE",
      },
    });
    stu2Id = s2.id;

    const e1 = await db.enrollment.create({
      data: {
        schoolId: SCHOOL_ID,
        studentId: stu1Id,
        classArmId: armId,
        academicYearId: yearId,
        status: "ACTIVE",
      },
    });
    enrol1Id = e1.id;

    const e2 = await db.enrollment.create({
      data: {
        schoolId: SCHOOL_ID,
        studentId: stu2Id,
        classArmId: armId,
        academicYearId: yearId,
        status: "ACTIVE",
      },
    });
    enrol2Id = e2.id;
  }, 60_000);

  afterAll(async () => {
    if (adminId) {
      await db.auditLog
        .deleteMany({ where: { entity: "STUDENT_ROSTER", userId: adminId } })
        .catch(() => {});
    }
    if (enrol1Id || enrol2Id) {
      await db.enrollment
        .deleteMany({
          where: { id: { in: [enrol1Id, enrol2Id].filter(Boolean) } },
        })
        .catch(() => {});
    }
    if (stu1Id || stu2Id) {
      await db.student
        .deleteMany({ where: { id: { in: [stu1Id, stu2Id].filter(Boolean) } } })
        .catch(() => {});
    }
    if (armId) await db.classArm.delete({ where: { id: armId } }).catch(() => {});
    if (classId) await db.class.delete({ where: { id: classId } }).catch(() => {});
    if (programmeId)
      await db.programme.delete({ where: { id: programmeId } }).catch(() => {});
    if (yearId)
      await db.academicYear.delete({ where: { id: yearId } }).catch(() => {});
    await db.$disconnect();
  });

  it("returns an XLSX with content-disposition and writes one EXPORT audit row", async () => {
    loginAs({ id: adminId });

    const req = new NextRequest(
      `http://localhost/api/reports/students/roster/xlsx?academicYearId=${yearId}&classArmId=${armId}`,
    );
    const res = await rosterXlsxGET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment; filename=/);

    const buf = Buffer.from(await res.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(
      wb.Sheets[wb.SheetNames[0]],
    );
    expect(rows.length).toBe(2);

    const audits = await db.auditLog.findMany({
      where: { entity: "STUDENT_ROSTER", userId: adminId, action: "EXPORT" },
      orderBy: { timestamp: "desc" },
      take: 5,
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
    const meta = audits[0].metadata as Record<string, unknown> | null;
    expect(meta?.format).toBe("xlsx");
    expect((meta?.filters as { academicYearId?: string }).academicYearId).toBe(
      yearId,
    );
  });

  it("rejects callers without REPORTS_ENROLLMENT_READ", async () => {
    loginAs({ id: adminId, permissions: [], roles: ["nobody"] });
    const req = new NextRequest(
      `http://localhost/api/reports/students/roster/xlsx?academicYearId=${yearId}&classArmId=${armId}`,
    );
    const res = await rosterXlsxGET(req);
    expect(res.status).toBe(403);
  });
});
