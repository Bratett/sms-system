import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAttendanceAction } from "@/modules/attendance/actions/attendance.action";
import { logger } from "@/lib/logger";

/**
 * Offline attendance replay endpoint.
 *
 * The service worker POSTs queued attendance batches here when connectivity
 * returns. The underlying `recordAttendanceAction` uses an upsert on the
 * (registerId, studentId) unique constraint, so replaying the same batch
 * multiple times is idempotent — no separate dedup store required.
 *
 * Auth: the server action checks `requireSchoolContext()` internally. The SW
 * fetch carries same-origin cookies so the user's session is preserved.
 */

const replaySchema = z.object({
  registerId: z.string().min(1),
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED", "SICK"]),
        remarks: z.string().optional(),
        arrivalTime: z.string().optional(),
      }),
    )
    .min(1)
    .max(500),
  // Optional; used only for log correlation. Idempotency is implicit from the
  // upsert in recordAttendanceAction.
  idempotencyKey: z.string().optional(),
});

const log = logger.child({ route: "offline-attendance-replay" });

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = replaySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { registerId, records, idempotencyKey } = parsed.data;

  const result = await recordAttendanceAction(registerId, records);
  if ("error" in result) {
    log.warn("replay failed", { registerId, idempotencyKey, error: result.error });
    // 409 for domain errors (closed register, not found) so the SW treats
    // them as "don't retry" and drops the entry. 5xx would cause infinite
    // retry loops.
    return NextResponse.json(result, { status: 409 });
  }

  log.info("replay ok", { registerId, idempotencyKey, rows: records.length });
  return NextResponse.json({ success: true, rows: records.length });
}
