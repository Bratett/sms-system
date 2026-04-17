import { NextResponse } from "next/server";
import { z } from "zod";
import { enterMarksAction } from "@/modules/academics/actions/mark.action";
import { logger } from "@/lib/logger";

/**
 * Offline marks replay endpoint.
 *
 * Same idempotency story as the attendance replay: `enterMarksAction` uses
 * an upsert keyed on (studentId, subjectId, assessmentTypeId, termId) so
 * replaying the same payload is a no-op.
 */

const replaySchema = z.object({
  subjectId: z.string().min(1),
  classArmId: z.string().min(1),
  assessmentTypeId: z.string().min(1),
  termId: z.string().min(1),
  academicYearId: z.string().min(1),
  marks: z
    .array(
      z.object({
        studentId: z.string().min(1),
        score: z.number().finite(),
      }),
    )
    .min(1)
    .max(500),
  idempotencyKey: z.string().optional(),
});

const log = logger.child({ route: "offline-marks-replay" });

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

  const { idempotencyKey, ...rest } = parsed.data;

  const result = await enterMarksAction(rest);
  if ("error" in result) {
    log.warn("replay failed", { idempotencyKey, error: result.error });
    return NextResponse.json(result, { status: 409 });
  }

  log.info("replay ok", { idempotencyKey, rows: rest.marks.length });
  return NextResponse.json({ success: true, rows: rest.marks.length });
}
