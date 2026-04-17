import type { ItemBankQuestion, ItemBankChoice } from "@prisma/client";

/**
 * Pure, dependency-free grader for item-bank responses.
 *
 * Given a question (with its choices) and a student's raw answer, the
 * grader returns a verdict, the awarded score, and whether a human still
 * needs to review. Deterministic and side-effect-free — callers persist
 * the result separately.
 *
 * Grading rules per type:
 *   MULTIPLE_CHOICE   — answer is one choice id; full marks iff it matches
 *                       the sole correct choice.
 *   MULTI_SELECT      — answer is an array of choice ids; partial credit
 *                       = (|selected ∩ correct|) / |correct|, penalised
 *                       by every incorrect selection.
 *   TRUE_FALSE        — same as MULTIPLE_CHOICE.
 *   NUMERIC           — answer is a string/number; correct iff |value −
 *                       target| < tolerance (default 0.01).
 *   FILL_IN_BLANK     — exact match after trim + case-fold + punctuation
 *                       strip.
 *   SHORT_ANSWER      — exact match, same normalisation. If operators want
 *                       richer matching they upgrade to ESSAY or add
 *                       `metadata.acceptedAnswers`.
 *   MATCHING / ESSAY  — always NEEDS_REVIEW; grader awards 0.
 */

export type RawAnswer =
  | string
  | number
  | boolean
  | string[]
  | { choiceId?: string; choiceIds?: string[]; text?: string; value?: number };

export interface GradedResponse {
  verdict: "CORRECT" | "INCORRECT" | "PARTIAL" | "NEEDS_REVIEW";
  correct: boolean | null;
  awardedScore: number;
  maxScore: number;
  feedback?: string;
}

export function gradeResponse(
  question: ItemBankQuestion & { choices: ItemBankChoice[] },
  rawAnswer: RawAnswer | null | undefined,
): GradedResponse {
  const maxScore = question.maxScore ?? 1;
  const empty = rawAnswer === null || rawAnswer === undefined || rawAnswer === "";
  if (empty) {
    // Manual grader types always NEEDS_REVIEW even when blank — operator
    // may still award partial credit based on handwritten work.
    if (question.type === "ESSAY" || question.type === "MATCHING") {
      return { verdict: "NEEDS_REVIEW", correct: null, awardedScore: 0, maxScore };
    }
    return { verdict: "INCORRECT", correct: false, awardedScore: 0, maxScore };
  }

  switch (question.type) {
    case "MULTIPLE_CHOICE":
    case "TRUE_FALSE":
      return gradeMultipleChoice(question, rawAnswer, maxScore);
    case "MULTI_SELECT":
      return gradeMultiSelect(question, rawAnswer, maxScore);
    case "NUMERIC":
      return gradeNumeric(question, rawAnswer, maxScore);
    case "FILL_IN_BLANK":
    case "SHORT_ANSWER":
      return gradeText(question, rawAnswer, maxScore);
    case "ESSAY":
    case "MATCHING":
    default:
      return { verdict: "NEEDS_REVIEW", correct: null, awardedScore: 0, maxScore };
  }
}

function pickChoiceId(raw: RawAnswer): string | null {
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return (raw as { choiceId?: string }).choiceId ?? null;
  }
  if (Array.isArray(raw) && raw.length === 1 && typeof raw[0] === "string") {
    return raw[0];
  }
  return null;
}

function pickChoiceIds(raw: RawAnswer): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  if (typeof raw === "object" && raw !== null) {
    const v = (raw as { choiceIds?: string[] }).choiceIds;
    if (Array.isArray(v)) return v;
  }
  if (typeof raw === "string") return [raw];
  return [];
}

function pickText(raw: RawAnswer): string | null {
  if (typeof raw === "string") return raw;
  if (typeof raw === "number") return String(raw);
  if (typeof raw === "object" && raw !== null) {
    const v = (raw as { text?: string }).text;
    if (typeof v === "string") return v;
  }
  return null;
}

function gradeMultipleChoice(
  question: ItemBankQuestion & { choices: ItemBankChoice[] },
  raw: RawAnswer,
  maxScore: number,
): GradedResponse {
  const pickedId = pickChoiceId(raw);
  if (!pickedId) {
    return { verdict: "INCORRECT", correct: false, awardedScore: 0, maxScore };
  }
  const picked = question.choices.find((c) => c.id === pickedId);
  if (!picked) {
    return {
      verdict: "INCORRECT",
      correct: false,
      awardedScore: 0,
      maxScore,
      feedback: "Selected choice does not belong to this question.",
    };
  }
  return picked.isCorrect
    ? { verdict: "CORRECT", correct: true, awardedScore: maxScore, maxScore }
    : { verdict: "INCORRECT", correct: false, awardedScore: 0, maxScore };
}

function gradeMultiSelect(
  question: ItemBankQuestion & { choices: ItemBankChoice[] },
  raw: RawAnswer,
  maxScore: number,
): GradedResponse {
  const pickedIds = new Set(pickChoiceIds(raw));
  const correctIds = new Set(question.choices.filter((c) => c.isCorrect).map((c) => c.id));
  const validIds = new Set(question.choices.map((c) => c.id));

  if (correctIds.size === 0) {
    return { verdict: "NEEDS_REVIEW", correct: null, awardedScore: 0, maxScore };
  }

  let hits = 0;
  let stray = 0;
  for (const id of pickedIds) {
    if (!validIds.has(id)) continue; // ignore bogus ids
    if (correctIds.has(id)) hits++;
    else stray++;
  }

  if (hits === correctIds.size && stray === 0) {
    return { verdict: "CORRECT", correct: true, awardedScore: maxScore, maxScore };
  }
  if (hits === 0 || stray > hits) {
    return { verdict: "INCORRECT", correct: false, awardedScore: 0, maxScore };
  }
  // Partial credit = (hits - stray) / |correct|, clamped [0, maxScore]
  const ratio = Math.max(0, (hits - stray) / correctIds.size);
  const awarded = Math.round(maxScore * ratio * 100) / 100;
  return {
    verdict: "PARTIAL",
    correct: false,
    awardedScore: awarded,
    maxScore,
    feedback: `Selected ${hits}/${correctIds.size} correct options with ${stray} incorrect picks.`,
  };
}

function gradeNumeric(
  question: ItemBankQuestion,
  raw: RawAnswer,
  maxScore: number,
): GradedResponse {
  const target = question.correctText ? Number(question.correctText) : NaN;
  const tolerance = readTolerance(question);
  if (Number.isNaN(target)) {
    return { verdict: "NEEDS_REVIEW", correct: null, awardedScore: 0, maxScore };
  }
  const textValue = pickText(raw);
  const value = textValue !== null ? Number(textValue) : NaN;
  if (Number.isNaN(value)) {
    return { verdict: "INCORRECT", correct: false, awardedScore: 0, maxScore };
  }
  return Math.abs(value - target) <= tolerance
    ? { verdict: "CORRECT", correct: true, awardedScore: maxScore, maxScore }
    : {
        verdict: "INCORRECT",
        correct: false,
        awardedScore: 0,
        maxScore,
        feedback: `Expected ${target} ± ${tolerance}`,
      };
}

function gradeText(
  question: ItemBankQuestion,
  raw: RawAnswer,
  maxScore: number,
): GradedResponse {
  const target = question.correctText ?? null;
  if (!target) {
    return { verdict: "NEEDS_REVIEW", correct: null, awardedScore: 0, maxScore };
  }
  const acceptedAnswers = readAcceptedAnswers(question);
  const candidates = [target, ...acceptedAnswers].map(normaliseText);
  const textValue = pickText(raw);
  if (textValue === null) {
    return { verdict: "INCORRECT", correct: false, awardedScore: 0, maxScore };
  }
  const normalised = normaliseText(textValue);
  if (candidates.includes(normalised)) {
    return { verdict: "CORRECT", correct: true, awardedScore: maxScore, maxScore };
  }
  return {
    verdict: "INCORRECT",
    correct: false,
    awardedScore: 0,
    maxScore,
    feedback: "Did not match the accepted answer(s).",
  };
}

function normaliseText(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[.,;:!?"'`()]/g, "")
    .replace(/\s+/g, " ");
}

function readTolerance(question: ItemBankQuestion): number {
  const meta = question.metadata as { numericTolerance?: number } | null | undefined;
  if (meta && typeof meta.numericTolerance === "number" && meta.numericTolerance >= 0) {
    return meta.numericTolerance;
  }
  return 0.01;
}

function readAcceptedAnswers(question: ItemBankQuestion): string[] {
  const meta = question.metadata as { acceptedAnswers?: string[] } | null | undefined;
  if (meta && Array.isArray(meta.acceptedAnswers)) {
    return meta.acceptedAnswers.filter((x): x is string => typeof x === "string");
  }
  return [];
}

/**
 * Aggregates responses into a submission score.
 */
export function aggregateScore(responses: GradedResponse[]): {
  rawScore: number;
  maxScore: number;
  autoGraded: boolean;
  needsReview: boolean;
} {
  let rawScore = 0;
  let maxScore = 0;
  let needsReview = false;
  for (const r of responses) {
    rawScore += r.awardedScore;
    maxScore += r.maxScore;
    if (r.verdict === "NEEDS_REVIEW") needsReview = true;
  }
  return {
    rawScore: Math.round(rawScore * 100) / 100,
    maxScore: Math.round(maxScore * 100) / 100,
    autoGraded: !needsReview,
    needsReview,
  };
}
