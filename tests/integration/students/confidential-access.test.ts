import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getMedicalRecordAction, getMedicalRecordsAction } from "@/modules/student/actions/medical.action";
import { getCounselingRecordsAction } from "@/modules/discipline/actions/counseling.action";
import { resolveSeededAdminId, loginAs } from "./setup";

/**
 * Full-lifecycle integration test for Role-Based Confidentiality Enforcement.
 *
 * Seeds a student + 2 medical records (one confidential, one public) + 2
 * counseling records (one confidential, one public).
 *
 * Validates:
 *   - Nurse (has :confidential:read) sees full content on list/detail
 *   - Teacher (lacks :confidential:read) gets redacted rows on list and detail
 *   - Detail view on a confidential record writes an AuditLog row; denied flag
 *     reflects whether access was allowed or denied
 *   - Detail view on a non-confidential record does NOT write an AuditLog row
 *   - Counselor sees full counseling content; teacher gets redacted summary
 *   - Querying as a different schoolId returns 0 rows (tenant isolation)
 *
 * AuditLog.userId has a real FK to User.id. We therefore create lightweight
 * User rows for each persona in beforeAll and delete them in afterAll.
 *
 * Skips cleanly when DATABASE_URL is not configured.
 */

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Confidential access (integration)", () => {
  const db = new PrismaClient();
  const testTag = `confidential-test-${Date.now()}`;
  let studentId: string;
  let confidentialMedId: string;
  let publicMedId: string;
  let confidentialCnsId: string;
  let publicCnsId: string;
  let adminId: string;

  // Real DB user IDs assigned at runtime — needed so AuditLog FK resolves.
  let nurseDbId: string;
  let teacherDbId: string;
  let counsellorDbId: string;

  beforeAll(async () => {
    adminId = await resolveSeededAdminId();

    // ── 1. Create lightweight User rows for each test persona ──────────────
    // upsert on username so reruns after a failed cleanup don't collide.
    const HASH = "integration-test-placeholder-hash";

    const nurseUser = await db.user.upsert({
      where: { username: `${testTag}-nurse` },
      create: {
        username: `${testTag}-nurse`,
        email: `${testTag}-nurse@test.invalid`,
        passwordHash: HASH,
        firstName: "Test",
        lastName: "Nurse",
      },
      update: {},
    });
    nurseDbId = nurseUser.id;

    const teacherUser = await db.user.upsert({
      where: { username: `${testTag}-teacher` },
      create: {
        username: `${testTag}-teacher`,
        email: `${testTag}-teacher@test.invalid`,
        passwordHash: HASH,
        firstName: "Test",
        lastName: "Teacher",
      },
      update: {},
    });
    teacherDbId = teacherUser.id;

    const counsellorUser = await db.user.upsert({
      where: { username: `${testTag}-counsellor` },
      create: {
        username: `${testTag}-counsellor`,
        email: `${testTag}-counsellor@test.invalid`,
        passwordHash: HASH,
        firstName: "Test",
        lastName: "Counsellor",
      },
      update: {},
    });
    counsellorDbId = counsellorUser.id;

    // ── 2. Seed the test student ───────────────────────────────────────────
    const student = await db.student.create({
      data: {
        schoolId: "default-school",
        studentId: `${testTag}/001`,
        firstName: "Confi",
        lastName: "Dential",
        dateOfBirth: new Date("2010-01-01"),
        gender: "MALE",
      },
    });
    studentId = student.id;

    // ── 3. Medical records ─────────────────────────────────────────────────
    const confMed = await db.medicalRecord.create({
      data: {
        schoolId: "default-school",
        studentId,
        recordedBy: adminId,
        date: new Date(),
        type: "TREATMENT",
        title: "Allergy management",
        description: "Private details",
        treatment: "Antihistamine",
        isConfidential: true,
      },
    });
    confidentialMedId = confMed.id;

    const pubMed = await db.medicalRecord.create({
      data: {
        schoolId: "default-school",
        studentId,
        recordedBy: adminId,
        date: new Date(),
        type: "CHECKUP",
        title: "Annual checkup",
        description: "Routine exam",
        isConfidential: false,
      },
    });
    publicMedId = pubMed.id;

    // ── 4. Counseling records ──────────────────────────────────────────────
    const confCns = await db.counselingRecord.create({
      data: {
        schoolId: "default-school",
        studentId,
        counselorId: adminId,
        sessionDate: new Date(),
        type: "INDIVIDUAL",
        summary: "Sensitive family matter",
        actionPlan: "Weekly check-in",
        isConfidential: true,
      },
    });
    confidentialCnsId = confCns.id;

    const pubCns = await db.counselingRecord.create({
      data: {
        schoolId: "default-school",
        studentId,
        counselorId: adminId,
        sessionDate: new Date(),
        type: "GROUP",
        summary: "Career talk",
        isConfidential: false,
      },
    });
    publicCnsId = pubCns.id;
  });

  afterAll(async () => {
    // Delete audit rows first (they FK-reference the records and the users).
    await db.auditLog
      .deleteMany({
        where: {
          entityId: { in: [confidentialMedId, publicMedId, confidentialCnsId, publicCnsId] },
        },
      })
      .catch(() => {});

    await db.counselingRecord
      .deleteMany({ where: { id: { in: [confidentialCnsId, publicCnsId] } } })
      .catch(() => {});

    await db.medicalRecord
      .deleteMany({ where: { id: { in: [confidentialMedId, publicMedId] } } })
      .catch(() => {});

    await db.student.delete({ where: { id: studentId } }).catch(() => {});

    // Delete the test persona users last (audit rows already gone).
    await db.user
      .deleteMany({ where: { id: { in: [nurseDbId, teacherDbId, counsellorDbId] } } })
      .catch(() => {});

    await db.$disconnect();
  });

  // ─── Medical list ────────────────────────────────────────────────────────

  it("nurse sees full medical content on list", async () => {
    loginAs({
      id: nurseDbId,
      permissions: ["medical:records:read", "medical:records:confidential:read"],
      schoolId: "default-school",
    });

    const result = await getMedicalRecordsAction({ studentId });
    if (!("data" in result)) throw new Error(result.error);

    const conf = result.data.find((r) => r.id === confidentialMedId);
    expect(conf?.title).toBe("Allergy management");
    expect(conf?.description).toBe("Private details");
  });

  it("teacher sees redacted medical rows on list", async () => {
    loginAs({
      id: teacherDbId,
      permissions: ["medical:records:read", "welfare:counseling:read"],
      schoolId: "default-school",
    });

    const result = await getMedicalRecordsAction({ studentId });
    if (!("data" in result)) throw new Error(result.error);

    const conf = result.data.find((r) => r.id === confidentialMedId);
    expect(conf?.title).toBe("Confidential — restricted");
    expect(conf?.description).toBe("");

    const pub = result.data.find((r) => r.id === publicMedId);
    expect(pub?.title).toBe("Annual checkup");
  });

  // ─── Medical detail + audit ──────────────────────────────────────────────

  it("nurse detail on confidential writes audit row with denied:false", async () => {
    loginAs({
      id: nurseDbId,
      permissions: ["medical:records:read", "medical:records:confidential:read"],
      schoolId: "default-school",
    });

    const result = await getMedicalRecordAction(confidentialMedId);
    if (!("data" in result)) throw new Error(result.error);
    expect(result.data.title).toBe("Allergy management");

    const rows = await db.auditLog.findMany({
      where: { entity: "MedicalRecord", entityId: confidentialMedId, userId: nurseDbId },
      orderBy: { timestamp: "desc" },
      take: 1,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.action).toBe("READ");
    expect(rows[0]!.metadata).toMatchObject({ isConfidential: true, denied: false });
  });

  it("teacher detail on confidential writes audit row with denied:true and returns redacted", async () => {
    loginAs({
      id: teacherDbId,
      permissions: ["medical:records:read", "welfare:counseling:read"],
      schoolId: "default-school",
    });

    const result = await getMedicalRecordAction(confidentialMedId);
    if (!("data" in result)) throw new Error(result.error);
    expect(result.data.title).toBe("Confidential — restricted");

    const rows = await db.auditLog.findMany({
      where: { entity: "MedicalRecord", entityId: confidentialMedId, userId: teacherDbId },
      orderBy: { timestamp: "desc" },
      take: 1,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.metadata).toMatchObject({ isConfidential: true, denied: true });
  });

  it("detail on non-confidential does not write audit row", async () => {
    loginAs({
      id: teacherDbId,
      permissions: ["medical:records:read", "welfare:counseling:read"],
      schoolId: "default-school",
    });

    const before = await db.auditLog.count({
      where: { entity: "MedicalRecord", entityId: publicMedId, userId: teacherDbId },
    });

    const result = await getMedicalRecordAction(publicMedId);
    if (!("data" in result)) throw new Error(result.error);

    const after = await db.auditLog.count({
      where: { entity: "MedicalRecord", entityId: publicMedId, userId: teacherDbId },
    });
    expect(after).toBe(before);
  });

  // ─── Counseling list ─────────────────────────────────────────────────────

  it("counselor sees full counseling content; teacher gets redacted summary", async () => {
    loginAs({
      id: counsellorDbId,
      permissions: ["welfare:counseling:read", "welfare:counseling:confidential:read"],
      schoolId: "default-school",
    });

    const cnsFull = await getCounselingRecordsAction({ studentId });
    if (!("data" in cnsFull)) throw new Error(cnsFull.error);
    const cnsConfFull = cnsFull.data.find((r) => r.id === confidentialCnsId);
    expect(cnsConfFull?.summary).toBe("Sensitive family matter");

    loginAs({
      id: teacherDbId,
      permissions: ["medical:records:read", "welfare:counseling:read"],
      schoolId: "default-school",
    });

    const cnsRedacted = await getCounselingRecordsAction({ studentId });
    if (!("data" in cnsRedacted)) throw new Error(cnsRedacted.error);
    const cnsConfRedacted = cnsRedacted.data.find((r) => r.id === confidentialCnsId);
    expect(cnsConfRedacted?.summary).toBe("Confidential — restricted");
    expect(cnsConfRedacted?.actionPlan).toBeNull();
  });

  // ─── Tenant isolation ────────────────────────────────────────────────────

  it("list action enforces schoolId isolation", async () => {
    loginAs({
      id: nurseDbId,
      permissions: ["medical:records:read", "medical:records:confidential:read"],
      schoolId: "other-school",
    });

    const result = await getMedicalRecordsAction({ studentId });
    if (!("data" in result)) throw new Error(result.error);
    expect(result.data).toHaveLength(0);
  });
});
