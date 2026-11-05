// Test safety net: a real OPENAI_API_KEY may exist in the developer's project .env, and tests must never
// see it or reach the network. Everything external is a fake injected by the individual test.
const QA_VARIABLES = [
  'AUTH_SECRET',
  'AUTH_GITHUB_ID',
  'AUTH_GITHUB_SECRET',
  'OWNER_GITHUB_ID',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'QA_DAILY_CAP',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'GITHUB_REPO',
  'GH_WRITEBACK_TOKEN',
  'BETTER_AUTH_URL',
];

for (const name of QA_VARIABLES) delete process.env[name];

if (process.env.OPENAI_API_KEY !== undefined) {
  // Name only. The value must never appear in a message.
  throw new Error('OPENAI_API_KEY is still set after the test guard ran; refusing to run tests.');
}

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  let origin = 'unknown';
  try {
    origin = new URL(target).origin;
  } catch {
    // relative URL
  }
  throw new Error(`network access is blocked in unit tests (${origin}); inject a fake fetch explicitly`);
}) as typeof fetch;
