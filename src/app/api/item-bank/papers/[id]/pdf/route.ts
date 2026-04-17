import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { renderPdfToBuffer } from "@/lib/pdf/generator";
import { ItemBankPaperPdf } from "@/lib/pdf/templates/item-bank-paper";
import { logger } from "@/lib/logger";

const log = logger.child({ route: "item-bank-paper-pdf" });

/**
 * GET /api/item-bank/papers/:id/pdf
 *
 * Renders an ItemBankPaper as a printable PDF. Query `?key=1` adds an answer-
 * key page (gated on ITEM_BANK_REVIEW — don't hand this URL to students).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const perms = session.user.permissions ?? [];
    const canRead =
      perms.includes("*") || perms.includes(PERMISSIONS.ITEM_BANK_READ);
    if (!canRead) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const schoolId = session.user.schoolId;
    if (!schoolId) return NextResponse.json({ error: "No school context" }, { status: 400 });

    const { id } = await params;
    const paper = await db.itemBankPaper.findFirst({
      where: { id, schoolId },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: {
            question: {
              include: { choices: { orderBy: { order: "asc" } } },
            },
          },
        },
      },
    });
    if (!paper) return NextResponse.json({ error: "Paper not found" }, { status: 404 });

    const wantKey = request.nextUrl.searchParams.get("key") === "1";
    const canSeeKey =
      perms.includes("*") ||
      perms.includes(PERMISSIONS.ITEM_BANK_REVIEW) ||
      perms.includes(PERMISSIONS.ITEM_BANK_PUBLISH);
    const includeAnswerKey = wantKey && canSeeKey;

    const [subject, school] = await Promise.all([
      db.subject.findUnique({
        where: { id: paper.subjectId },
        select: { name: true },
      }),
      db.school.findUnique({
        where: { id: schoolId },
        select: { name: true, motto: true },
      }),
    ]);
    const termName = paper.termId
      ? (await db.term.findUnique({ where: { id: paper.termId }, select: { name: true } }))?.name ?? null
      : null;
    const yearName = paper.academicYearId
      ? (await db.academicYear.findUnique({
          where: { id: paper.academicYearId },
          select: { name: true },
        }))?.name ?? null
      : null;

    const questions = paper.questions.map((pq) => ({
      order: pq.order,
      type: pq.question.type,
      stem: pq.question.stem,
      maxScore: pq.scoreOverride ?? pq.question.maxScore,
      choices: pq.question.choices.map((c) => ({ text: c.text, order: c.order })),
    }));

    const correctAnswers = includeAnswerKey
      ? paper.questions.map((pq) => ({
          order: pq.order,
          answer: deriveCorrectAnswer(pq.question),
        }))
      : undefined;

    const buffer = await renderPdfToBuffer(
      ItemBankPaperPdf({
        schoolName: school?.name ?? "School",
        schoolMotto: school?.motto ?? null,
        paperTitle: paper.title,
        subjectName: subject?.name ?? "Subject",
        yearGroup: paper.yearGroup,
        termName,
        academicYearName: yearName,
        durationMins: paper.durationMins,
        instructions: paper.instructions,
        totalScore: paper.totalScore,
        questions,
        includeAnswerKey,
        correctAnswers,
      }),
    );

    return new NextResponse(buffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="paper-${paper.id}.pdf"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    log.error("paper pdf render failed", { err: err instanceof Error ? err.message : err });
    return NextResponse.json({ error: "Render failed" }, { status: 500 });
  }
}

function deriveCorrectAnswer(
  question: { type: string; correctText: string | null; choices: { text: string; isCorrect: boolean; order: number }[] },
): string {
  if (question.type === "MULTIPLE_CHOICE" || question.type === "MULTI_SELECT" || question.type === "TRUE_FALSE") {
    const correct = question.choices.filter((c) => c.isCorrect);
    return correct
      .map((c) => `${String.fromCharCode(65 + c.order)}. ${c.text}`)
      .join(" · ");
  }
  return question.correctText ?? "—";
}
