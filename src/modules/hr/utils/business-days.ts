/**
 * Calculate business days between two dates, excluding weekends and optionally public holidays.
 */
export function getBusinessDays(start: Date, end: Date, holidays?: Set<string>): number {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Check if this date is a holiday
      if (!holidays || !holidays.has(toDateKey(current))) {
        count++;
      }
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Convert a Date to YYYY-MM-DD string for holiday lookup.
 */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
