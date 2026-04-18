import type { WorkflowDefinition } from "../types";
import { admissionWorkflow } from "./admission";
import { exeatWorkflow } from "./exeat";

const registry = new Map<string, WorkflowDefinition<unknown>>();

function register<T>(def: WorkflowDefinition<T>): void {
  if (registry.has(def.key)) {
    throw new Error(`Workflow '${def.key}' already registered.`);
  }
  registry.set(def.key, def as WorkflowDefinition<unknown>);
}

register(exeatWorkflow);
register(admissionWorkflow);

export function getDefinition(key: string): WorkflowDefinition<unknown> {
  const def = registry.get(key);
  if (!def) throw new Error(`Unknown workflow definition '${key}'.`);
  return def;
}

export function listDefinitions(): WorkflowDefinition<unknown>[] {
  return Array.from(registry.values());
}
