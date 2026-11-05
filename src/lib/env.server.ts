import 'server-only';
import { z } from 'zod';
import { logEvent } from './log';
import { isDevCapOptOutAllowed, MODE_ENV_KEYS, type EnvSource } from './runtime-mode';

// Nothing parses the environment at import time. getEnv() is called inside handlers only,
// so `next build` and Preview builds pass with zero environment variables.
// A blank value (for example `QA_DAILY_CAP=` copied from .env.example) means "unset".
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const text = z.preprocess(blankToUndefined, z.string().min(1));
const optionalText = z.preprocess(blankToUndefined, z.string().min(1).optional());
const numericId = z.preprocess(blankToUndefined, z.string().regex(/^\d+$/));

const QaEnvSchema = z.object({
  AUTH_SECRET: text,
  AUTH_GITHUB_ID: text,
  AUTH_GITHUB_SECRET: text,
  OWNER_GITHUB_ID: numericId,
  OPENAI_API_KEY: text,
  OPENAI_MODEL: optionalText,
  UPSTASH_REDIS_REST_URL: text,
  UPSTASH_REDIS_REST_TOKEN: text,
});

// Local `next dev` only (same triple check as the cap opt-out): OPENAI_API_KEY alone is enough. Owner sign-in is skipped,
// the daily cap uses an in-memory counter, and answers are signed with a fixed development secret.
const DevQaEnvSchema = z.object({
  OPENAI_API_KEY: text,
  OPENAI_MODEL: optionalText,
});
const DevAuthSchema = z.object({
  AUTH_SECRET: text,
  AUTH_GITHUB_ID: text,
  AUTH_GITHUB_SECRET: text,
  OWNER_GITHUB_ID: numericId,
});
const DEV_SECRET = 'local-development-only-secret-0123456789';

/** Model used when OPENAI_MODEL is unset or blank. */
export const DEFAULT_OPENAI_MODEL = 'gpt-6-luna';

const OptionalEnvSchema = z.object({
  GITHUB_REPO: optionalText,
  GH_WRITEBACK_TOKEN: optionalText,
  BETTER_AUTH_URL: optionalText,
});

const DEFAULT_DAILY_CAP = 50;

export type DailyCap = number | 'unlimited';

/**
 * `QA_PUBLIC=true` (or `1`) lets anyone ask without signing in. The daily cap still applies to all visitors together.
 * Off by default: the owner-only gate stays the default for every environment.
 */
function publicAccessOf(source: EnvSource): boolean {
  return ['1', 'true'].includes((source.QA_PUBLIC ?? '').trim().toLowerCase());
}

export type QaEnv = Required<z.infer<typeof QaEnvSchema>> &
  z.infer<typeof OptionalEnvSchema> & { cap: DailyCap; devLocal: boolean; publicAccess: boolean };

/**
 * Unset or blank -> 50. A positive integer -> that value. `0` -> unlimited, but only when the
 * development opt-out is allowed (local `next dev`). Anything else is invalid; there is no silent
 * fallback to 50 for a malformed value.
 */
function parseCap(source: EnvSource): DailyCap | null {
  const raw = source.QA_DAILY_CAP?.trim();
  if (raw === undefined || raw === '') return DEFAULT_DAILY_CAP;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isSafeInteger(n)) return null;
  if (n > 0) return n;
  return isDevCapOptOutAllowed(source) ? 'unlimited' : null;
}

// Upstash-compatible aliases (Vercel KV integration names) are used when the primary names are blank.
const UPSTASH_FALLBACKS = {
  UPSTASH_REDIS_REST_URL: 'KV_REST_API_URL',
  UPSTASH_REDIS_REST_TOKEN: 'KV_REST_API_TOKEN',
} as const;

function nonBlank(v: string | undefined): string | undefined {
  return v !== undefined && v.trim() !== '' ? v : undefined;
}

/** The source with blank primary Upstash names replaced by their fallback names. */
function resolveSource(source: EnvSource): EnvSource {
  const out: EnvSource = { ...source };
  for (const [primary, fallback] of Object.entries(UPSTASH_FALLBACKS)) {
    out[primary] = nonBlank(source[primary]) ?? nonBlank(source[fallback]);
  }
  return out;
}

const SCHEMA_KEYS = [
  ...Object.keys(QaEnvSchema.shape),
  ...Object.keys(OptionalEnvSchema.shape),
  'QA_DAILY_CAP',
  'QA_PUBLIC',
  ...Object.values(UPSTASH_FALLBACKS),
  ...MODE_ENV_KEYS,
];

let memo: { key: string; value: QaEnv | null } | undefined;

function readKey(source: EnvSource): string {
  return JSON.stringify(SCHEMA_KEYS.map((k) => source[k] ?? null));
}

function invalidKeysOf(raw: EnvSource): string[] {
  const source = resolveSource(raw);
  const keys: string[] = [];
  for (const schema of [isDevCapOptOutAllowed(source) ? DevQaEnvSchema : QaEnvSchema, OptionalEnvSchema]) {
    const r = schema.safeParse(source);
    if (!r.success) for (const issue of r.error.issues) keys.push(String(issue.path[0]));
  }
  if (parseCap(source) === null) keys.push('QA_DAILY_CAP');
  return [...new Set(keys)];
}

/** Validated Q&A configuration, or null when unconfigured or invalid (callers answer 503). Memoized per environment snapshot. */
export function getEnv(source: EnvSource = process.env): QaEnv | null {
  const key = readKey(source);
  if (memo && memo.key === key) return memo.value;
  const resolved = resolveSource(source);
  const devLocal = isDevCapOptOutAllowed(source);
  const opt = OptionalEnvSchema.safeParse(resolved);
  const cap = parseCap(source);
  let value: QaEnv | null = null;
  if (devLocal) {
    const dev = DevQaEnvSchema.safeParse(resolved);
    if (dev.success && opt.success && cap !== null) {
      // A complete owner-auth set keeps real sign-in even in development; only an incomplete set skips it.
      const auth = DevAuthSchema.safeParse(resolved);
      const ups = z.object({ UPSTASH_REDIS_REST_URL: text, UPSTASH_REDIS_REST_TOKEN: text }).safeParse(resolved);
      value = {
        ...(auth.success ? auth.data : { AUTH_SECRET: DEV_SECRET, AUTH_GITHUB_ID: '', AUTH_GITHUB_SECRET: '', OWNER_GITHUB_ID: '' }),
        ...(ups.success ? ups.data : { UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '' }),
        OPENAI_API_KEY: dev.data.OPENAI_API_KEY,
        OPENAI_MODEL: dev.data.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
        ...opt.data,
        cap,
        devLocal: !auth.success,
        publicAccess: publicAccessOf(source),
      };
    }
  } else {
    const req = QaEnvSchema.safeParse(resolved);
    if (req.success && opt.success && cap !== null) {
      value = {
        ...req.data,
        OPENAI_MODEL: req.data.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
        ...opt.data,
        cap,
        devLocal: false,
        publicAccess: publicAccessOf(source),
      };
    }
  }
  memo = { key, value };
  if (value === null) {
    const anyConfigured = SCHEMA_KEYS.some((k) => !(MODE_ENV_KEYS as readonly string[]).includes(k) && (source[k] ?? '').trim() !== '');
    if (anyConfigured) logEvent('qa.env_invalid', { invalidKeys: invalidKeysOf(source) });
  }
  return value;
}

export interface AuthSettings {
  secret: string;
  githubClientId: string;
  githubClientSecret: string;
  ownerGithubId: string;
}

/** The only place the auth variable names are mapped to neutral fields; other modules never name them. */
export function authSettings(env: QaEnv): AuthSettings {
  return {
    secret: env.AUTH_SECRET,
    githubClientId: env.AUTH_GITHUB_ID,
    githubClientSecret: env.AUTH_GITHUB_SECRET,
    ownerGithubId: env.OWNER_GITHUB_ID,
  };
}

/** Neutral accessors so other modules never name the provider variables. */
export function qaModel(env: QaEnv): string {
  return env.OPENAI_MODEL;
}

export function upstashSettings(env: QaEnv): { url: string; token: string } {
  return { url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN };
}

/** Save-to-PR write-back settings; null when the token or a valid `owner/name` repository is not configured. */
export function githubWriteback(env: QaEnv): { token: string; repo: string } | null {
  const token = env.GH_WRITEBACK_TOKEN;
  const repo = env.GITHUB_REPO?.trim();
  if (!token || !repo || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) return null;
  return { token, repo };
}

/** Names (never values) of the variables that make the Q&A configuration invalid or incomplete. */
export function invalidQaKeys(source: EnvSource = process.env): string[] {
  return getEnv(source) === null ? invalidKeysOf(source) : [];
}

export function isQaConfigured(source: EnvSource = process.env): boolean {
  return getEnv(source) !== null;
}
