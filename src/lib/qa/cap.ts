import 'server-only';
import { getEnv } from '../env.server';
import { logEvent } from '../log';
import { capNamespace, isDevCapOptOutAllowed, type EnvSource } from '../runtime-mode';
import { getCounterStore, type CounterStore } from './store';

export type CapResult =
  | { ok: true; count: number; cap: number | 'unlimited' }
  | { ok: false; reason: 'exceeded' | 'unavailable'; cap: number };

const SEOUL_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Seoul calendar day as YYYY-MM-DD. */
export function seoulDay(now: Date): string {
  return SEOUL_DATE.format(now);
}

export function capKey(source: EnvSource, now: Date): string {
  return `qa:cap:${capNamespace(source)}:${seoulDay(now)}`;
}

/**
 * Reserves one OpenAI call against today's budget. Fails closed: any store problem is `unavailable`.
 * `unlimited` skips the store, and only exists when the development opt-out is allowed (otherwise this throws).
 */
export async function reserveCap(source: EnvSource = process.env, store?: CounterStore | null, now: Date = new Date()): Promise<CapResult> {
  const env = getEnv(source);
  if (!env) return { ok: false, reason: 'unavailable', cap: 0 };
  if (env.cap === 'unlimited') {
    if (!isDevCapOptOutAllowed(source)) throw new Error('unlimited_cap_not_allowed');
    logEvent('qa.cap_disabled');
    return { ok: true, count: 0, cap: 'unlimited' };
  }
  const cap = env.cap;
  try {
    const s = store === undefined ? getCounterStore(source) : store;
    if (!s) return { ok: false, reason: 'unavailable', cap };
    const r = await s.reserve(capKey(source, now), cap);
    if (!r.allowed) return { ok: false, reason: 'exceeded', cap };
    return { ok: true, count: r.count, cap };
  } catch {
    logEvent('qa.cap_unavailable', { reason: 'store_error' });
    return { ok: false, reason: 'unavailable', cap };
  }
}
