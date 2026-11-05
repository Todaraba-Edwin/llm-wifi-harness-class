import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { errorsOf, formatIssue, loadWiki, type WikiLoad } from '../src/lib/content/corpus';
import { buildSearchIndex, type SearchDoc } from '../src/lib/search/search';
import { resolveDisplayTitles } from '../src/lib/content/display-titles';

export interface BuildResult {
  load: WikiLoad;
  ok: boolean;
}

export function buildContent(root: string, outDir = path.join(root, 'src/generated'), publicDir = path.join(root, 'public')): BuildResult {
  const load = loadWiki(root, { dashboards: true });
  for (const i of load.issues) console.log(formatIssue(i));
  const errors = errorsOf(load);
  const titleCheck = resolveDisplayTitles(load.pages);
  for (const e of titleCheck.errors) console.error(`ERROR [display-title] ${e}`);
  if (errors.length > 0 || titleCheck.errors.length > 0) {
    console.error(`build-content: ${errors.length + titleCheck.errors.length} error(s); outputs not written`);
    return { load, ok: false };
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });
  const write = (name: string, data: unknown, dir = outDir) => fs.writeFileSync(path.join(dir, name), JSON.stringify(data));

  write('pages.json', {
    pages: load.pages.map((p) => ({ ...p, fullBody: undefined })),
    index: { body: load.indexBody },
    log: { body: load.logBody },
  });
  write('graph.json', load.graph);
  write('display-titles.json', titleCheck.displayTitles);
  write('dashboards.json', load.dashboards);
  write('qa-corpus.json', {
    index: load.indexBody,
    pages: load.pages.map((p) => ({ slug: p.slug, title: p.title, type: p.type, tags: p.tags, sources: p.sources, updated: p.updated, body: p.fullBody })),
  });
  write('qa-plaintext.json', load.plaintext);

  const docs: SearchDoc[] = load.pages.map((p) => ({
    id: p.slug,
    title: p.title,
    type: p.type,
    tags: p.tags.join(' '),
    body: load.plaintext[p.slug],
    summary: load.plaintext[p.slug].replace(new RegExp(`^${p.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`), '').slice(0, 140),
  }));
  const index = buildSearchIndex(docs);
  const searchJson = JSON.stringify(index);
  fs.writeFileSync(path.join(outDir, 'search-index.json'), searchJson);
  fs.writeFileSync(path.join(publicDir, 'search-index.json'), searchJson);
  fs.writeFileSync(path.join(publicDir, 'graph.json'), JSON.stringify(load.graph));

  write('manifest.json', {
    pageCount: load.pages.length,
    slugs: load.pages.map((p) => p.slug),
    edgeCount: load.graph.edges.length,
    qaCorpusBytes: load.qaCorpusBytes,
    warnings: load.issues.filter((i) => i.level === 'warn').length,
  });
  console.log(`build-content: ${load.pages.length} pages, ${load.graph.edges.length} edges, qa corpus ${load.qaCorpusBytes}B, ${load.issues.length} issue(s)`);
  return { load, ok: true };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok } = buildContent(process.cwd());
  process.exit(ok ? 0 : 1);
}
