/**
 * Shared types for Ghana statutory return generators.
 *
 * A generator takes a snapshot of the relevant DB state for a period and
 * returns a typed payload + a renderable row array that the export layer
 * can dump to CSV or XLSX. Totals are always re-derived in the generator
 * so stale cached figures can't leak onto a filed return.
 */

export interface StatutoryReturnPeriod {
  /** Inclusive UTC start of the period the return covers. */
  from: Date;
  /** Exclusive UTC end. */
  to: Date;
  /** Human-facing label, e.g. "March 2026" or "Q1 2026". */
  label: string;
}

export interface EmployerContext {
  schoolId: string;
  schoolName: string;
  tin: string | null;
  ssnitEmployerNumber: string | null;
  getFundCode: string | null;
  graVatTin: string | null;
  ghanaEducationServiceCode: string | null;
}

export interface StatutoryReturnTotals {
  [key: string]: number;
}

export interface StatutoryReturn<Row> {
  kind: string;
  period: StatutoryReturnPeriod;
  employer: EmployerContext;
  /**
   * Readonly so generators can't accidentally mutate filed figures after
   * `totals` has been computed. Every generator builds rows via `.map()`
   * and returns them as-is.
   */
  rows: readonly Row[];
  totals: StatutoryReturnTotals;
  generatedAt: Date;
}

export interface MissingIdentifier {
  field: keyof EmployerContext;
  reason: string;
}
