import type { GithubApi } from '@/lib/github/pr';

export const MAIN_SHA = 'a'.repeat(40);
export const TREE_SHA = 'b'.repeat(40);

export const INDEX = '# Index\n\n## Sources\n\n- [[src-a]]: a\n\n## Syntheses (분석/질의 결과)\n\n- [[alpha]]: 알파\n- [[gamma]]: 감마\n';
export const LOG = '# Log\n\n## [2026-11-01] ingest | x\n- 생성: alpha\n';

export interface FakeOptions {
  files?: Record<string, string>;
  openPrHeads?: string[];
  failRef?: number;
  failPr?: boolean;
}

export interface Fake {
  api: GithubApi;
  calls: string[];
  refs: string[];
  blobs: Map<string, string>;
  commits: Record<string, unknown>[];
  trees: Record<string, unknown>[];
  prs: Record<string, unknown>[];
}

const FORBIDDEN = new Set(['updateRef', 'deleteRef', 'merge', 'createOrUpdateFileContents', 'deleteFile', 'update']);

function guard<T extends object>(path: string, target: T): T {
  return new Proxy(target, {
    get(t, prop, recv) {
      if (typeof prop === 'string' && FORBIDDEN.has(prop)) throw new Error(`forbidden call: ${path}.${prop}`);
      return Reflect.get(t, prop, recv);
    },
  });
}

/** In-memory GitHub; any ref write other than createRef (and any merge) throws. */
export function fakeGithub(o: FakeOptions = {}): Fake {
  const files: Record<string, string> = o.files ?? {
    'wiki/index.md': INDEX,
    'wiki/log.md': LOG,
    'wiki/concepts/alpha.md': 'x',
    'wiki/syntheses/gamma.md': 'x',
  };
  const calls: string[] = [];
  const blobs = new Map<string, string>();
  const shaOf = new Map<string, string>();
  for (const [p, c] of Object.entries(files)) {
    const sha = `f${shaOf.size}`.padEnd(40, '0');
    shaOf.set(p, sha);
    blobs.set(sha, c);
  }
  const f: Fake = { api: undefined as never, calls, refs: [], blobs, commits: [], trees: [], prs: [] };
  const git = {
    getRef: async (p: { ref: string }) => (calls.push('getRef'), p.ref === 'heads/main' ? { data: { object: { sha: MAIN_SHA } } } : Promise.reject(new Error('bad ref'))),
    getCommit: async (p: { commit_sha: string }) => (calls.push('getCommit'), p.commit_sha === MAIN_SHA ? { data: { tree: { sha: TREE_SHA } } } : Promise.reject(new Error('bad commit'))),
    getTree: async (p: { tree_sha: string }) => {
      calls.push('getTree');
      if (p.tree_sha !== TREE_SHA) throw new Error('bad tree');
      return { data: { tree: [...shaOf].map(([path, sha]) => ({ path, sha, type: 'blob' })) } };
    },
    getBlob: async (p: { file_sha: string }) => {
      calls.push('getBlob');
      return { data: { encoding: 'base64', content: Buffer.from(blobs.get(p.file_sha) ?? '').toString('base64') } };
    },
    createBlob: async (p: { content: string }) => {
      calls.push('createBlob');
      const sha = `n${blobs.size}`.padEnd(40, '1');
      blobs.set(sha, p.content);
      return { data: { sha } };
    },
    createTree: async (p: Record<string, unknown>) => (calls.push('createTree'), f.trees.push(p), { data: { sha: 'c'.repeat(40) } }),
    createCommit: async (p: Record<string, unknown>) => (calls.push('createCommit'), f.commits.push(p), { data: { sha: 'd'.repeat(40) } }),
    createRef: async (p: { ref: string }) => {
      calls.push('createRef');
      f.refs.push(p.ref);
      if (o.failRef) throw Object.assign(new Error('x'), { status: o.failRef });
      return {};
    },
  };
  const pulls = {
    list: async () => (calls.push('pulls.list'), { data: (o.openPrHeads ?? []).map((ref) => ({ head: { ref } })) }),
    create: async (p: Record<string, unknown>) => {
      calls.push('pulls.create');
      f.prs.push(p);
      if (o.failPr) throw new Error('boom');
      return { data: { html_url: 'https://github.test/o/r/pull/7', number: 7 } };
    },
  };
  const repos = { merge: async () => 'x' };
  f.api = guard('root', { git: guard('git', git), pulls: guard('pulls', pulls), repos: guard('repos', repos) }) as unknown as GithubApi;
  return f;
}
