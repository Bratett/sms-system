/**
 * Real-time event types for Server-Sent Events communication.
 */

export type RealtimeEvent =
  | { type: "attendance:updated"; data: { classArmId: string; present: number; absent: number; total: number } }
  | { type: "payment:received"; data: { studentId: string; amount: number; method: string } }
  | { type: "notification:new"; data: { userId: string; title: string; message: string } }
  | { type: "mark:submitted"; data: { teacherId: string; subjectId: string; classArmId: string; count: number } }
  | { type: "exeat:requested"; data: { studentId: string; studentName: string } }
  | { type: "announcement:published"; data: { title: string; target: string } }
  | { type: "dashboard:stats"; data: Record<string, number> }
  | { type: "connected"; data: { userId: string } };

export type RealtimeEventType = RealtimeEvent["type"];
