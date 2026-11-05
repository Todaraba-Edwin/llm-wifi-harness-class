// Runs the Scanner v2 content rules against pages and assets fetched over HTTP.
// Usage: pnpm verify:live <base-url>
import fs from 'node:fs';
import path from 'node:path';
import { formatFinding, scanContent, type Finding } from './verify-build';
import { buildSentinels } from './lib/shingles';

const STATIC_PAGES = ['/', '/log', '/search', '/graph', '/path', '/skills', '/search-index.json', '/graph.json'];

async function get(url: string): Promise<{ status: number; buf: Buffer }> {
  const res = await fetch(url, { redirect: 'follow' });
  return { status: res.status, buf: Buffer.from(await res.arrayBuffer()) };
}

async function main(): Promise<number> {
  const base = process.argv[2];
  if (!base) {
    console.error('usage: verify-live <base-url>');
    return 2;
  }
  const root = process.cwd();
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/generated/manifest.json'), 'utf8')) as { slugs: string[] };
  const sentinels = buildSentinels(root);
  const paths = [...STATIC_PAGES, ...manifest.slugs.map((s) => `/wiki/${s}`)];
  const assets = new Set<string>();
  const findings: Finding[] = [];
  const failures: string[] = [];
  let scanned = 0;

  const scan = async (p: string, isPage: boolean) => {
    const { status, buf } = await get(new URL(p, base).href);
    if (status !== 200) {
      failures.push(`status ${status} for ${p}`);
      return;
    }
    scanned++;
    const file = isPage && !/\.\w+$/.test(p) ? `${p}.html` : p;
    findings.push(...scanContent(file, p, buf, sentinels, { env: process.env }));
    if (isPage && file.endsWith('.html')) {
      for (const m of buf.toString('utf8').matchAll(/\/_next\/static\/[^"'\s)\\]+/g)) assets.add(m[0]);
    }
  };

  for (const p of paths) await scan(p, true);
  for (const a of assets) await scan(decodeURI(a), false);

  for (const f of failures) console.error(`FAIL fetch ${f}`);
  for (const f of findings) console.error(formatFinding(f));
  console.log(`verify-live: ${scanned} resources, ${sentinels.map.size} sentinels, ${findings.length} finding(s), ${failures.length} fetch failure(s)`);
  return findings.length || failures.length ? 1 : 0;
}

main().then((c) => process.exit(c));
