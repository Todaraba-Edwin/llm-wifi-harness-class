// Runs a gate against a sanitized temporary copy of the repository.
//
// Why: `next build`, `next start` and `next dev` load `.env*` from the project root no matter what the
// shell environment looks like, so `env -i ... pnpm build` inside the repo is NOT a secretless build.
// This script copies the repository without any `.env*`, runs the gate there with an exact, minimal
// child environment, and removes the copy.
//
// Usage: pnpm gate:clean <build|e2e|selftest|mutate|devorigin|optout> [--dummy-secrets] [--keep] [-- <playwright args>]
// (`optout`: G14, proves a built artifact started with NODE_ENV=development and QA_DAILY_CAP=0 still answers 503.)
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Excluded by basename at every depth, including inside node_modules.
const ALWAYS_EXCLUDED = (name: string): boolean => name.startsWith('.env');

// Excluded by basename at every depth outside node_modules (package-shipped files stay intact there;
// verify-build's trace scan covers node_modules).
const OUTSIDE_NODE_MODULES_EXCLUDED = (name: string): boolean =>
  name === '.vercel' ||
  name === '.npmrc' ||
  name === '.git' ||
  name.startsWith('.gjc') ||
  name === '.next' ||
  name === 'coverage' ||
  name === 'out' ||
  name === 'test-results' ||
  name === 'playwright-report' ||
  name.endsWith('.pem');

const EXCLUDED_RELATIVE_PATHS = new Set(['src/generated']);

function insideNodeModules(rel: string): boolean {
  return rel.split(path.sep).includes('node_modules');
}

/** True when the entry at `rel` (relative to the repository root) must not be copied. */
export function isExcluded(rel: string): boolean {
  const posix = rel.split(path.sep).join('/');
  const name = path.basename(rel);
  if (ALWAYS_EXCLUDED(name)) return true;
  if (insideNodeModules(rel)) return false;
  return EXCLUDED_RELATIVE_PATHS.has(posix) || OUTSIDE_NODE_MODULES_EXCLUDED(name);
}

export function copyRepo(root: string, dest: string): void {
  fs.cpSync(root, dest, {
    recursive: true,
    verbatimSymlinks: true,
    mode: fs.constants.COPYFILE_FICLONE,
    filter: (src) => {
      const rel = path.relative(root, src);
      return rel === '' || !isExcluded(rel);
    },
  });
}

/** Walks the copy and returns every entry that should have been excluded (paths only, never contents). */
export function findForbidden(dest: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(dest, full);
      if (isExcluded(rel)) found.push(rel);
      if (entry.isDirectory() && !entry.isSymbolicLink()) walk(full);
    }
  };
  walk(dest);
  return found;
}

/** Fails when the copy's `next` resolves outside the copy (relative pnpm links turned absolute). */
export function nextResolvesInside(dest: string): boolean {
  const target = path.join(dest, 'node_modules', 'next');
  if (!fs.existsSync(target)) return false;
  const real = fs.realpathSync(target);
  const base = fs.realpathSync(dest);
  return real === base || real.startsWith(base + path.sep);
}

/** Variable names declared in .env.example (names only; the file never holds values). */
export function envExampleNames(root: string): string[] {
  const file = path.join(root, '.env.example');
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => /^([A-Z][A-Z0-9_]*)=/.exec(l)?.[1])
    .filter((n): n is string => Boolean(n));
}

export interface ChildEnvOptions {
  port: number;
  dummySecrets?: { names: string[] };
  extra?: Record<string, string>;
}

/** The complete environment of every child process. Nothing else from the parent leaks in. */
export function childEnv(opts: ChildEnvOptions): Record<string, string> {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? '',
    CI: '1',
    NEXT_TELEMETRY_DISABLED: '1',
    E2E_PORT: String(opts.port),
  };
  if (opts.dummySecrets) {
    for (const name of opts.dummySecrets.names) {
      // QA_DAILY_CAP is a number, not a secret; leaving it unset keeps the default behavior under test.
      if (name === 'QA_DAILY_CAP') continue;
      env[name] = `dummy-${name}-not-a-secret`;
    }
  }
  return { ...env, ...opts.extra };
}

export function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: 'localhost' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

export function pickFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
  });
}

export async function assertPortFree(port: number): Promise<void> {
  if (await portInUse(port)) throw new Error(`port ${port} is already in use; refusing to attach to an existing server`);
}

function run(cmd: string, args: string[], cwd: string, env: Record<string, string>): number {
  const r = spawnSync(cmd, args, { cwd, env: env as NodeJS.ProcessEnv, stdio: 'inherit' });
  return r.status ?? 1;
}

async function waitForHttp(url: string, child: ChildProcess, timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early with code ${child.exitCode}`);
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timeout waiting for ${url}`);
}

function startServer(args: string[], cwd: string, env: Record<string, string>): ChildProcess {
  return spawn('pnpm', args, { cwd, env: env as NodeJS.ProcessEnv, stdio: ['ignore', 'inherit', 'inherit'], detached: true });
}

function stopServer(child: ChildProcess): void {
  if (child.pid && child.exitCode === null) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
}

async function devOriginProbe(copy: string, env: Record<string, string>, port: number): Promise<number> {
  const allowedOrigin = 'http://192.168.0.5:3000';
  const deniedOrigin = 'http://203.0.113.9:3000';
  const server = startServer(['dev', '-p', String(port)], copy, env);
  try {
    const base = `http://localhost:${port}`;
    await waitForHttp(`${base}/`, server);
    const html = await (await fetch(`${base}/`)).text();
    const chunk = /\/_next\/static\/[^"'\s)\\]+\.js/.exec(html)?.[0];
    if (!chunk) {
      console.error('devorigin: no /_next chunk found in the home page');
      return 1;
    }
    const probe = async (origin: string): Promise<number> =>
      (await fetch(base + chunk, { headers: { Origin: origin, 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Site': 'cross-site' } })).status;
    const allowed = await probe(allowedOrigin);
    const denied = await probe(deniedOrigin);
    console.log(`devorigin: allowed origin -> ${allowed}, other origin -> ${denied}`);
    return allowed === 200 && denied === 403 ? 0 : 1;
  } finally {
    stopServer(server);
  }
}

/** POST /api/qa against the built artifact; returns the HTTP status. No Origin header, JSON body, no session. */
async function postQa(port: number): Promise<number> {
  const res = await fetch(`http://localhost:${port}/api/qa`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question: 'ping' }),
  });
  return res.status;
}

async function optoutProbe(copy: string, port: number, names: string[]): Promise<number> {
  const dummy = childEnv({ port, dummySecrets: { names }, extra: { BETTER_AUTH_URL: `http://localhost:${port}`, OWNER_GITHUB_ID: '123456' } });
  const run1 = async (extra: Record<string, string>): Promise<number> => {
    await assertPortFree(port);
    const server = startServer(['start', '-p', String(port)], copy, { ...dummy, ...extra });
    try {
      await waitForHttp(`http://localhost:${port}/`, server);
      return await postQa(port);
    } finally {
      stopServer(server);
      await new Promise((r) => setTimeout(r, 1000));
    }
  };
  // Positive control: configuration is complete, so an anonymous request reaches requireOwner and gets 401.
  const control = await run1({});
  // Artifact started as development with the unlimited cap: the literal baked into the build is production, so the env is invalid.
  const optout = await run1({ NODE_ENV: 'development', QA_DAILY_CAP: '0' });
  console.log(`optout: control (cap unset) -> ${control}, NODE_ENV=development QA_DAILY_CAP=0 -> ${optout}`);
  return control === 401 && optout === 503 ? 0 : 1;
}

async function verifyLive(copy: string, env: Record<string, string>, port: number): Promise<number> {
  const server = startServer(['start', '-p', String(port)], copy, env);
  try {
    await waitForHttp(`http://localhost:${port}/`, server);
    return run('pnpm', ['verify:live', `http://localhost:${port}`], copy, env);
  } finally {
    stopServer(server);
  }
}

export async function main(argv: string[]): Promise<number> {
  const root = process.cwd();
  const dd = argv.indexOf('--');
  const own = dd === -1 ? argv : argv.slice(0, dd);
  const passthrough = dd === -1 ? [] : argv.slice(dd + 1);
  const mode = own[0];
  const dummy = own.includes('--dummy-secrets');
  const keep = own.includes('--keep');
  if (!['build', 'e2e', 'selftest', 'mutate', 'devorigin', 'optout'].includes(mode ?? '')) {
    console.error('usage: gate:clean <build|e2e|selftest|mutate|devorigin|optout> [--dummy-secrets] [--keep] [-- <playwright args>]');
    return 2;
  }

  const port = await pickFreePort();
  await assertPortFree(port);

  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'clean-gate-'));
  try {
    copyRepo(root, copy);
    const leftover = findForbidden(copy);
    if (leftover.length) {
      console.error(`clean-gate: excluded entries present in the copy: ${leftover.join(', ')}`);
      return 1;
    }
    if (!nextResolvesInside(copy)) {
      console.error('clean-gate: node_modules/next resolves outside the copy; rebuilding dependencies offline');
      if (run('pnpm', ['install', '--offline', '--frozen-lockfile'], copy, childEnv({ port })) !== 0 || !nextResolvesInside(copy)) {
        console.error('clean-gate: node_modules/next still resolves outside the copy');
        return 1;
      }
    }

    const env = childEnv({ port, dummySecrets: dummy ? { names: envExampleNames(root) } : undefined });
    console.log(`clean-gate: ${mode} in ${copy} (port ${port}${dummy ? ', dummy secrets' : ''})`);

    switch (mode) {
      case 'selftest':
        return run('pnpm', ['verify:selftest'], copy, env);
      case 'build':
        return run('pnpm', ['build'], copy, env);
      case 'mutate':
        return run('pnpm', ['build'], copy, env) || run('pnpm', ['verify:build', '--mutate'], copy, env);
      case 'optout':
        return run('pnpm', ['build'], copy, env) || (await optoutProbe(copy, port, envExampleNames(root)));
      case 'devorigin':
        return await devOriginProbe(copy, env, port);
      case 'e2e': {
        const built = run('pnpm', ['build'], copy, env);
        if (built !== 0) return built;
        await assertPortFree(port);
        const pw = run('pnpm', ['exec', 'playwright', 'test', ...passthrough], copy, env);
        if (pw !== 0) return pw;
        await assertPortFree(port);
        return await verifyLive(copy, env, port);
      }
      default:
        return 2;
    }
  } finally {
    if (keep) console.log(`clean-gate: copy kept at ${copy}`);
    else fs.rmSync(copy, { recursive: true, force: true });
  }
}

const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(`clean-gate: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    },
  );
}
