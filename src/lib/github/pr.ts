import type { ValidatedAnswer } from '@/lib/qa/validate';
import { appendLog, insertIndexEntry, oneLine, SaveError, truncate } from './index-log';
import { citedSlugs, renderSynthesis } from './render-synthesis';

/**
 * The only GitHub surface the save flow may touch. There is deliberately no updateRef, deleteRef, merge or
 * content-write method here: a ref is only ever created, under `refs/heads/qa/`.
 */
export interface GithubApi {
  git: {
    getRef(p: { owner: string; repo: string; ref: string }): Promise<{ data: { object: { sha: string } } }>;
    getCommit(p: { owner: string; repo: string; commit_sha: string }): Promise<{ data: { tree: { sha: string } } }>;
    getTree(p: { owner: string; repo: string; tree_sha: string; recursive: 'true' }): Promise<{
      data: { truncated?: boolean; tree: { path?: string; type?: string; sha?: string }[] };
    }>;
    getBlob(p: { owner: string; repo: string; file_sha: string }): Promise<{ data: { content: string; encoding: string } }>;
    createBlob(p: { owner: string; repo: string; content: string; encoding: 'utf-8' }): Promise<{ data: { sha: string } }>;
    createTree(p: {
      owner: string;
      repo: string;
      base_tree: string;
      tree: { path: string; mode: '100644'; type: 'blob'; sha: string }[];
    }): Promise<{ data: { sha: string } }>;
    createCommit(p: { owner: string; repo: string; message: string; tree: string; parents: string[] }): Promise<{ data: { sha: string } }>;
    createRef(p: { owner: string; repo: string; ref: string; sha: string }): Promise<unknown>;
  };
  pulls: {
    list(p: { owner: string; repo: string; state: 'open'; per_page: number }): Promise<{ data: { head: { ref: string } }[] }>;
    create(p: { owner: string; repo: string; base: 'main'; head: string; title: string; body: string }): Promise<{
      data: { html_url: string; number: number };
    }>;
  };
}

export interface SavePrInput {
  /** `owner/name`. */
  repo: string;
  question: string;
  answer: ValidatedAnswer;
  slug: string;
  summary: string;
  now: number;
  sourcesOf(slug: string): readonly string[] | undefined;
}

export interface KstParts {
  /** YYYY-MM-DD */
  date: string;
  /** yyyymmddhhmm */
  stamp: string;
  /** YYYYMMDD-HHmm */
  slugStamp: string;
}

export function kstParts(now: number): KstParts {
  const iso = new Date(now + 9 * 60 * 60 * 1000).toISOString();
  const [y, mo, d, h, mi] = [iso.slice(0, 4), iso.slice(5, 7), iso.slice(8, 10), iso.slice(11, 13), iso.slice(14, 16)];
  return { date: `${y}-${mo}-${d}`, stamp: `${y}${mo}${d}${h}${mi}`, slugStamp: `${y}${mo}${d}-${h}${mi}` };
}

const RESERVED = new Set(['index', 'log']);
const MAIN_PATH_INDEX = 'wiki/index.md';
const MAIN_PATH_LOG = 'wiki/log.md';

function statusOf(e: unknown): number | undefined {
  const s = (e as { status?: unknown } | null)?.status;
  return typeof s === 'number' ? s : undefined;
}

/**
 * Creates `qa/<slug>-<stamp>` with one commit on top of main's head and opens a PR against main.
 * Throws SaveError with a fixed code; no input text or token reaches an error.
 */
export async function createSavePr(api: GithubApi, input: SavePrInput): Promise<{ url: string; number: number }> {
  const [owner, repo] = input.repo.split('/');
  const { slug, answer } = input;
  const time = kstParts(input.now);
  const question = oneLine(input.question);

  // Pure rendering first: a bad title pair, an empty question or missing sources never touches GitHub.
  const synthesis = renderSynthesis({ question: input.question, answer, today: time.date, sourcesOf: input.sourcesOf });

  let mainSha: string;
  let treeSha: string;
  let files: Map<string, string>;
  let index: string;
  let log: string;
  try {
    mainSha = (await api.git.getRef({ owner, repo, ref: 'heads/main' })).data.object.sha;
    treeSha = (await api.git.getCommit({ owner, repo, commit_sha: mainSha })).data.tree.sha;
    const tree = (await api.git.getTree({ owner, repo, tree_sha: treeSha, recursive: 'true' })).data;
    if (tree.truncated) throw new SaveError(502, 'GITHUB_FAILED');
    files = new Map(tree.tree.filter((t) => t.type === 'blob' && t.path && t.sha).map((t) => [t.path as string, t.sha as string]));
    const read = async (path: string): Promise<string> => {
      const sha = files.get(path);
      if (!sha) throw new SaveError(502, 'GITHUB_FAILED');
      const blob = (await api.git.getBlob({ owner, repo, file_sha: sha })).data;
      if (blob.encoding !== 'base64') throw new SaveError(502, 'GITHUB_FAILED');
      return Buffer.from(blob.content, 'base64').toString('utf8');
    };
    index = await read(MAIN_PATH_INDEX);
    log = await read(MAIN_PATH_LOG);
  } catch (e) {
    throw e instanceof SaveError ? e : new SaveError(502, 'GITHUB_FAILED');
  }

  // Slug must be new at main's head: reserved names and every existing page slug (any wiki directory).
  const taken = new Set<string>(RESERVED);
  for (const path of files.keys()) {
    const m = /^wiki\/(?:.+\/)?([^/]+)\.md$/.exec(path);
    if (m) taken.add(m[1]);
  }
  if (taken.has(slug)) throw new SaveError(409, 'SLUG_EXISTS');

  let open: { head: { ref: string } }[];
  try {
    open = (await api.pulls.list({ owner, repo, state: 'open', per_page: 100 })).data;
  } catch {
    throw new SaveError(502, 'GITHUB_FAILED');
  }
  if (open.some((p) => p.head.ref.startsWith('qa/'))) throw new SaveError(409, 'QA_PR_OPEN');

  const newIndex = insertIndexEntry(index, slug, input.summary);
  const newLog = appendLog(log, time.date, input.question, slug);

  const branch = `qa/${slug}-${time.stamp}`;
  let commitSha: string;
  try {
    const blob = async (content: string) => (await api.git.createBlob({ owner, repo, content, encoding: 'utf-8' })).data.sha;
    const [synthSha, indexSha, logSha] = [await blob(synthesis), await blob(newIndex), await blob(newLog)];
    const newTree = await api.git.createTree({
      owner,
      repo,
      base_tree: treeSha,
      tree: [
        { path: `wiki/syntheses/${slug}.md`, mode: '100644', type: 'blob', sha: synthSha },
        { path: MAIN_PATH_INDEX, mode: '100644', type: 'blob', sha: indexSha },
        { path: MAIN_PATH_LOG, mode: '100644', type: 'blob', sha: logSha },
      ],
    });
    // No author or committer: the API attributes the commit to the token owner.
    commitSha = (await api.git.createCommit({ owner, repo, message: `query: ${slug}`, tree: newTree.data.sha, parents: [mainSha] })).data.sha;
  } catch {
    throw new SaveError(502, 'GITHUB_FAILED');
  }

  try {
    await api.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: commitSha });
  } catch (e) {
    throw new SaveError(statusOf(e) === 422 ? 409 : 502, statusOf(e) === 422 ? 'BRANCH_EXISTS' : 'GITHUB_FAILED');
  }

  try {
    const pr = (
      await api.pulls.create({
        owner,
        repo,
        base: 'main',
        head: branch,
        title: `query: ${truncate(question, 72)}`,
        body: `근거 페이지: ${citedSlugs(answer).join(', ')}`,
      })
    ).data;
    return { url: pr.html_url, number: pr.number };
  } catch {
    throw new SaveError(502, 'PR_FAILED');
  }
}
