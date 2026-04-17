import type { NotificationEvent } from "@/lib/notifications/events";

export interface WorkflowActor {
  userId: string;
  role?: string;
}

export interface WorkflowTransitionContext<TEntity = unknown> {
  entity: TEntity;
  actor: WorkflowActor;
  payload?: Record<string, unknown>;
}

export interface WorkflowEffectContext<TEntity = unknown> extends WorkflowTransitionContext<TEntity> {
  schoolId: string;
  instanceId: string;
  fromState: string;
  toState: string;
  event: string;
}

export type WorkflowGuard<TEntity = unknown> = (
  ctx: WorkflowTransitionContext<TEntity>,
) => true | string;

export type WorkflowEffect<TEntity = unknown> = (
  ctx: WorkflowEffectContext<TEntity>,
) => Promise<void> | void;

export interface WorkflowTransitionDef<TEntity = unknown> {
  from: string | string[];
  to: string;
  event: string;
  /** Optional role whitelist; if set, actor.role must be included. */
  allowedRoles?: string[];
  /** Optional guard returning `true` or an error message. */
  guard?: WorkflowGuard<TEntity>;
  /** Optional notification event to dispatch on successful transition. */
  notifyEvent?: NotificationEvent;
  /** Optional side-effects run after the transition commits. */
  effects?: WorkflowEffect<TEntity>[];
}

export interface WorkflowDefinition<TEntity = unknown> {
  key: string;
  version: number;
  entityType: string;
  initialState: string;
  terminalStates: string[];
  states: string[];
  transitions: WorkflowTransitionDef<TEntity>[];
  /** Optional SLA in ms from instance start; surfaces via slaDueAt for dashboards. */
  slaMs?: number;
}

export interface WorkflowInstanceSummary {
  id: string;
  schoolId: string;
  definitionKey: string;
  definitionVersion: number;
  entityType: string;
  entityId: string;
  currentState: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED" | "FAILED";
}
