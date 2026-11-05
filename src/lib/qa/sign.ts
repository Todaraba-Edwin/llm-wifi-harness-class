import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ValidatedAnswer } from './validate';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** What the HMAC covers: the trimmed question, the validated answer (incl. title_en/title_ko/summary) and the issue time. */
export interface SignedPayload {
  question: string;
  answer: ValidatedAnswer;
  /** Epoch milliseconds at signing time. */
  iat: number;
}

export const SIGNATURE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const SIGNATURE_MAX_SKEW_MS = 5 * 60 * 1000;

function mac(payload: SignedPayload, secret: string): Buffer {
  return createHmac('sha256', secret).update(canonical({ question: payload.question, answer: payload.answer, iat: payload.iat })).digest();
}

/** HMAC-SHA256 (hex) over the canonical (key-sorted) JSON of {question, answer, iat}. */
export function signAnswer(payload: SignedPayload, secret: string): string {
  return mac(payload, secret).toString('hex');
}

/** True only for a matching HMAC whose `iat` is at most 7 days old and at most 5 minutes in the future. */
export function verifyAnswerSignature(payload: SignedPayload, sig: string, secret: string, now: number = Date.now()): boolean {
  if (typeof sig !== 'string' || !/^[0-9a-f]{64}$/.test(sig)) return false;
  if (!Number.isFinite(payload.iat) || now - payload.iat > SIGNATURE_MAX_AGE_MS || payload.iat - now > SIGNATURE_MAX_SKEW_MS) return false;
  return timingSafeEqual(mac(payload, secret), Buffer.from(sig, 'hex'));
}
