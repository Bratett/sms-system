/**
 * Notification Event Types
 * Central registry of all system events that trigger notifications.
 */

export const NOTIFICATION_EVENTS = {
  // Finance
  FEE_REMINDER: "fee_reminder",
  PAYMENT_RECEIVED: "payment_received",
  PAYMENT_REVERSED: "payment_reversed",

  // Academics
  RESULT_PUBLISHED: "result_published",
  MARK_APPROVED: "mark_approved",
  PROMOTION_COMPLETED: "promotion_completed",

  // Admissions
  ADMISSION_STATUS_CHANGED: "admission_status_changed",
  ADMISSION_ACCEPTED: "admission_accepted",

  // Attendance
  STUDENT_ABSENT: "student_absent",
  STUDENT_LATE: "student_late",

  // Boarding / Exeat
  EXEAT_APPROVED: "exeat_approved",
  EXEAT_REJECTED: "exeat_rejected",
  EXEAT_OVERDUE: "exeat_overdue",
  EXEAT_RETURNED: "exeat_returned",

  // HR
  LEAVE_APPROVED: "leave_approved",
  LEAVE_REJECTED: "leave_rejected",
  PAYROLL_GENERATED: "payroll_generated",

  // Communication
  ANNOUNCEMENT_PUBLISHED: "announcement_published",

  // Discipline
  DISCIPLINE_INCIDENT: "discipline_incident",
  DISCIPLINE_RESOLVED: "discipline_resolved",

  // Inventory
  LOW_STOCK_ALERT: "low_stock_alert",
} as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];

/**
 * Channel routing configuration.
 * Defines which channels each event type should be dispatched to.
 */
export const EVENT_CHANNELS: Record<NotificationEvent, ("in_app" | "sms" | "email")[]> = {
  [NOTIFICATION_EVENTS.FEE_REMINDER]: ["in_app", "sms", "email"],
  [NOTIFICATION_EVENTS.PAYMENT_RECEIVED]: ["in_app", "sms"],
  [NOTIFICATION_EVENTS.PAYMENT_REVERSED]: ["in_app"],
  [NOTIFICATION_EVENTS.RESULT_PUBLISHED]: ["in_app", "sms", "email"],
  [NOTIFICATION_EVENTS.MARK_APPROVED]: ["in_app"],
  [NOTIFICATION_EVENTS.PROMOTION_COMPLETED]: ["in_app"],
  [NOTIFICATION_EVENTS.ADMISSION_STATUS_CHANGED]: ["in_app", "email"],
  [NOTIFICATION_EVENTS.ADMISSION_ACCEPTED]: ["in_app", "sms", "email"],
  [NOTIFICATION_EVENTS.STUDENT_ABSENT]: ["in_app", "sms"],
  [NOTIFICATION_EVENTS.STUDENT_LATE]: ["in_app"],
  [NOTIFICATION_EVENTS.EXEAT_APPROVED]: ["in_app", "sms"],
  [NOTIFICATION_EVENTS.EXEAT_REJECTED]: ["in_app", "sms"],
  [NOTIFICATION_EVENTS.EXEAT_OVERDUE]: ["in_app", "sms", "email"],
  [NOTIFICATION_EVENTS.EXEAT_RETURNED]: ["in_app"],
  [NOTIFICATION_EVENTS.LEAVE_APPROVED]: ["in_app", "email"],
  [NOTIFICATION_EVENTS.LEAVE_REJECTED]: ["in_app", "email"],
  [NOTIFICATION_EVENTS.PAYROLL_GENERATED]: ["in_app"],
  [NOTIFICATION_EVENTS.ANNOUNCEMENT_PUBLISHED]: ["in_app"],
  [NOTIFICATION_EVENTS.DISCIPLINE_INCIDENT]: ["in_app", "sms"],
  [NOTIFICATION_EVENTS.DISCIPLINE_RESOLVED]: ["in_app"],
  [NOTIFICATION_EVENTS.LOW_STOCK_ALERT]: ["in_app"],
};
