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
  ADMISSION_SUBMITTED: "admission_submitted",
  ADMISSION_STATUS_CHANGED: "admission_status_changed",
  ADMISSION_ACCEPTED: "admission_accepted",

  // Attendance
  STUDENT_ABSENT: "student_absent",
  STUDENT_LATE: "student_late",
  CHRONIC_ABSENCE_WARNING: "chronic_absence_warning",
  CHRONIC_ABSENCE_CRITICAL: "chronic_absence_critical",

  // Timetable
  SUBSTITUTION_ASSIGNED: "substitution_assigned",
  TIMETABLE_PUBLISHED: "timetable_published",

  // Boarding / Exeat
  EXEAT_APPROVED: "exeat_approved",
  EXEAT_REJECTED: "exeat_rejected",
  EXEAT_OVERDUE: "exeat_overdue",
  EXEAT_RETURNED: "exeat_returned",

  // Boarding / Incidents
  BOARDING_INCIDENT_REPORTED: "boarding_incident_reported",
  BOARDING_INCIDENT_CRITICAL: "boarding_incident_critical",

  // Boarding / Sick Bay
  SICK_BAY_ADMITTED: "sick_bay_admitted",
  SICK_BAY_REFERRED: "sick_bay_referred",
  SICK_BAY_DISCHARGED: "sick_bay_discharged",

  // Boarding / Maintenance
  MAINTENANCE_URGENT: "maintenance_urgent",

  // HR
  LEAVE_REQUESTED: "leave_requested",
  LEAVE_APPROVED: "leave_approved",
  LEAVE_REJECTED: "leave_rejected",
  PAYROLL_GENERATED: "payroll_generated",
  PAYROLL_APPROVED: "payroll_approved",
  CONTRACT_EXPIRING: "contract_expiring",
  STAFF_DISCIPLINE_REPORTED: "staff_discipline_reported",

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
  [NOTIFICATION_EVENTS.ADMISSION_SUBMITTED]: ["sms", "email"],
  [NOTIFICATION_EVENTS.ADMISSION_STATUS_CHANGED]: ["in_app", "email"],
  [NOTIFICATION_EVENTS.ADMISSION_ACCEPTED]: ["in_app", "sms", "email"],
  [NOTIFICATION_EVENTS.STUDENT_ABSENT]: ["in_app", "sms"],
  [NOTIFICATION_EVENTS.STUDENT_LATE]: ["in_app"],
  [NOTIFICATION_EVENTS.CHRONIC_ABSENCE_WARNING]: ["in_app", "sms"],
  [NOTIFICATION_EVENTS.CHRONIC_ABSENCE_CRITICAL]: ["in_app", "sms", "email"],
  [NOTIFICATION_EVENTS.SUBSTITUTION_ASSIGNED]: ["in_app", "sms"],
  [NOTIFICATION_EVENTS.TIMETABLE_PUBLISHED]: ["in_app"],
  [NOTIFICATION_EVENTS.EXEAT_APPROVED]: ["in_app", "sms"],
  [NOTIFICATION_EVENTS.EXEAT_REJECTED]: ["in_app", "sms"],
  [NOTIFICATION_EVENTS.EXEAT_OVERDUE]: ["in_app", "sms", "email"],
  [NOTIFICATION_EVENTS.EXEAT_RETURNED]: ["in_app"],
  [NOTIFICATION_EVENTS.BOARDING_INCIDENT_REPORTED]: ["in_app"],
  [NOTIFICATION_EVENTS.BOARDING_INCIDENT_CRITICAL]: ["in_app", "sms"],
  [NOTIFICATION_EVENTS.SICK_BAY_ADMITTED]: ["in_app", "sms"],
  [NOTIFICATION_EVENTS.SICK_BAY_REFERRED]: ["in_app", "sms", "email"],
  [NOTIFICATION_EVENTS.SICK_BAY_DISCHARGED]: ["in_app"],
  [NOTIFICATION_EVENTS.MAINTENANCE_URGENT]: ["in_app"],
  [NOTIFICATION_EVENTS.LEAVE_REQUESTED]: ["in_app", "email"],
  [NOTIFICATION_EVENTS.LEAVE_APPROVED]: ["in_app", "email"],
  [NOTIFICATION_EVENTS.LEAVE_REJECTED]: ["in_app", "email"],
  [NOTIFICATION_EVENTS.PAYROLL_GENERATED]: ["in_app"],
  [NOTIFICATION_EVENTS.PAYROLL_APPROVED]: ["in_app", "email"],
  [NOTIFICATION_EVENTS.CONTRACT_EXPIRING]: ["in_app", "email"],
  [NOTIFICATION_EVENTS.STAFF_DISCIPLINE_REPORTED]: ["in_app"],
  [NOTIFICATION_EVENTS.ANNOUNCEMENT_PUBLISHED]: ["in_app"],
  [NOTIFICATION_EVENTS.DISCIPLINE_INCIDENT]: ["in_app", "sms"],
  [NOTIFICATION_EVENTS.DISCIPLINE_RESOLVED]: ["in_app"],
  [NOTIFICATION_EVENTS.LOW_STOCK_ALERT]: ["in_app"],
};
