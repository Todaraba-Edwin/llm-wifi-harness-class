export const REQUEST_BUDGET_MS = 150_000;
export const ATTEMPT_DEADLINE_MS = 60_000;
export const RETRY_MIN_REMAINING_MS = 45_000;
export const MARGIN_MS = 5_000;

/** Deadline for one attempt given the remaining request budget; never exceeds the budget minus the margin. */
export function attemptDeadline(remainingMs: number): number {
  return Math.max(0, Math.min(ATTEMPT_DEADLINE_MS, remainingMs - MARGIN_MS));
}

/** A validation-failure retry is only worth a new cap unit when a meaningful window remains. */
export function canRetry(remainingMs: number): boolean {
  return remainingMs >= RETRY_MIN_REMAINING_MS;
}
