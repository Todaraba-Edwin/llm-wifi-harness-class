import 'server-only';

// Structured, allowlisted logging. Only these fields can ever be emitted, and values are
// restricted to names/numbers so no secret or user content reaches the log by construction.
const ALLOWED_FIELDS = ['invalidKeys'] as const;
type AllowedField = (typeof ALLOWED_FIELDS)[number];

// Single-value fields: a fixed-vocabulary reason code (lowercase snake_case), an HTTP status, and integer counters (remaining/cap).
export type LogFields = Partial<Record<AllowedField, string[]>> & { reason?: string; status?: number; remaining?: number; cap?: number };

export function logEvent(event: string, fields: LogFields = {}): void {
  const safe: Record<string, unknown> = { event };
  for (const key of ALLOWED_FIELDS) {
    const v = fields[key];
    if (v) safe[key] = v.filter((s) => /^[A-Z][A-Z0-9_]*$/.test(s));
  }
  if (typeof fields.reason === 'string' && /^[a-z][a-z0-9_]{0,40}$/.test(fields.reason)) safe.reason = fields.reason;
  if (typeof fields.status === 'number' && Number.isInteger(fields.status)) safe.status = fields.status;
  if (typeof fields.remaining === 'number' && Number.isInteger(fields.remaining)) safe.remaining = fields.remaining;
  if (typeof fields.cap === 'number' && Number.isInteger(fields.cap)) safe.cap = fields.cap;
  console.warn(JSON.stringify(safe));
}
