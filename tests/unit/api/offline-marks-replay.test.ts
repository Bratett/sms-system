import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/offline/marks/replay/route";

vi.mock("@/modules/academics/actions/mark.action", () => ({
  enterMarksAction: vi.fn(),
}));

import { enterMarksAction } from "@/modules/academics/actions/mark.action";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/offline/marks/replay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/offline/marks/replay", () => {
  beforeEach(() => {
    vi.mocked(enterMarksAction).mockReset();
  });

  it("rejects malformed JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/offline/marks/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing marks", async () => {
    const res = await POST(
      makeReq({
        subjectId: "s",
        classArmId: "c",
        assessmentTypeId: "a",
        termId: "t",
        academicYearId: "y",
        marks: [],
      }),
    );
    expect(res.status).toBe(400);
  });

  it("forwards to enterMarksAction on happy path", async () => {
    vi.mocked(enterMarksAction).mockResolvedValue({ data: { count: 2 } } as never);
    const res = await POST(
      makeReq({
        subjectId: "s",
        classArmId: "c",
        assessmentTypeId: "a",
        termId: "t",
        academicYearId: "y",
        marks: [
          { studentId: "st1", score: 85 },
          { studentId: "st2", score: 70 },
        ],
        idempotencyKey: "k1",
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true, rows: 2 });
    // The idempotencyKey should NOT leak into the action payload.
    const callArgs = vi.mocked(enterMarksAction).mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(callArgs).not.toHaveProperty("idempotencyKey");
  });

  it("returns 409 on domain errors", async () => {
    vi.mocked(enterMarksAction).mockResolvedValue({
      error: "Marks are locked for this assessment.",
    } as never);
    const res = await POST(
      makeReq({
        subjectId: "s",
        classArmId: "c",
        assessmentTypeId: "a",
        termId: "t",
        academicYearId: "y",
        marks: [{ studentId: "st1", score: 85 }],
      }),
    );
    expect(res.status).toBe(409);
  });
});
