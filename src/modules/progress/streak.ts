const DAY_MS = 86_400_000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Consecutive UTC days (ending today or yesterday) with at least one submission. */
export function computeStreak(submissionDates: Date[], now = new Date()): number {
  const days = new Set(submissionDates.map(dayKey));
  let cursor = new Date(now);
  if (!days.has(dayKey(cursor))) cursor = new Date(cursor.getTime() - DAY_MS);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}
