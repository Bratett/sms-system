/**
 * Plugin architecture types.
 * Enables module enable/disable per school and third-party extensions.
 */

export interface ModuleDefinition {
  /** Unique module identifier */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Module category */
  category: ModuleCategory;
  /** Whether this module is a core module (cannot be disabled) */
  isCore: boolean;
  /** Module version */
  version: string;
  /** Required permissions to access this module */
  permissions: string[];
  /** Navigation config */
  navigation?: {
    icon: string;
    path: string;
    order: number;
  };
  /** Dependencies on other modules */
  dependencies?: string[];
}

export type ModuleCategory =
  | "core"
  | "academics"
  | "finance"
  | "operations"
  | "communication"
  | "analytics"
  | "extension";

export interface SchoolModuleConfig {
  moduleId: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}
