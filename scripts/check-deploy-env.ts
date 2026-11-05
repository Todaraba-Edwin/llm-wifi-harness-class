/**
 * Probes a running production-mode server (started with VERCEL=1, NODE_ENV=production and the deployment
 * variables) and reports whether the Q&A configuration is valid, without ever printing a value.
 *
 *   tsx scripts/check-deploy-env.ts <baseUrl> [--require-env]
 *
 * Configured:   anonymous POST /api/qa -> 401 (owner gate reached) and /ask renders the sign-in shell.
 * Unconfigured: anonymous POST /api/qa -> 503 and /ask says "Q&A 비활성". Fails only with --require-env.
 * Always required: the site itself serves, /api/qa never answers 200 anonymously, forged auth endpoints 404.
 */
const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith('--')) ?? '').replace(/\/$/, '');
const requireEnv = args.includes('--require-env');
if (!/^https?:\/\//.test(base)) {
  console.error('usage: check-deploy-env <baseUrl> [--require-env]');
  process.exit(2);
}

export {};

const failures: string[] = [];
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) failures.push(label);
};

async function status(path: string, init?: RequestInit): Promise<{ status: number; text: string }> {
  const res = await fetch(base + path, { redirect: 'manual', ...init });
  return { status: res.status, text: await res.text() };
}

async function main(): Promise<void> {
const home = await status('/');
check(home.status === 200, 'GET / = 200');

const ask = await status('/ask');
check(ask.status === 200, 'GET /ask = 200');
const disabled = ask.text.includes('Q&amp;A 비활성') || ask.text.includes('Q&A 비활성');

const qa = await status('/api/qa', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'x' }) });
check(qa.status !== 200, 'anonymous POST /api/qa is never 200');
const configured = qa.status === 401;
check(configured || qa.status === 503, `anonymous POST /api/qa = 401 (configured) or 503 (unconfigured); got ${qa.status}`);

const forged = await status('/api/auth/sign-up/email', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
check(forged.status === 404, `forged /api/auth/sign-up/email = 404; got ${forged.status}`);

const save = await status('/api/qa/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
check([401, 503].includes(save.status), `anonymous POST /api/qa/save = 401 or 503; got ${save.status}`);

check(configured !== disabled, `/ask page agrees with the API (${configured ? 'sign-in shell' : 'Q&A 비활성'})`);
console.log(`\nQ&A configuration: ${configured ? 'VALID (owner gate reached)' : 'NOT CONFIGURED (503)'}`);
if (requireEnv) check(configured, 'Q&A configuration valid (--require-env)');

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
}

main().catch((err: unknown) => {
  console.error(`probe error: ${err instanceof Error ? err.message : 'unknown'}`);
  process.exit(1);
});
