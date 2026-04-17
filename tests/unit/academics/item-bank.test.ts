import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock, mockAuthenticatedUser } from "../setup";
import {
  createItemBankQuestionAction,
  reviewItemBankQuestionAction,
  deleteItemBankQuestionAction,
  generatePaperAction,
} from "@/modules/academics/actions/item-bank.action";

describe("Item bank actions", () => {
  beforeEach(() => mockAuthenticatedUser());

  it("rejects MC question with no correct answer", async () => {
    const res = await createItemBankQuestionAction({
      subjectId: "sub-1",
      stem: "What is 2+2?",
      type: "MULTIPLE_CHOICE",
      difficulty: "EASY",
      bloomLevel: "REMEMBER",
      maxScore: 1,
      choices: [
        { text: "3", isCorrect: false, order: 0 },
        { text: "5", isCorrect: false, order: 1 },
      ],
      tagIds: [],
    });
    expect("error" in res && res.error).toBe("Invalid input");
  });

  it("rejects MC with more than one correct", async () => {
    const res = await createItemBankQuestionAction({
      subjectId: "sub-1",
      stem: "Pick a number",
      type: "MULTIPLE_CHOICE",
      difficulty: "EASY",
      bloomLevel: "REMEMBER",
      maxScore: 1,
      choices: [
        { text: "1", isCorrect: true, order: 0 },
        { text: "2", isCorrect: true, order: 1 },
      ],
      tagIds: [],
    });
    expect("error" in res && res.error).toBe("Invalid input");
  });

  it("rejects if subject belongs to another tenant", async () => {
    prismaMock.subject.findFirst.mockResolvedValue(null as never);
    const res = await createItemBankQuestionAction({
      subjectId: "sub-other",
      stem: "Valid stem",
      type: "SHORT_ANSWER",
      difficulty: "MEDIUM",
      bloomLevel: "UNDERSTAND",
      maxScore: 2,
      choices: [],
      tagIds: [],
    });
    expect(res.error).toMatch(/Subject not found/);
  });

  it("creates a valid MC question", async () => {
    prismaMock.subject.findFirst.mockResolvedValue({ id: "sub-1" } as never);
    prismaMock.itemBankQuestion.create.mockResolvedValue({ id: "q-1" } as never);
    prismaMock.itemBankChoice.createMany.mockResolvedValue({ count: 2 } as never);
    const res = await createItemBankQuestionAction({
      subjectId: "sub-1",
      stem: "What is 2+2?",
      type: "MULTIPLE_CHOICE",
      difficulty: "EASY",
      bloomLevel: "REMEMBER",
      maxScore: 1,
      choices: [
        { text: "4", isCorrect: true, order: 0 },
        { text: "5", isCorrect: false, order: 1 },
      ],
      tagIds: [],
    });
    expect("data" in res).toBe(true);
  });

  it("blocks delete when question has been used", async () => {
    prismaMock.itemBankQuestion.findFirst.mockResolvedValue({ id: "q-1", usageCount: 3 } as never);
    const res = await deleteItemBankQuestionAction("q-1");
    expect(res.error).toMatch(/Retire it instead/);
  });

  it("publishes a question", async () => {
    prismaMock.itemBankQuestion.findFirst.mockResolvedValue({ id: "q-1" } as never);
    prismaMock.itemBankQuestion.update.mockResolvedValue({ id: "q-1", status: "PUBLISHED" } as never);
    const res = await reviewItemBankQuestionAction("q-1", "PUBLISHED");
    expect("data" in res).toBe(true);
  });

  it("returns an error when blueprint totals are zero", async () => {
    const res = await generatePaperAction({
      title: "Paper 1",
      subjectId: "sub-1",
      blueprint: { easy: 0, medium: 0, hard: 0, topics: [], bloomLevels: [], tagIds: [] },
    } as never);
    expect("error" in res && res.error).toBe("Invalid input");
  });

  it("errors when no published questions match", async () => {
    prismaMock.itemBankQuestion.findMany.mockResolvedValue([]);
    const res = await generatePaperAction({
      title: "Paper 1",
      subjectId: "sub-1",
      blueprint: { easy: 2, medium: 2, hard: 2, topics: [], bloomLevels: [], tagIds: [] },
    } as never);
    expect("error" in res && res.error).toMatch(/No published questions/);
  });

  it("generates a paper and increments usage", async () => {
    // pickRandom queries itemBankQuestion.findMany 3× (easy/medium/hard)
    prismaMock.itemBankQuestion.findMany
      .mockResolvedValueOnce([{ id: "q1", maxScore: 1 }] as never)
      .mockResolvedValueOnce([{ id: "q2", maxScore: 1 }] as never)
      .mockResolvedValueOnce([{ id: "q3", maxScore: 2 }] as never);
    prismaMock.itemBankPaper.create.mockResolvedValue({ id: "paper-1" } as never);
    prismaMock.itemBankPaperQuestion.createMany.mockResolvedValue({ count: 3 } as never);
    prismaMock.itemBankQuestion.updateMany.mockResolvedValue({ count: 3 } as never);

    const res = await generatePaperAction({
      title: "Math Mock",
      subjectId: "sub-1",
      blueprint: { easy: 1, medium: 1, hard: 1, topics: [], bloomLevels: [], tagIds: [] },
    } as never);
    expect("data" in res).toBe(true);
    if ("data" in res) {
      expect(res.data.questionCount).toBe(3);
      expect(res.data.totalScore).toBe(4);
    }
  });
});
