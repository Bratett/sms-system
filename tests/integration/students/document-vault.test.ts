import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  createDocumentTypeAction,
  recordUploadedStudentDocumentAction,
  verifyStudentDocumentAction,
  getMissingRequiredDocumentsAction,
  listStudentDocumentsAction,
} from "@/modules/student/actions/document.action";
import { resolveSeededAdminId, loginAs } from "./setup";

/**
 * Full-lifecycle integration test for the Student Document Vault.
 *
 * Exercises: createDocumentTypeAction → recordUploadedStudentDocumentAction →
 *            verifyStudentDocumentAction → getMissingRequiredDocumentsAction →
 *            (simulate expiry) → listStudentDocumentsAction
 *
 * Creates two required document types (one with a 12-month expiry, one
 * without), uploads + verifies a document for each, then forces an
 * expiry on the first and asserts the missing-check and listing both
 * reflect the expired state.
 *
 * Skips cleanly when DATABASE_URL is not configured.
 */

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("Document vault lifecycle (integration)", () => {
  const db = new PrismaClient();
  const testTag = `doc-test-${Date.now()}`;
  let studentId: string;
  let typeIdWithExpiry: string;
  let typeIdNoExpiry: string;

  beforeAll(async () => {
    const adminId = await resolveSeededAdminId();
    loginAs({ id: adminId });

    const student = await db.student.create({
      data: {
        schoolId: "default-school",
        studentId: `${testTag}/1`,
        firstName: "Doc",
        lastName: "Test",
        dateOfBirth: new Date("2008-01-01"),
        gender: "MALE",
        boardingStatus: "DAY",
      },
    });
    studentId = student.id;

    const t1 = await createDocumentTypeAction({
      name: `${testTag}-Required-12mo`,
      isRequired: true,
      expiryMonths: 12,
      appliesTo: "ALL",
    });
    if (!("data" in t1)) throw new Error(t1.error);
    typeIdWithExpiry = t1.data.id;

    const t2 = await createDocumentTypeAction({
      name: `${testTag}-Required-NoExpiry`,
      isRequired: true,
      appliesTo: "ALL",
    });
    if (!("data" in t2)) throw new Error(t2.error);
    typeIdNoExpiry = t2.data.id;
  });

  afterAll(async () => {
    await db.studentDocument.deleteMany({ where: { studentId } });
    await db.documentType.deleteMany({ where: { name: { startsWith: testTag } } });
    await db.student.delete({ where: { id: studentId } });
    await db.$disconnect();
  });

  it("runs upload -> verify -> missing-check -> expire -> missing-check again", async () => {
    const before = await getMissingRequiredDocumentsAction(studentId);
    if (!("data" in before)) throw new Error(before.error);
    expect(before.data.missing.length).toBeGreaterThanOrEqual(2);

    const rec1 = await recordUploadedStudentDocumentAction({
      studentId,
      documentTypeId: typeIdWithExpiry,
      title: "Test doc 1",
      fileKey: `student-documents/${studentId}/test-1.pdf`,
      fileName: "test-1.pdf",
      fileSize: 100,
      contentType: "application/pdf",
    });
    if (!("data" in rec1)) throw new Error(rec1.error);
    await verifyStudentDocumentAction(rec1.data.id);

    const rec2 = await recordUploadedStudentDocumentAction({
      studentId,
      documentTypeId: typeIdNoExpiry,
      title: "Test doc 2",
      fileKey: `student-documents/${studentId}/test-2.pdf`,
      fileName: "test-2.pdf",
      fileSize: 100,
      contentType: "application/pdf",
    });
    if (!("data" in rec2)) throw new Error(rec2.error);
    await verifyStudentDocumentAction(rec2.data.id);

    // After uploading both, the TWO test-tagged required types should be satisfied.
    // Note: other required types from the seed may still be missing — that's fine;
    // we only assert OUR types are not in the missing list.
    const afterUpload = await getMissingRequiredDocumentsAction(studentId);
    if (!("data" in afterUpload)) throw new Error(afterUpload.error);
    const missingOurTypes = afterUpload.data.missing.filter(
      (t) => t.id === typeIdWithExpiry || t.id === typeIdNoExpiry
    );
    expect(missingOurTypes).toHaveLength(0);

    // Fast-forward expiry on one doc.
    await db.studentDocument.update({
      where: { id: rec1.data.id },
      data: { expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 24) },
    });

    const afterExpire = await getMissingRequiredDocumentsAction(studentId);
    if (!("data" in afterExpire)) throw new Error(afterExpire.error);
    const missingExpiredType = afterExpire.data.missing.find((t) => t.id === typeIdWithExpiry);
    expect(missingExpiredType).toBeDefined();

    // Confirm list view returns the expired flag.
    const listed = await listStudentDocumentsAction(studentId);
    if (!("data" in listed)) throw new Error(listed.error);
    const expired = listed.data.find((d) => d.id === rec1.data.id);
    expect(expired?.isExpired).toBe(true);
  });
});
