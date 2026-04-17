import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import type { WorkflowDefinition } from "../types";

interface ExeatEntity {
  id: string;
  type: "NORMAL" | "EMERGENCY" | "MEDICAL" | "WEEKEND" | "VACATION";
  exeatNumber: string;
  studentId: string;
}

export const EXEAT_WORKFLOW_KEY = "exeat";

export const EXEAT_EVENTS = {
  HOUSEMASTER_APPROVE: "HOUSEMASTER_APPROVE",
  HEADMASTER_APPROVE: "HEADMASTER_APPROVE",
  REJECT: "REJECT",
  DEPART: "DEPART",
  RETURN: "RETURN",
  MARK_OVERDUE: "MARK_OVERDUE",
  CANCEL: "CANCEL",
} as const;

export const EXEAT_STATES = {
  REQUESTED: "REQUESTED",
  HOUSEMASTER_APPROVED: "HOUSEMASTER_APPROVED",
  HEADMASTER_APPROVED: "HEADMASTER_APPROVED",
  REJECTED: "REJECTED",
  DEPARTED: "DEPARTED",
  RETURNED: "RETURNED",
  OVERDUE: "OVERDUE",
  CANCELLED: "CANCELLED",
} as const;

export const exeatWorkflow: WorkflowDefinition<ExeatEntity> = {
  key: EXEAT_WORKFLOW_KEY,
  version: 1,
  entityType: "Exeat",
  initialState: EXEAT_STATES.REQUESTED,
  states: Object.values(EXEAT_STATES),
  terminalStates: [
    EXEAT_STATES.RETURNED,
    EXEAT_STATES.REJECTED,
    EXEAT_STATES.CANCELLED,
  ],
  transitions: [
    {
      event: EXEAT_EVENTS.HOUSEMASTER_APPROVE,
      from: EXEAT_STATES.REQUESTED,
      to: EXEAT_STATES.HOUSEMASTER_APPROVED,
      allowedRoles: ["housemaster"],
    },
    {
      event: EXEAT_EVENTS.HEADMASTER_APPROVE,
      from: EXEAT_STATES.HOUSEMASTER_APPROVED,
      to: EXEAT_STATES.HEADMASTER_APPROVED,
      allowedRoles: ["headmaster"],
      notifyEvent: NOTIFICATION_EVENTS.EXEAT_APPROVED,
    },
    // Emergency/medical exeats may skip housemaster approval.
    {
      event: EXEAT_EVENTS.HEADMASTER_APPROVE,
      from: EXEAT_STATES.REQUESTED,
      to: EXEAT_STATES.HEADMASTER_APPROVED,
      allowedRoles: ["headmaster"],
      guard: ({ entity }) =>
        entity.type === "EMERGENCY" || entity.type === "MEDICAL"
          ? true
          : "Only EMERGENCY or MEDICAL exeats may skip housemaster approval.",
      notifyEvent: NOTIFICATION_EVENTS.EXEAT_APPROVED,
    },
    {
      event: EXEAT_EVENTS.REJECT,
      from: [EXEAT_STATES.REQUESTED, EXEAT_STATES.HOUSEMASTER_APPROVED],
      to: EXEAT_STATES.REJECTED,
      allowedRoles: ["housemaster", "headmaster"],
      notifyEvent: NOTIFICATION_EVENTS.EXEAT_REJECTED,
    },
    {
      event: EXEAT_EVENTS.DEPART,
      from: EXEAT_STATES.HEADMASTER_APPROVED,
      to: EXEAT_STATES.DEPARTED,
    },
    {
      event: EXEAT_EVENTS.RETURN,
      from: [EXEAT_STATES.DEPARTED, EXEAT_STATES.OVERDUE],
      to: EXEAT_STATES.RETURNED,
      notifyEvent: NOTIFICATION_EVENTS.EXEAT_RETURNED,
    },
    {
      event: EXEAT_EVENTS.MARK_OVERDUE,
      from: EXEAT_STATES.DEPARTED,
      to: EXEAT_STATES.OVERDUE,
      notifyEvent: NOTIFICATION_EVENTS.EXEAT_OVERDUE,
    },
    {
      event: EXEAT_EVENTS.CANCEL,
      from: [
        EXEAT_STATES.REQUESTED,
        EXEAT_STATES.HOUSEMASTER_APPROVED,
        EXEAT_STATES.HEADMASTER_APPROVED,
      ],
      to: EXEAT_STATES.CANCELLED,
    },
  ],
};
