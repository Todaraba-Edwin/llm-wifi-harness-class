import 'server-only';
import OpenAI from 'openai';
import { getEnv, qaModel } from '../env.server';
import { logEvent } from '../log';
import { apiKey, MAX_OUTPUT_TOKENS } from './openai';

export interface WebAnswer {
  text: string;
  sources: { title: string; url: string }[];
}

/** One billed OpenAI call with the hosted web_search tool. Not wiki-grounded; the UI labels it as such. */
export async function askWeb(args: { question: string; deadlineMs: number }): Promise<WebAnswer> {
  try {
    const key = apiKey();
    const env = getEnv();
    if (!key || !env) throw new Error('unconfigured');
    const client = new OpenAI({ apiKey: key, maxRetries: 0, timeout: args.deadlineMs });
    const res = await client.responses.create(
      {
        model: qaModel(env),
        instructions: '웹 검색 결과를 근거로 한국어로 간결하게 답한다. 확인되지 않은 내용은 추측하지 않는다.',
        input: args.question,
        store: false,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        tools: [{ type: 'web_search' }],
      },
      { signal: AbortSignal.timeout(args.deadlineMs) },
    );
    const sources = new Map<string, string>();
    for (const item of res.output) {
      if (item.type !== 'message') continue;
      for (const c of item.content) {
        if (c.type !== 'output_text') continue;
        for (const a of c.annotations ?? []) {
          if (a.type === 'url_citation' && /^https?:\/\//.test(a.url)) sources.set(a.url, a.title || a.url);
        }
      }
    }
    return { text: res.output_text, sources: [...sources].slice(0, 8).map(([url, title]) => ({ url, title })) };
  } catch (err) {
    const status = typeof (err as { status?: unknown })?.status === 'number' ? (err as { status: number }).status : undefined;
    logEvent('qa.provider_error', { reason: 'web_search', ...(status !== undefined ? { status } : {}) });
    throw Object.assign(new Error('web_failed'), { providerStatus: status });
  }
}
