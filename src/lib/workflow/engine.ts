import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { dispatch } from "@/lib/notifications/dispatcher";
import { resolveTransition, WorkflowTransitionError } from "./state-machine";
import { getDefinition } from "./definitions";
import type {
  WorkflowActor,
  WorkflowDefinition,
  WorkflowEffectContext,
} from "./types";

type TxClient = Prisma.TransactionClient;

interface TransitionOptions<TEntity> {
  definitionKey: string;
  entity: TEntity & { id: string };
  entityType: string;
  event: string;
  schoolId: string;
  actor: WorkflowActor;
  reason?: string;
  payload?: Record<string, unknown>;
  /** Optional domain mutations executed inside the same transaction as the state update.
   *  Each callback receives the Prisma transaction client. */
  extraMutations?: ((tx: TxClient) => Promise<unknown>)[];
  /** Optional recipients for the notifyEvent dispatch. */
  notifyRecipients?: {
    userId?: string;
    phone?: string;
    email?: string;
    name?: string;
  }[];
  notifyTitle?: string;
  notifyMessage?: string;
}

interface TransitionResult {
  instanceId: string;
  fromState: string;
  toState: string;
  completed: boolean;
}

/**
 * Start a new workflow instance in its initial state. Idempotent on (entityType, entityId).
 */
export async function startWorkflow(params: {
  definitionKey: string;
  entityType: string;
  entityId: string;
  schoolId: string;
  startedBy: string;
  metadata?: Record<string, unknown>;
}): Promise<{ instanceId: string; currentState: string }> {
  const def = getDefinition(params.definitionKey);

  const existing = await db.workflowInstance.findUnique({
    where: {
      entityType_entityId: {
        entityType: params.entityType,
        entityId: params.entityId,
      },
    },
    select: { id: true, currentState: true },
  });
  if (existing) {
    return { instanceId: existing.id, currentState: existing.currentState };
  }

  const slaDueAt = def.slaMs ? new Date(Date.now() + def.slaMs) : null;

  const instance = await db.workflowInstance.create({
    data: {
      schoolId: params.schoolId,
      definitionKey: def.key,
      definitionVersion: def.version,
      entityType: params.entityType,
      entityId: params.entityId,
      currentState: def.initialState,
      slaDueAt,
      startedBy: params.startedBy,
      metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
    },
  });

  return { instanceId: instance.id, currentState: instance.currentState };
}

/**
 * Fire an event against a workflow instance. Resolves the target state via the reducer,
 * writes a transition row atomically with the instance update, records an audit entry,
 * and runs declarative effects (notifications) after commit.
 */
export async function transitionWorkflow<TEntity extends { id: string }>(
  opts: TransitionOptions<TEntity> & {
    /** Prefetched instance; skips the DB lookup. */
    instance?: { id: string; currentState: string; schoolId: string };
  },
): Promise<TransitionResult> {
  const def = getDefinition(opts.definitionKey) as WorkflowDefinition<TEntity>;

  const instance =
    opts.instance ??
    (await db.workflowInstance.findUnique({
      where: {
        entityType_entityId: {
          entityType: opts.entityType,
          entityId: opts.entity.id,
        },
      },
    }));
  if (!instance) {
    throw new WorkflowTransitionError(
      `No workflow instance for ${opts.entityType}:${opts.entity.id}.`,
      "INVALID_STATE",
    );
  }
  if (instance.schoolId !== opts.schoolId) {
    throw new WorkflowTransitionError(
      "Workflow instance does not belong to current tenant.",
      "INVALID_STATE",
    );
  }

  const { definition: transitionDef, toState } = resolveTransition(
    def,
    instance.currentState,
    opts.event,
    { entity: opts.entity, actor: opts.actor, payload: opts.payload },
  );

  const completed = def.terminalStates.includes(toState);

  const updated = await db.$transaction(async (tx) => {
    const instanceUpdate = await tx.workflowInstance.update({
      where: { id: instance.id },
      data: {
        currentState: toState,
        status: completed ? "COMPLETED" : "ACTIVE",
        completedAt: completed ? new Date() : null,
      },
    });
    await tx.workflowTransition.create({
      data: {
        instanceId: instance.id,
        schoolId: opts.schoolId,
        fromState: instance.currentState,
        toState,
        event: opts.event,
        actorId: opts.actor.userId,
        actorRole: opts.actor.role,
        reason: opts.reason,
        payload: opts.payload ? JSON.parse(JSON.stringify(opts.payload)) : undefined,
      },
    });
    if (opts.extraMutations) {
      for (const m of opts.extraMutations) {
        await m(tx);
      }
    }
    return instanceUpdate;
  });

  await audit({
    userId: opts.actor.userId,
    schoolId: opts.schoolId,
    userRole: opts.actor.role,
    action: completed ? "APPROVE" : "UPDATE",
    entity: opts.entityType,
    entityId: opts.entity.id,
    module: "workflow",
    description: `Workflow '${def.key}' transitioned ${instance.currentState} → ${toState} via '${opts.event}'.`,
    previousData: { state: instance.currentState },
    newData: { state: toState, event: opts.event },
    metadata: opts.reason ? { reason: opts.reason } : undefined,
  });

  if (transitionDef.notifyEvent && opts.notifyRecipients && opts.notifyRecipients.length > 0) {
    await dispatch({
      event: transitionDef.notifyEvent,
      title: opts.notifyTitle ?? `${opts.entityType} ${toState}`,
      message: opts.notifyMessage ?? `Transitioned to ${toState}.`,
      recipients: opts.notifyRecipients,
      schoolId: opts.schoolId,
    });
  }

  if (transitionDef.effects && transitionDef.effects.length > 0) {
    const effectCtx: WorkflowEffectContext<TEntity> = {
      entity: opts.entity,
      actor: opts.actor,
      payload: opts.payload,
      schoolId: opts.schoolId,
      instanceId: instance.id,
      fromState: instance.currentState,
      toState,
      event: opts.event,
    };
    for (const effect of transitionDef.effects) {
      try {
        await effect(effectCtx);
      } catch (err) {
        // Effects are fire-and-forget; log but don't roll back the transition.
        // The engine-level transition has already committed.
        console.error(
          `[workflow] effect failed for ${def.key}:${opts.event}:`,
          err,
        );
      }
    }
  }

  return {
    instanceId: updated.id,
    fromState: instance.currentState,
    toState,
    completed,
  };
}

/**
 * Backward-compat helper: if a workflow instance is missing for the given entity,
 * start one at the entity's current domain state before transitioning. Used by
 * actions that have been migrated onto the engine but may run against rows that
 * predate the migration.
 */
interface AutoStartOptions<TEntity extends { id: string; status: string; schoolId?: string }> {
  event: string;
  entity: TEntity;
  schoolId: string;
  actor: WorkflowActor;
  reason?: string;
  payload?: Record<string, unknown>;
  extraMutations?: ((tx: TxClient) => Promise<unknown>)[];
  /** Defaults derived from the entity but can be overridden. */
  definitionKey?: string;
  entityType?: string;
}

export async function transitionWorkflowWithAutoStart<
  TEntity extends { id: string; status: string },
>(opts: AutoStartOptions<TEntity>): Promise<TransitionResult> {
  // Infer definition key + entity type from defaults in caller's import; callers
  // that want explicit types should pass them, but the common case (exeat) auto-resolves.
  const definitionKey = opts.definitionKey ?? "exeat";
  const entityType = opts.entityType ?? "Exeat";

  const existing = await db.workflowInstance.findUnique({
    where: { entityType_entityId: { entityType, entityId: opts.entity.id } },
  });

  let instance: { id: string; currentState: string; schoolId: string };
  if (existing) {
    instance = existing;
  } else {
    const def = getDefinition(definitionKey);
    const fastForwardState = def.states.includes(opts.entity.status)
      ? opts.entity.status
      : def.initialState;
    const created = await db.workflowInstance.create({
      data: {
        schoolId: opts.schoolId,
        definitionKey: def.key,
        definitionVersion: def.version,
        entityType,
        entityId: opts.entity.id,
        currentState: fastForwardState,
        startedBy: opts.actor.userId,
      },
    });
    instance = {
      id: created.id,
      currentState: created.currentState,
      schoolId: created.schoolId,
    };
  }

  return transitionWorkflow({
    definitionKey,
    entityType,
    entity: opts.entity,
    event: opts.event,
    schoolId: opts.schoolId,
    actor: opts.actor,
    reason: opts.reason,
    payload: opts.payload,
    extraMutations: opts.extraMutations,
    instance,
  });
}

/** Read current state without firing a transition. */
export async function getWorkflowState(
  entityType: string,
  entityId: string,
): Promise<{ currentState: string; status: string } | null> {
  const instance = await db.workflowInstance.findUnique({
    where: { entityType_entityId: { entityType, entityId } },
    select: { currentState: true, status: true },
  });
  return instance;
}

export { WorkflowTransitionError };
