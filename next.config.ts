import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

// Pinned so Next cannot infer a parent-directory root from another lockfile.
export const projectRoot = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '');

// `next dev` answers 403 for /_next/* when the request Origin is not localhost, so a page opened through a LAN
// address never hydrates (search stays on "loading index", theme toggle and drawer are dead). These hosts are
// allowed in dev only; the option has no effect on `next build` / `next start`.
export const DEFAULT_DEV_ORIGINS = ['192.168.*.*', '10.*.*.*'];

/** Accepts bare hosts, wildcard hosts (`192.168.*.*`) and URLs; keeps only the hostname. Throws on anything else. */
export function normalizeDevOrigins(list: string): string[] {
  const out: string[] = [];
  for (const raw of list.split(',')) {
    const entry = raw.trim();
    if (entry === '') continue;
    const host = entry.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/[/?#].*$/, '').replace(/:\d+$/, '');
    if (!/^[A-Za-z0-9*]([A-Za-z0-9.*-]*[A-Za-z0-9*])?$/.test(host)) {
      throw new Error(`DEV_ALLOWED_ORIGINS: cannot parse entry "${entry}"`);
    }
    out.push(host);
  }
  return out;
}

export function devOrigins(env: Record<string, string | undefined> = process.env): string[] {
  const custom = env.DEV_ALLOWED_ORIGINS;
  return custom && custom.trim() !== '' ? normalizeDevOrigins(custom) : DEFAULT_DEV_ORIGINS;
}

const config: NextConfig = {
  outputFileTracingRoot: projectRoot,
  outputFileTracingExcludes: {
    '*': ['raw/**', 'docs/**', 'artifacts/**', '.gjc/**', '.gjc-env/**', 'AGENTS.md'],
  },
  allowedDevOrigins: devOrigins(),
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default config;
