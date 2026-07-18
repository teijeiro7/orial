/**
 * Returns today's date as YYYY-MM-DD string.
 * Use this instead of new Date().toISOString().split('T')[0].
 */
export function todayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Returns a date as YYYY-MM-DD string.
 */
export function dateString(date: Date): string {
  return date.toISOString().split('T')[0];
}
