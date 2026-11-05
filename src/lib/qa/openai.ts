import 'server-only';
import OpenAI from 'openai';
import { getEnv, qaModel } from '../env.server';
import { logEvent } from '../log';
import { ATTEMPT_DEADLINE_MS } from './budget';
import { buildMessages } from './prompt';
import { answerJsonSchema } from './schema';

export const MAX_OUTPUT_TOKENS = 4000;

// The only module (besides env.server.ts) that names the provider key variable.
export function apiKey(): string | undefined {
  const v = process.env.OPENAI_API_KEY;
  return v !== undefined && v.trim() !== '' ? v : undefined;
}

/**
 * One billed OpenAI attempt. maxRetries is 0 (the SDK must never retry on its own), the SDK timeout
 * and the per-call signal bound the attempt. Every failure is the same fixed error: no provider text,
 * question, or key ever reaches a message.
 */
export async function askOpenAI(args: { question: string; deadlineMs: number; fetch?: typeof fetch }): Promise<unknown> {
  try {
    const key = apiKey();
    const env = getEnv();
    if (!key || !env) throw new Error('unconfigured');
    const client = new OpenAI({ apiKey: key, maxRetries: 0, timeout: ATTEMPT_DEADLINE_MS, ...(args.fetch ? { fetch: args.fetch } : {}) });
    const { instructions, input } = buildMessages(args.question);
    const response = await client.responses.create(
      {
        model: qaModel(env),
        instructions,
        input,
        store: false,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        text: { format: { type: 'json_schema', name: 'wiki_answer', strict: true, schema: answerJsonSchema as Record<string, unknown> } },
      },
      { signal: AbortSignal.timeout(args.deadlineMs) },
    );
    return JSON.parse(response.output_text);
  } catch (err) {
    // Diagnostics without content: HTTP status and a fixed reason class only (never the provider message, question or key).
    const status = typeof (err as { status?: unknown })?.status === 'number' ? (err as { status: number }).status : undefined;
    const reason = err instanceof SyntaxError ? 'bad_json' : err instanceof OpenAI.APIError ? 'api_error' : err instanceof Error && err.message === 'unconfigured' ? 'unconfigured' : 'other';
    logEvent('qa.provider_error', { reason, ...(status !== undefined ? { status } : {}) });
    throw Object.assign(new Error('openai_failed'), { providerStatus: status });
  }
}
