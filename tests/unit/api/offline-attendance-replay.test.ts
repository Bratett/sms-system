import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/offline/attendance/replay/route";

// Mock the underlying server action so we're only testing the HTTP wrapper.
vi.mock("@/modules/attendance/actions/attendance.action", () => ({
  recordAttendanceAction: vi.fn(),
}));

import { recordAttendanceAction } from "@/modules/attendance/actions/attendance.action";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/offline/attendance/replay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/offline/attendance/replay", () => {
  beforeEach(() => {
    vi.mocked(recordAttendanceAction).mockReset();
  });

  it("rejects malformed JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/offline/attendance/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Invalid JSON/);
  });

  it("rejects empty records array", async () => {
    const res = await POST(makeReq({ registerId: "r1", records: [] }));
    expect(res.status).toBe(400);
  });

  it("rejects missing registerId", async () => {
    const res = await POST(
      makeReq({ records: [{ studentId: "s1", status: "PRESENT" }] }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects unknown status value", async () => {
    const res = await POST(
      makeReq({
        registerId: "r1",
        records: [{ studentId: "s1", status: "MAYBE" }],
      }),
    );
    expect(res.status).toBe(400);
  });

  it("forwards to recordAttendanceAction and returns success on happy path", async () => {
    vi.mocked(recordAttendanceAction).mockResolvedValue({ success: true } as never);
    const res = await POST(
      makeReq({
        registerId: "r1",
        records: [
          { studentId: "s1", status: "PRESENT" },
          { studentId: "s2", status: "ABSENT", remarks: "sick note" },
        ],
        idempotencyKey: "r1:123",
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true, rows: 2 });
    expect(recordAttendanceAction).toHaveBeenCalledWith(
      "r1",
      expect.arrayContaining([
        expect.objectContaining({ studentId: "s1", status: "PRESENT" }),
      ]),
    );
  });

  it("returns 409 (not 5xx) on domain errors so the SW drops the entry", async () => {
    vi.mocked(recordAttendanceAction).mockResolvedValue({
      error: "This attendance register is closed and cannot be edited.",
    } as never);
    const res = await POST(
      makeReq({
        registerId: "r1",
        records: [{ studentId: "s1", status: "PRESENT" }],
      }),
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/closed/);
  });

  it("caps the batch size at 500", async () => {
    const records = Array.from({ length: 501 }, (_, i) => ({
      studentId: `s${i}`,
      status: "PRESENT" as const,
    }));
    const res = await POST(makeReq({ registerId: "r1", records }));
    expect(res.status).toBe(400);
  });
});
