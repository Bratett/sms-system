import type {
  WorkflowDefinition,
  WorkflowTransitionContext,
  WorkflowTransitionDef,
} from "./types";

export class WorkflowTransitionError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_EVENT"
      | "INVALID_STATE"
      | "GUARD_FAILED"
      | "ROLE_NOT_ALLOWED"
      | "TERMINAL_STATE",
  ) {
    super(message);
    this.name = "WorkflowTransitionError";
  }
}

export interface ResolvedTransition<TEntity = unknown> {
  definition: WorkflowTransitionDef<TEntity>;
  toState: string;
}

/**
 * Pure reducer: given a definition, the current state, an event, and a transition
 * context, resolve the next state or throw `WorkflowTransitionError`. No I/O.
 */
export function resolveTransition<TEntity>(
  definition: WorkflowDefinition<TEntity>,
  currentState: string,
  event: string,
  ctx: WorkflowTransitionContext<TEntity>,
): ResolvedTransition<TEntity> {
  if (definition.terminalStates.includes(currentState)) {
    throw new WorkflowTransitionError(
      `Instance already in terminal state '${currentState}'.`,
      "TERMINAL_STATE",
    );
  }

  const candidates = definition.transitions.filter((t) => t.event === event);
  if (candidates.length === 0) {
    throw new WorkflowTransitionError(
      `Event '${event}' is not defined in workflow '${definition.key}'.`,
      "INVALID_EVENT",
    );
  }

  const fromMatch = candidates.find((t) => {
    const from = Array.isArray(t.from) ? t.from : [t.from];
    return from.includes(currentState);
  });
  if (!fromMatch) {
    throw new WorkflowTransitionError(
      `Event '${event}' cannot be fired from state '${currentState}'.`,
      "INVALID_STATE",
    );
  }

  if (fromMatch.allowedRoles && fromMatch.allowedRoles.length > 0) {
    if (!ctx.actor.role || !fromMatch.allowedRoles.includes(ctx.actor.role)) {
      throw new WorkflowTransitionError(
        `Actor role '${ctx.actor.role ?? "<none>"}' is not permitted for event '${event}'.`,
        "ROLE_NOT_ALLOWED",
      );
    }
  }

  if (fromMatch.guard) {
    const ok = fromMatch.guard(ctx);
    if (ok !== true) {
      throw new WorkflowTransitionError(
        typeof ok === "string" ? ok : `Guard failed for event '${event}'.`,
        "GUARD_FAILED",
      );
    }
  }

  return { definition: fromMatch, toState: fromMatch.to };
}

/** Returns the set of events that are legal from the given state (ignoring guards). */
export function legalEvents<TEntity>(
  definition: WorkflowDefinition<TEntity>,
  currentState: string,
): string[] {
  if (definition.terminalStates.includes(currentState)) return [];
  return Array.from(
    new Set(
      definition.transitions
        .filter((t) => {
          const from = Array.isArray(t.from) ? t.from : [t.from];
          return from.includes(currentState);
        })
        .map((t) => t.event),
    ),
  );
}
