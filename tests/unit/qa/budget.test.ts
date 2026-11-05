import { describe, expect, it } from 'vitest';
import { ATTEMPT_DEADLINE_MS, attemptDeadline, canRetry, MARGIN_MS, REQUEST_BUDGET_MS, RETRY_MIN_REMAINING_MS } from '@/lib/qa/budget';
import { maxDuration } from '@/app/api/qa/route';

describe('request time budget', () => {
  it('fits inside the platform limit with the attempt, one retry and the margin', () => {
    expect(REQUEST_BUDGET_MS).toBeLessThan(maxDuration * 1000);
    expect(ATTEMPT_DEADLINE_MS + ATTEMPT_DEADLINE_MS + MARGIN_MS).toBeLessThanOrEqual(REQUEST_BUDGET_MS);
    expect(RETRY_MIN_REMAINING_MS).toBeLessThan(REQUEST_BUDGET_MS - ATTEMPT_DEADLINE_MS);
  });
  it('attemptDeadline = min(60s, remaining - margin), never negative', () => {
    expect(attemptDeadline(150_000)).toBe(60_000);
    expect(attemptDeadline(65_000)).toBe(60_000);
    expect(attemptDeadline(64_999)).toBe(59_999);
    expect(attemptDeadline(50_000)).toBe(45_000);
    expect(attemptDeadline(3_000)).toBe(0);
  });
  it('canRetry flips exactly at 45s', () => {
    expect(canRetry(44_999)).toBe(false);
    expect(canRetry(45_000)).toBe(true);
  });
});
