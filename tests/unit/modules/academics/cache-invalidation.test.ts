/**
 * Cache invalidation invariant tests.
 *
 * The plan asked for best-effort `invalidateReportCardCacheAction` calls in
 * three actions. The existing production code already does better:
 *
 *   - `enterMarksAction` and `approveMarksAction` invalidate via
 *     `tx.reportCardPdfCache.updateMany` INSIDE their `db.$transaction(...)`
 *     callbacks — atomic with the mutation.
 *
 *   - `computeTerminalResultsAction` invalidates via
 *     `db.reportCardPdfCache.updateMany` AFTER its compute loop, on a bare
 *     `db` reference (no transaction). This satisfies the spec's best-effort
 *     intent: cache rows are invalidated immediately after results are
 *     written, but a process crash between the last terminal-result write
 *     and this call would leave caches stale.
 *
 * These tests codify the invariant: every score/remark mutation triggers an
 * `updateMany` on `reportCardPdfCache` for the affected (studentId, termId)
 * pairs.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../../setup";
import { enterMarksAction } from "@/modules/academics/actions/mark.action";
import { approveMarksAction } from "@/modules/academics/actions/mark.action";
import { computeTerminalResultsAction } from "@/modules/academics/actions/result.action";

describe("cache invalidation wiring", () => {
  beforeEach(() => {
    mockAuthenticatedUser({
      permissions: [
        "academics:marks:enter",
        "academics:marks:approve",
        "academics:results:compute",
        "academics:report-cards:generate",
        "*",
      ],
    });

    // Reset all mocks so each test starts clean.
    prismaMock.reportCardPdfCache.updateMany.mockReset();

    // Default transaction mock: call the callback with prismaMock as `tx`.
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => unknown) =>
        typeof fn === "function" ? fn(prismaMock) : fn,
    );
  });

  // ─── enterMarksAction ────────────────────────────────────────────────

  describe("enterMarksAction", () => {
    function setupEnterMarksMocks() {
      // Assessment type validation
      prismaMock.assessmentType.findUnique.mockResolvedValue({
        id: "at-1",
        name: "Mid-Term",
        maxScore: 100,
        entryDeadline: null,
        isLocked: false,
      } as never);

      // Check for already-APPROVED marks → none
      prismaMock.mark.findMany
        .mockResolvedValueOnce([] as never) // approved check
        .mockResolvedValueOnce([] as never); // existing marks for audit

      // mark.upsert result (one per student)
      prismaMock.mark.upsert.mockImplementation(
        ({ create }: { create: { studentId: string } }) =>
          Promise.resolve({
            id: `mark-${create.studentId}`,
            studentId: create.studentId,
            score: 80,
            status: "DRAFT",
          } as never),
      );

      // reportCardPdfCache.updateMany: assert on this
      prismaMock.reportCardPdfCache.updateMany.mockResolvedValue(
        { count: 2 } as never,
      );

      // markAuditLog.create (logMarkChange) — no existing marks so no call,
      // but mock it just in case.
      prismaMock.markAuditLog.create.mockResolvedValue({} as never);
    }

    it("invalidates cache for each affected (studentId, termId) pair", async () => {
      setupEnterMarksMocks();

      await enterMarksAction({
        subjectId: "subj-1",
        classArmId: "arm-1",
        assessmentTypeId: "at-1",
        termId: "term-1",
        academicYearId: "ay-1",
        marks: [
          { studentId: "s-1", score: 80 },
          { studentId: "s-2", score: 75 },
        ],
      });

      // Should have called reportCardPdfCache.updateMany (via tx) once,
      // covering both students in a single batch call.
      expect(prismaMock.reportCardPdfCache.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            studentId: { in: expect.arrayContaining(["s-1", "s-2"]) },
            termId: "term-1",
          }),
          data: expect.objectContaining({ invalidatedAt: expect.any(Date) }),
        }),
      );
    });

    it("mark upsert is called before cache invalidation (marks committed first)", async () => {
      setupEnterMarksMocks();

      const callOrder: string[] = [];
      prismaMock.mark.upsert.mockImplementation(
        ({ create }: { create: { studentId: string } }) => {
          callOrder.push("upsert");
          return Promise.resolve({
            id: `mark-${create.studentId}`,
            studentId: create.studentId,
            score: 80,
            status: "DRAFT",
          } as never);
        },
      );
      prismaMock.reportCardPdfCache.updateMany.mockImplementation(() => {
        callOrder.push("invalidate");
        return Promise.resolve({ count: 2 } as never);
      });

      await enterMarksAction({
        subjectId: "subj-1",
        classArmId: "arm-1",
        assessmentTypeId: "at-1",
        termId: "term-1",
        academicYearId: "ay-1",
        marks: [{ studentId: "s-1", score: 80 }],
      });

      // upsert(s) must precede the cache invalidation call.
      expect(callOrder.indexOf("upsert")).toBeLessThan(
        callOrder.indexOf("invalidate"),
      );
    });

    it("returns success even when there are no existing marks to update", async () => {
      setupEnterMarksMocks();

      const result = await enterMarksAction({
        subjectId: "subj-1",
        classArmId: "arm-1",
        assessmentTypeId: "at-1",
        termId: "term-1",
        academicYearId: "ay-1",
        marks: [{ studentId: "s-1", score: 80 }],
      });

      expect(result).toMatchObject({ data: { count: 1 } });
    });
  });

  // ─── approveMarksAction ──────────────────────────────────────────────

  describe("approveMarksAction", () => {
    function setupApproveMarksMocks() {
      // Submitted marks available to approve
      prismaMock.mark.findMany.mockResolvedValue([
        { id: "m-1", studentId: "s-1", score: 80 },
        { id: "m-2", studentId: "s-2", score: 75 },
      ] as never);

      prismaMock.mark.updateMany.mockResolvedValue({ count: 2 } as never);

      prismaMock.reportCardPdfCache.updateMany.mockResolvedValue(
        { count: 2 } as never,
      );

      prismaMock.markAuditLog.create.mockResolvedValue({} as never);
    }

    it("invalidates cache for each approved student in the term", async () => {
      setupApproveMarksMocks();

      await approveMarksAction("subj-1", "arm-1", "at-1", "term-1");

      expect(prismaMock.reportCardPdfCache.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            studentId: { in: expect.arrayContaining(["s-1", "s-2"]) },
            termId: "term-1",
          }),
          data: expect.objectContaining({ invalidatedAt: expect.any(Date) }),
        }),
      );
    });

    it("returns success with the count of approved marks", async () => {
      setupApproveMarksMocks();

      const result = await approveMarksAction("subj-1", "arm-1", "at-1", "term-1");

      expect(result).toMatchObject({ data: { count: 2 } });
    });
  });

  // ─── computeTerminalResultsAction ────────────────────────────────────

  describe("computeTerminalResultsAction", () => {
    function setupComputeMocks() {
      // Default grading scale
      prismaMock.gradingScale.findFirst.mockResolvedValue({
        id: "gs-1",
        isDefault: true,
        gradeDefinitions: [
          {
            grade: "A1",
            minScore: 80,
            maxScore: 100,
            interpretation: "Excellent",
            gradePoint: 4.0,
          },
          {
            grade: "B2",
            minScore: 70,
            maxScore: 79,
            interpretation: "Very Good",
            gradePoint: 3.5,
          },
        ],
      } as never);

      // Assessment types: one CA, one exam
      prismaMock.assessmentType.findMany.mockResolvedValue([
        {
          id: "at-ca",
          name: "Mid-Term",
          category: "CONTINUOUS_ASSESSMENT",
          weight: 40,
        },
        {
          id: "at-exam",
          name: "End-of-Term",
          category: "END_OF_TERM",
          weight: 60,
        },
      ] as never);

      // Approved marks for two students
      prismaMock.mark.findMany.mockResolvedValue([
        {
          id: "m-1",
          studentId: "s-1",
          subjectId: "subj-1",
          score: 35,
          maxScore: 40,
          assessmentType: { category: "CONTINUOUS_ASSESSMENT", weight: 40 },
          subject: { id: "subj-1", name: "Maths" },
        },
        {
          id: "m-2",
          studentId: "s-1",
          subjectId: "subj-1",
          score: 52,
          maxScore: 60,
          assessmentType: { category: "END_OF_TERM", weight: 60 },
          subject: { id: "subj-1", name: "Maths" },
        },
        {
          id: "m-3",
          studentId: "s-2",
          subjectId: "subj-1",
          score: 30,
          maxScore: 40,
          assessmentType: { category: "CONTINUOUS_ASSESSMENT", weight: 40 },
          subject: { id: "subj-1", name: "Maths" },
        },
        {
          id: "m-4",
          studentId: "s-2",
          subjectId: "subj-1",
          score: 45,
          maxScore: 60,
          assessmentType: { category: "END_OF_TERM", weight: 60 },
          subject: { id: "subj-1", name: "Maths" },
        },
      ] as never);

      // Enrollments
      prismaMock.enrollment.findMany.mockResolvedValue([
        {
          studentId: "s-1",
          academicYearId: "ay-1",
          student: { id: "s-1", studentId: "SCH/001", firstName: "Kofi", lastName: "Asante" },
        },
        {
          studentId: "s-2",
          academicYearId: "ay-1",
          student: { id: "s-2", studentId: "SCH/002", firstName: "Akua", lastName: "Mensah" },
        },
      ] as never);

      // Terminal result lifecycle
      prismaMock.terminalResult.deleteMany.mockResolvedValue({ count: 0 } as never);
      prismaMock.terminalResult.create.mockImplementation(
        ({ data }: { data: { studentId: string } }) =>
          Promise.resolve({
            id: `tr-${data.studentId}`,
            studentId: data.studentId,
            averageScore: 0,
            classPosition: null,
          } as never),
      );
      prismaMock.subjectResult.create.mockResolvedValue({} as never);
      prismaMock.terminalResult.update.mockResolvedValue({} as never);

      // Class position ranking
      prismaMock.terminalResult.findMany.mockResolvedValue([
        { id: "tr-s-1", averageScore: 85, studentId: "s-1" },
        { id: "tr-s-2", averageScore: 70, studentId: "s-2" },
      ] as never);
      prismaMock.terminalResult.findUnique.mockResolvedValue(null as never);

      // Subject positions
      prismaMock.terminalResult.findFirst.mockResolvedValue(
        { id: "tr-s-1" } as never,
      );
      prismaMock.subjectResult.updateMany.mockResolvedValue({ count: 1 } as never);

      // Cache invalidation
      prismaMock.reportCardPdfCache.updateMany.mockResolvedValue(
        { count: 2 } as never,
      );
    }

    it("invalidates cache for every student whose result was computed", async () => {
      setupComputeMocks();

      await computeTerminalResultsAction("arm-1", "term-1", "ay-1");

      expect(prismaMock.reportCardPdfCache.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            studentId: { in: expect.arrayContaining(["s-1", "s-2"]) },
            termId: "term-1",
          }),
          data: expect.objectContaining({ invalidatedAt: expect.any(Date) }),
        }),
      );
    });

    it("returns computed count for all students with marks", async () => {
      setupComputeMocks();

      const result = await computeTerminalResultsAction("arm-1", "term-1", "ay-1");

      expect(result).toMatchObject({ data: { computed: 2, errors: [] } });
    });
  });
});
