/**
 * Shared types used across modules.
 * Centralizes common type definitions to prevent re-declarations in components.
 */

/** Standard server action result — either an error or data */
export type ActionResult<T> = { error: string } | { data: T };

/** Paginated response from server actions */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Standard select/dropdown option */
export interface SelectOption {
  value: string;
  label: string;
}

/** Grouped select option (for optgroup patterns) */
export interface GroupedSelectOption {
  group: string;
  options: SelectOption[];
}
