import { db } from "@/lib/db";

/**
 * Auto-withdraws all pending parent-initiated requests (excuses +
 * medical disclosures) for a student. Safe to call multiple times.
 * Called from lifecycle actions AFTER the status transition + audit have
 * completed. Not permission-checked — calling action is already gated.
 */
export async function cancelPendingRequestsForStudent(
  studentId: string,
): Promise<void> {
  const note = "Auto-cancelled: student lifecycle transition";
  await db.$transaction(async (tx) => {
    await tx.excuseRequest.updateMany({
      where: { studentId, status: "PENDING" },
      data: { status: "WITHDRAWN", reviewNote: note, reviewedAt: new Date() },
    });
    await tx.medicalDisclosure.updateMany({
      where: { studentId, status: "PENDING" },
      data: { status: "WITHDRAWN", reviewNote: note, reviewedAt: new Date() },
    });
  });
}
