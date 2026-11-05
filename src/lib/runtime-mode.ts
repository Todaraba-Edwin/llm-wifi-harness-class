import 'server-only';

// The literal `process.env.NODE_ENV` reference is replaced by Next at build time: it is
// 'production' in every `next build` artifact (unless experimental.allowDevelopmentBuild is set,
// which scripts/verify-build.ts rejects). `next start` keeps a runtime NODE_ENV of 'development'
// with only a warning, so the runtime value alone must never open the development opt-out.
export const BUILD_NODE_ENV: string | undefined = process.env.NODE_ENV;

export type EnvSource = Record<string, string | undefined>;

/** `QA_DAILY_CAP=0` (unlimited) is honored only for a local `next dev`: build literal, runtime value and VERCEL all agree. */
export function isDevCapOptOutAllowed(source: EnvSource, buildNodeEnv: string | undefined = BUILD_NODE_ENV): boolean {
  return buildNodeEnv === 'development' && source.NODE_ENV === 'development' && !source.VERCEL;
}

/** One definition of "production-like" for guards (MemoryCounterStore, base URL, cap namespace). */
export function isProductionLike(source: EnvSource, buildNodeEnv: string | undefined = BUILD_NODE_ENV): boolean {
  return buildNodeEnv === 'production' || source.NODE_ENV === 'production' || Boolean(source.VERCEL);
}

export type CapNamespace = 'local' | 'preview' | 'production';

/** Keeps local and preview runs from consuming the production daily budget in a shared Upstash database. */
export function capNamespace(source: EnvSource, buildNodeEnv: string | undefined = BUILD_NODE_ENV): CapNamespace {
  if (source.VERCEL_ENV === 'preview') return 'preview';
  if (source.VERCEL_ENV === 'production') return 'production';
  return isProductionLike(source, buildNodeEnv) ? 'production' : 'local';
}

/** Environment variables that change how the mode helpers decide; part of the getEnv memo key. */
export const MODE_ENV_KEYS = ['NODE_ENV', 'VERCEL', 'VERCEL_ENV'] as const;
