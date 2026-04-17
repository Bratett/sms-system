import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../setup";
import { gradeResponse, aggregateScore } from "@/lib/item-bank/grader";
import {
  submitItemBankAttemptAction,
  gradeResponseAction,
} from "@/modules/academics/actions/item-bank-grader.action";

function makeQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: "q-1",
    schoolId: "default-school",
    subjectId: "sub-1",
    topic: null,
    stem: "Stem",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    maxScore: 1,
    explanation: null,
    correctText: null,
    metadata: null,
    status: "PUBLISHED",
    authoredBy: "u-1",
    reviewedBy: null,
    reviewedAt: null,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    choices: [],
    ...overrides,
  } as never;
}

describe("grader — MULTIPLE_CHOICE", () => {
  it("awards full marks for correct choice", () => {
    const q = makeQuestion({
      choices: [
        { id: "a", text: "A", isCorrect: false, order: 0 },
        { id: "b", text: "B", isCorrect: true, order: 1 },
      ],
    });
    const r = gradeResponse(q, "b");
    expect(r.verdict).toBe("CORRECT");
    expect(r.awardedScore).toBe(1);
  });

  it("awards zero for wrong choice", () => {
    const q = makeQuestion({
      choices: [
        { id: "a", text: "A", isCorrect: false, order: 0 },
        { id: "b", text: "B", isCorrect: true, order: 1 },
      ],
    });
    expect(gradeResponse(q, "a").verdict).toBe("INCORRECT");
  });

  it("awards zero for bogus choice id", () => {
    const q = makeQuestion({
      choices: [
        { id: "a", text: "A", isCorrect: true, order: 0 },
      ],
    });
    expect(gradeResponse(q, "never-existed").verdict).toBe("INCORRECT");
  });

  it("marks blank as INCORRECT", () => {
    const q = makeQuestion({ choices: [{ id: "a", text: "A", isCorrect: true, order: 0 }] });
    expect(gradeResponse(q, null).verdict).toBe("INCORRECT");
  });
});

describe("grader — MULTI_SELECT", () => {
  const q = makeQuestion({
    type: "MULTI_SELECT",
    maxScore: 4,
    choices: [
      { id: "a", isCorrect: true, order: 0, text: "A" },
      { id: "b", isCorrect: true, order: 1, text: "B" },
      { id: "c", isCorrect: false, order: 2, text: "C" },
      { id: "d", isCorrect: true, order: 3, text: "D" },
    ],
  });

  it("awards full marks for perfect selection", () => {
    const r = gradeResponse(q, ["a", "b", "d"]);
    expect(r.verdict).toBe("CORRECT");
    expect(r.awardedScore).toBe(4);
  });

  it("awards partial credit for most-correct selection", () => {
    const r = gradeResponse(q, ["a", "b"]);
    expect(r.verdict).toBe("PARTIAL");
    expect(r.awardedScore).toBeGreaterThan(0);
    expect(r.awardedScore).toBeLessThan(4);
  });

  it("awards zero when stray picks outweigh hits", () => {
    const r = gradeResponse(q, ["c"]);
    expect(r.verdict).toBe("INCORRECT");
    expect(r.awardedScore).toBe(0);
  });
});

describe("grader — NUMERIC", () => {
  const q = makeQuestion({
    type: "NUMERIC",
    correctText: "42",
    metadata: { numericTolerance: 0.5 },
  });

  it("accepts values within tolerance", () => {
    expect(gradeResponse(q, "42.3").verdict).toBe("CORRECT");
    expect(gradeResponse(q, 41.6).verdict).toBe("CORRECT");
  });

  it("rejects values outside tolerance", () => {
    expect(gradeResponse(q, "43").verdict).toBe("INCORRECT");
  });

  it("rejects non-numeric input", () => {
    expect(gradeResponse(q, "forty-two").verdict).toBe("INCORRECT");
  });
});

describe("grader — FILL_IN_BLANK / SHORT_ANSWER", () => {
  const q = makeQuestion({ type: "FILL_IN_BLANK", correctText: "Kwame Nkrumah" });

  it("accepts case and punctuation variations", () => {
    expect(gradeResponse(q, "kwame nkrumah").verdict).toBe("CORRECT");
    expect(gradeResponse(q, "  Kwame   Nkrumah!!! ").verdict).toBe("CORRECT");
  });

  it("rejects near-misses", () => {
    expect(gradeResponse(q, "Nkrumah").verdict).toBe("INCORRECT");
  });

  it("accepts metadata.acceptedAnswers list", () => {
    const q2 = makeQuestion({
      type: "SHORT_ANSWER",
      correctText: "Kwame Nkrumah",
      metadata: { acceptedAnswers: ["Nkrumah", "Dr Nkrumah"] },
    });
    expect(gradeResponse(q2, "Nkrumah").verdict).toBe("CORRECT");
    expect(gradeResponse(q2, "Dr. Nkrumah").verdict).toBe("CORRECT");
  });
});

describe("grader — manual types", () => {
  it("ESSAY always needs review", () => {
    const q = makeQuestion({ type: "ESSAY" });
    expect(gradeResponse(q, "A long answer…").verdict).toBe("NEEDS_REVIEW");
  });

  it("MATCHING always needs review", () => {
    const q = makeQuestion({ type: "MATCHING" });
    expect(gradeResponse(q, { choiceIds: ["a", "b"] }).verdict).toBe("NEEDS_REVIEW");
  });
});

describe("aggregateScore", () => {
  it("sums individual responses", () => {
    const agg = aggregateScore([
      { verdict: "CORRECT", correct: true, awardedScore: 2, maxScore: 2 },
      { verdict: "PARTIAL", correct: false, awardedScore: 1.5, maxScore: 3 },
      { verdict: "INCORRECT", correct: false, awardedScore: 0, maxScore: 1 },
    ]);
    expect(agg.rawScore).toBe(3.5);
    expect(agg.maxScore).toBe(6);
    expect(agg.autoGraded).toBe(true);
    expect(agg.needsReview).toBe(false);
  });

  it("marks needsReview if any NEEDS_REVIEW present", () => {
    const agg = aggregateScore([
      { verdict: "CORRECT", correct: true, awardedScore: 1, maxScore: 1 },
      { verdict: "NEEDS_REVIEW", correct: null, awardedScore: 0, maxScore: 5 },
    ]);
    expect(agg.needsReview).toBe(true);
    expect(agg.autoGraded).toBe(false);
  });
});

describe("submitItemBankAttemptAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects when paper missing", async () => {
    prismaMock.itemBankPaper.findUnique.mockResolvedValue(null as never);
    const res = await submitItemBankAttemptAction({
      paperId: "paper-x",
      studentId: "stu-1",
      answers: [{ questionId: "q-1", rawAnswer: "a" }],
    });
    expect(res.error).toBe("Paper not found");
  });

  it("rejects when paper is still DRAFT", async () => {
    prismaMock.itemBankPaper.findUnique.mockResolvedValue({
      id: "p-1",
      schoolId: "default-school",
      status: "DRAFT",
      questions: [],
    } as never);
    const res = await submitItemBankAttemptAction({
      paperId: "p-1",
      studentId: "stu-1",
      answers: [{ questionId: "q-1", rawAnswer: "a" }],
    });
    expect(res.error).toMatch(/not available/);
  });

  it("grades and persists a submission", async () => {
    const q = {
      ...makeQuestion({ choices: [{ id: "a", isCorrect: true, order: 0, text: "A" }] }),
    };
    prismaMock.itemBankPaper.findUnique.mockResolvedValue({
      id: "p-1",
      schoolId: "default-school",
      status: "PUBLISHED",
      questions: [{ questionId: "q-1", scoreOverride: null, question: q }],
    } as never);
    // caller is proxy (super_admin)
    prismaMock.itemBankSubmission.create.mockResolvedValue({ id: "sub-1" } as never);
    prismaMock.itemBankResponse.createMany.mockResolvedValue({ count: 1 } as never);

    const res = await submitItemBankAttemptAction({
      paperId: "p-1",
      studentId: "stu-1",
      answers: [{ questionId: "q-1", rawAnswer: "a" }],
    });
    expect("data" in res).toBe(true);
    if ("data" in res) {
      expect(res.data.submissionId).toBe("sub-1");
      expect(res.data.rawScore).toBe(1);
    }
  });
});

describe("gradeResponseAction", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects out-of-range scores", async () => {
    prismaMock.itemBankResponse.findFirst.mockResolvedValue({
      id: "r-1",
      submissionId: "s-1",
      schoolId: "default-school",
      maxScore: 5,
    } as never);
    const res = await gradeResponseAction({
      responseId: "r-1",
      awardedScore: 10,
      verdict: "CORRECT",
    });
    expect(res.error).toMatch(/between/);
  });

  it("saves a manual grade and re-aggregates submission", async () => {
    prismaMock.itemBankResponse.findFirst.mockResolvedValue({
      id: "r-1",
      submissionId: "s-1",
      schoolId: "default-school",
      maxScore: 5,
    } as never);
    prismaMock.itemBankResponse.update.mockResolvedValue({ id: "r-1" } as never);
    prismaMock.itemBankResponse.findMany.mockResolvedValue([
      { awardedScore: 3, maxScore: 5, verdict: "PARTIAL" },
      { awardedScore: 2, maxScore: 2, verdict: "CORRECT" },
    ] as never);
    prismaMock.itemBankSubmission.update.mockResolvedValue({ id: "s-1" } as never);

    const res = await gradeResponseAction({
      responseId: "r-1",
      awardedScore: 3,
      verdict: "PARTIAL",
      feedback: "Good effort, missing step 3.",
    });
    expect("data" in res).toBe(true);
  });
});
