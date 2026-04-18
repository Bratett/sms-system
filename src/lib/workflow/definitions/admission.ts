import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import type { WorkflowDefinition } from "../types";

interface AdmissionEntity {
  id: string;
  applicationNumber: string;
  applicationType: "STANDARD" | "PLACEMENT";
  isPlacementVerified: boolean;
  applicationFeeRequired: boolean;
  applicationFeePaid: boolean;
  interviewRequired: boolean;
}

export const ADMISSION_WORKFLOW_KEY = "admission";

export const ADMISSION_EVENTS = {
  SUBMIT: "SUBMIT",
  MARK_PAYMENT_PENDING: "MARK_PAYMENT_PENDING",
  CONFIRM_PAYMENT: "CONFIRM_PAYMENT",
  WAIVE_FEE: "WAIVE_FEE",
  BEGIN_REVIEW: "BEGIN_REVIEW",
  REQUEST_DOCUMENTS: "REQUEST_DOCUMENTS",
  DOCUMENTS_COMPLETE: "DOCUMENTS_COMPLETE",
  SCHEDULE_INTERVIEW: "SCHEDULE_INTERVIEW",
  RECORD_INTERVIEW: "RECORD_INTERVIEW",
  WAIVE_INTERVIEW: "WAIVE_INTERVIEW",
  DECIDE_ACCEPT: "DECIDE_ACCEPT",
  DECIDE_CONDITIONAL: "DECIDE_CONDITIONAL",
  DECIDE_WAITLIST: "DECIDE_WAITLIST",
  DECIDE_REJECT: "DECIDE_REJECT",
  ACCEPT_OFFER: "ACCEPT_OFFER",
  EXPIRE_OFFER: "EXPIRE_OFFER",
  ENROLL: "ENROLL",
  WITHDRAW: "WITHDRAW",
  APPEAL_UPHELD: "APPEAL_UPHELD",
  CANCEL: "CANCEL",
} as const;

/**
 * Mirrors AdmissionStatus in prisma/schema/student.prisma.
 * Keep these two in sync — the engine persists currentState as a string,
 * but the application's `status` column uses the enum.
 */
export const ADMISSION_STATES = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  DOCUMENTS_PENDING: "DOCUMENTS_PENDING",
  UNDER_REVIEW: "UNDER_REVIEW",
  SHORTLISTED: "SHORTLISTED",
  INTERVIEW_SCHEDULED: "INTERVIEW_SCHEDULED",
  AWAITING_DECISION: "AWAITING_DECISION",
  ACCEPTED: "ACCEPTED",
  CONDITIONAL_ACCEPT: "CONDITIONAL_ACCEPT",
  WAITLISTED: "WAITLISTED",
  REJECTED: "REJECTED",
  OFFER_EXPIRED: "OFFER_EXPIRED",
  WITHDRAWN: "WITHDRAWN",
  ENROLLED: "ENROLLED",
  CANCELLED: "CANCELLED",
} as const;

const NON_TERMINAL_PRE_DECISION = [
  ADMISSION_STATES.DRAFT,
  ADMISSION_STATES.SUBMITTED,
  ADMISSION_STATES.PAYMENT_PENDING,
  ADMISSION_STATES.DOCUMENTS_PENDING,
  ADMISSION_STATES.UNDER_REVIEW,
  ADMISSION_STATES.SHORTLISTED,
  ADMISSION_STATES.INTERVIEW_SCHEDULED,
  ADMISSION_STATES.AWAITING_DECISION,
];

export const admissionWorkflow: WorkflowDefinition<AdmissionEntity> = {
  key: ADMISSION_WORKFLOW_KEY,
  version: 1,
  entityType: "AdmissionApplication",
  initialState: ADMISSION_STATES.DRAFT,
  states: Object.values(ADMISSION_STATES),
  terminalStates: [
    ADMISSION_STATES.ENROLLED,
    // REJECTED is *not* terminal: an upheld appeal reopens the decision
    // (APPEAL_UPHELD → AWAITING_DECISION). The workflow engine treats
    // terminal states as frozen, so keeping REJECTED out preserves that path.
    ADMISSION_STATES.OFFER_EXPIRED,
    ADMISSION_STATES.WITHDRAWN,
    ADMISSION_STATES.CANCELLED,
  ],
  transitions: [
    // Intake
    {
      event: ADMISSION_EVENTS.SUBMIT,
      from: ADMISSION_STATES.DRAFT,
      to: ADMISSION_STATES.SUBMITTED,
      notifyEvent: NOTIFICATION_EVENTS.ADMISSION_SUBMITTED,
    },

    // Payment branch — skipped for fee-waived applications (e.g. placement students)
    {
      event: ADMISSION_EVENTS.MARK_PAYMENT_PENDING,
      from: ADMISSION_STATES.SUBMITTED,
      to: ADMISSION_STATES.PAYMENT_PENDING,
      guard: ({ entity }) =>
        entity.applicationFeeRequired && !entity.applicationFeePaid
          ? true
          : "Fee is not required or already paid.",
    },
    {
      event: ADMISSION_EVENTS.CONFIRM_PAYMENT,
      from: ADMISSION_STATES.PAYMENT_PENDING,
      to: ADMISSION_STATES.UNDER_REVIEW,
    },
    {
      event: ADMISSION_EVENTS.WAIVE_FEE,
      from: [ADMISSION_STATES.SUBMITTED, ADMISSION_STATES.PAYMENT_PENDING],
      to: ADMISSION_STATES.UNDER_REVIEW,
      allowedRoles: ["admin", "headmaster", "registrar"],
    },

    // Review
    {
      event: ADMISSION_EVENTS.BEGIN_REVIEW,
      from: ADMISSION_STATES.SUBMITTED,
      to: ADMISSION_STATES.UNDER_REVIEW,
      guard: ({ entity }) =>
        !entity.applicationFeeRequired || entity.applicationFeePaid
          ? true
          : "Application fee must be paid or waived before review.",
    },
    {
      event: ADMISSION_EVENTS.REQUEST_DOCUMENTS,
      from: ADMISSION_STATES.UNDER_REVIEW,
      to: ADMISSION_STATES.DOCUMENTS_PENDING,
    },
    {
      event: ADMISSION_EVENTS.DOCUMENTS_COMPLETE,
      from: ADMISSION_STATES.DOCUMENTS_PENDING,
      to: ADMISSION_STATES.UNDER_REVIEW,
    },

    // Interview
    {
      event: ADMISSION_EVENTS.SCHEDULE_INTERVIEW,
      from: ADMISSION_STATES.UNDER_REVIEW,
      to: ADMISSION_STATES.INTERVIEW_SCHEDULED,
      allowedRoles: ["admin", "registrar", "headmaster", "admissions_officer"],
      notifyEvent: NOTIFICATION_EVENTS.ADMISSION_INTERVIEW_SCHEDULED,
    },
    {
      event: ADMISSION_EVENTS.RECORD_INTERVIEW,
      from: ADMISSION_STATES.INTERVIEW_SCHEDULED,
      to: ADMISSION_STATES.AWAITING_DECISION,
      allowedRoles: ["admin", "registrar", "headmaster", "admissions_officer"],
    },
    {
      event: ADMISSION_EVENTS.WAIVE_INTERVIEW,
      from: [ADMISSION_STATES.UNDER_REVIEW, ADMISSION_STATES.INTERVIEW_SCHEDULED],
      to: ADMISSION_STATES.AWAITING_DECISION,
      allowedRoles: ["admin", "registrar", "headmaster", "admissions_officer"],
    },

    // Decisions (can be taken from UNDER_REVIEW or AWAITING_DECISION).
    // Permission-based authority is enforced at the action layer; the
    // workflow's role whitelist is a coarse safety net that spans all
    // admissions-related roles that might legitimately fire these events.
    {
      event: ADMISSION_EVENTS.DECIDE_ACCEPT,
      from: [
        ADMISSION_STATES.SUBMITTED, // auto-admit path: placement students skip review
        ADMISSION_STATES.UNDER_REVIEW,
        ADMISSION_STATES.AWAITING_DECISION,
      ],
      to: ADMISSION_STATES.ACCEPTED,
      allowedRoles: ["admin", "registrar", "headmaster", "admissions_officer", "system"],
      notifyEvent: NOTIFICATION_EVENTS.ADMISSION_ACCEPTED,
    },
    {
      event: ADMISSION_EVENTS.DECIDE_CONDITIONAL,
      from: [ADMISSION_STATES.UNDER_REVIEW, ADMISSION_STATES.AWAITING_DECISION],
      to: ADMISSION_STATES.CONDITIONAL_ACCEPT,
      allowedRoles: ["admin", "registrar", "headmaster", "admissions_officer"],
      notifyEvent: NOTIFICATION_EVENTS.ADMISSION_CONDITIONAL,
    },
    {
      event: ADMISSION_EVENTS.DECIDE_WAITLIST,
      from: [ADMISSION_STATES.UNDER_REVIEW, ADMISSION_STATES.AWAITING_DECISION],
      to: ADMISSION_STATES.WAITLISTED,
      allowedRoles: ["admin", "registrar", "headmaster", "admissions_officer"],
      notifyEvent: NOTIFICATION_EVENTS.ADMISSION_WAITLISTED,
    },
    {
      event: ADMISSION_EVENTS.DECIDE_REJECT,
      from: [ADMISSION_STATES.UNDER_REVIEW, ADMISSION_STATES.AWAITING_DECISION],
      to: ADMISSION_STATES.REJECTED,
      allowedRoles: ["admin", "registrar", "headmaster", "admissions_officer"],
      notifyEvent: NOTIFICATION_EVENTS.ADMISSION_REJECTED,
    },

    // Conditional → Accept (conditions met) / Reject (deadline missed)
    {
      event: ADMISSION_EVENTS.DECIDE_ACCEPT,
      from: ADMISSION_STATES.CONDITIONAL_ACCEPT,
      to: ADMISSION_STATES.ACCEPTED,
      allowedRoles: ["headmaster", "registrar"],
      notifyEvent: NOTIFICATION_EVENTS.ADMISSION_ACCEPTED,
    },
    {
      event: ADMISSION_EVENTS.DECIDE_REJECT,
      from: ADMISSION_STATES.CONDITIONAL_ACCEPT,
      to: ADMISSION_STATES.REJECTED,
      allowedRoles: ["headmaster"],
      notifyEvent: NOTIFICATION_EVENTS.ADMISSION_REJECTED,
    },

    // Waitlist → Accept (capacity freed) / Offer expired
    {
      event: ADMISSION_EVENTS.DECIDE_ACCEPT,
      from: ADMISSION_STATES.WAITLISTED,
      to: ADMISSION_STATES.ACCEPTED,
      allowedRoles: ["admin", "registrar", "headmaster", "system"],
      notifyEvent: NOTIFICATION_EVENTS.ADMISSION_ACCEPTED,
    },

    // Offer lifecycle. CONDITIONAL_ACCEPT is intentionally omitted from the
    // `from` list: conditional applicants must first have their conditions
    // verified and a DECIDE_ACCEPT fired by staff (from CONDITIONAL_ACCEPT →
    // ACCEPTED). Otherwise the guardian-facing ACCEPT_OFFER path would allow
    // them to self-promote past the condition gate.
    {
      event: ADMISSION_EVENTS.ACCEPT_OFFER,
      from: ADMISSION_STATES.ACCEPTED,
      to: ADMISSION_STATES.ACCEPTED,
    },
    {
      event: ADMISSION_EVENTS.EXPIRE_OFFER,
      from: [ADMISSION_STATES.ACCEPTED, ADMISSION_STATES.WAITLISTED],
      to: ADMISSION_STATES.OFFER_EXPIRED,
      notifyEvent: NOTIFICATION_EVENTS.ADMISSION_OFFER_EXPIRED,
    },

    // Enrollment
    {
      event: ADMISSION_EVENTS.ENROLL,
      from: ADMISSION_STATES.ACCEPTED,
      to: ADMISSION_STATES.ENROLLED,
      allowedRoles: ["admin", "registrar", "headmaster", "admissions_officer"],
      notifyEvent: NOTIFICATION_EVENTS.ADMISSION_ENROLLED,
    },

    // Appeal upheld: rejected → back into decision flow
    {
      event: ADMISSION_EVENTS.APPEAL_UPHELD,
      from: ADMISSION_STATES.REJECTED,
      to: ADMISSION_STATES.AWAITING_DECISION,
      allowedRoles: ["headmaster"],
      notifyEvent: NOTIFICATION_EVENTS.ADMISSION_APPEAL_RESOLVED,
    },

    // Withdrawal / cancel — available from any non-terminal pre-decision state
    {
      event: ADMISSION_EVENTS.WITHDRAW,
      from: [
        ...NON_TERMINAL_PRE_DECISION,
        ADMISSION_STATES.ACCEPTED,
        ADMISSION_STATES.CONDITIONAL_ACCEPT,
        ADMISSION_STATES.WAITLISTED,
      ],
      to: ADMISSION_STATES.WITHDRAWN,
    },
    {
      event: ADMISSION_EVENTS.CANCEL,
      from: NON_TERMINAL_PRE_DECISION,
      to: ADMISSION_STATES.CANCELLED,
      allowedRoles: ["admin", "registrar", "headmaster"],
    },
  ],
};
