'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BTN_OUTLINED, CHIP } from '@/lib/ui';

const QUESTION_MAX = 1000;
// Saving answers to the wiki as a PR is out of policy for now: the save UI is hidden. Set to true to bring it back.
const SAVE_ENABLED = false;

interface QaCite {
  slug: string;
  title: string;
  quote: string;
}
interface SignedAnswer {
  question: string;
  answer: unknown;
  iat: number;
  sig: string;
}
interface QaAnswer extends SignedAnswer {
  answerable: boolean;
  title_ko: string;
  summary: string;
  sentences: { text: string; cites: QaCite[] }[];
  notCovered: string[];
}

function errorMessage(status: number, server: unknown): string {
  const message = typeof (server as { message?: unknown } | null)?.message === 'string' ? (server as { message: string }).message : null;
  if (status === 401) return '로그인이 필요합니다';
  if (status === 403) return '소유자만 사용할 수 있습니다';
  if (status === 429 || status === 502 || status === 503) return message ?? 'Q&A를 사용할 수 없습니다. 잠시 후 다시 시도하세요.';
  return message ?? '요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요.';
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SAVE_UNAVAILABLE_NOTE = '저장 기능이 설정되지 않았습니다';

/** Default slug `qa-YYYYMMDD-HHmm` in KST. */
function defaultSlug(): string {
  const iso = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();
  return `qa-${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}-${iso.slice(11, 13)}${iso.slice(14, 16)}`;
}

/** Question as one line, truncated to 80 code points plus an ellipsis. */
function defaultSummary(question: string): string {
  const cps = [
    ...question
      .replace(/\s+/g, ' ')
      .replace(/\[\[|\]\]/g, '')
      .trim(),
  ];
  return cps.length > 80 ? `${cps.slice(0, 80).join('')}…` : cps.join('');
}

function saveErrorMessage(status: number, code: unknown): string {
  if (status === 503) return SAVE_UNAVAILABLE_NOTE;
  if (status === 401) return '로그인이 필요합니다';
  if (status === 403)
    return code === 'BAD_SIGNATURE' ? '답변 서명이 유효하지 않거나 만료되었습니다. 다시 질문해 주세요.' : '소유자만 사용할 수 있습니다';
  if (status === 409) {
    if (code === 'SLUG_EXISTS') return '이미 있는 슬러그입니다. 다른 슬러그를 입력하세요.';
    if (code === 'QA_PR_OPEN') return '이미 열린 qa/ PR이 있습니다. 병합하거나 닫은 뒤 다시 시도하세요.';
    if (code === 'BRANCH_EXISTS') return '같은 이름의 브랜치가 이미 있습니다. 슬러그를 바꿔 다시 시도하세요.';
    return '저장할 수 없는 상태입니다. 다시 시도하세요.';
  }
  if (status === 422) {
    if (code === 'BAD_SLUG') return '슬러그는 소문자, 숫자, 하이픈만 사용할 수 있습니다.';
    if (code === 'BAD_SUMMARY') return '요약은 한 줄, 120자 이하이며 [[ ]]를 포함할 수 없습니다.';
    if (code === 'NO_SOURCES') return '인용한 페이지에 출처가 없어 저장할 수 없습니다.';
    return '답변을 저장할 수 없습니다. 다시 질문해 주세요.';
  }
  return '저장하지 못했습니다. 잠시 후 다시 시도하세요.';
}

// Stage thresholds (seconds elapsed). The server sends no progress events, so these stages are a time-based estimate,
// not a report of what the server is doing. The panel only tells the person the request is alive.
const WIKI_STAGES = [
  { at: 0, label: '질문 분석' },
  { at: 2, label: '위키 문서 검색' },
  { at: 6, label: '근거 대조' },
  { at: 12, label: '답변 작성' },
];
const WEB_STAGES = [
  { at: 0, label: '웹 검색 요청' },
  { at: 5, label: '검색 결과 수집' },
  { at: 20, label: '답변 작성' },
];

/** Waiting state while a request is in flight: elapsed time, staged estimate, and pulsing placeholders. */
function PendingPanel({ mode }: { mode: 'wiki' | 'web' }) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.floor((now - start) / 1000);
  const stages = mode === 'web' ? WEB_STAGES : WIKI_STAGES;
  const current = stages.reduce((idx, s, i) => (elapsed >= s.at ? i : idx), 0);
  return (
    <div role="status" aria-live="polite" data-testid="qa-progress" className="mt-6 rounded border border-fg/25 p-4">
      <div className="mb-3 flex items-center gap-3 text-sm font-medium">
        <span className="flex items-center gap-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </span>
        {mode === 'web' ? '웹에서 검색하는 중' : '위키에서 답을 찾는 중'}
        <span className="ml-auto text-xs font-normal text-fg-2 tabular-nums">{elapsed}초</span>
      </div>
      <ol className="space-y-1.5 text-sm">
        {stages.map((s, i) => (
          <li key={s.label} className={i > current ? 'text-fg-2 opacity-50' : i === current ? 'text-fg' : 'text-fg-2'}>
            <span className="mr-2 inline-flex w-4 justify-center">
              {i < current ? '✓' : i === current ? <span className="size-1.5 animate-pulse rounded-full bg-primary" /> : '·'}
            </span>
            {s.label}
          </li>
        ))}
      </ol>
      <div className="mt-4 space-y-2" aria-hidden="true">
        <div className="h-3 w-4/5 animate-pulse rounded bg-fg/10" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-fg/10" />
      </div>
      {mode === 'web' && (
        <p className="mt-3 text-xs text-fg-2">웹 검색은 최대 2분 정도 걸릴 수 있습니다. 완료되면 이 자리에 답변이 표시됩니다.</p>
      )}
    </div>
  );
}

/** Owner-only Q&A shell. Sign-in plus the question form; the server enforces owner, cap and citation checks. */
export default function AskClient({ devLocal = false }: { devLocal?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<QaAnswer | null>(null);
  const [web, setWeb] = useState<{
    text: string;
    sources: { title: string; url: string }[];
  } | null>(null);
  const [webBusy, setWebBusy] = useState(false);
  // Where the question goes: the wiki (default) or a direct web search. The fallback button after a wiki miss stays as is.
  const [mode, setMode] = useState<'wiki' | 'web'>('wiki');
  // Either request in flight locks the input and the mode toggle until it settles.
  const pendingMode: 'wiki' | 'web' | null = webBusy ? 'web' : asking ? 'wiki' : null;
  const pending = pendingMode !== null;
  const [webError, setWebError] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveUnavailable, setSaveUnavailable] = useState(false);
  const [pr, setPr] = useState<{ url: string; number: number } | null>(null);

  // Nothing is persisted: a reload starts with an empty form and no previous answer.
  function showAnswer(a: QaAnswer) {
    setAnswer(a);
    setSlug(defaultSlug());
    setSummary(defaultSummary(a.question));
    setPr(null);
    setSaveError(null);
  }

  async function save() {
    if (!answer || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/qa/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: answer.question,
          answer: answer.answer,
          iat: answer.iat,
          sig: answer.sig,
          slug,
          summary,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        url?: unknown;
        number?: unknown;
        error?: unknown;
      } | null;
      if (res.ok && typeof data?.url === 'string' && typeof data.number === 'number') {
        setPr({ url: data.url, number: data.number });
      } else {
        if (res.status === 503 && data?.error === 'SAVE_UNAVAILABLE') setSaveUnavailable(true);
        setSaveError(saveErrorMessage(res.status, data?.error));
      }
    } catch {
      setSaveError('서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요.');
    } finally {
      setSaving(false);
    }
  }

  async function askWeb() {
    if (webBusy || question.trim() === '') return;
    setWebBusy(true);
    setWebError(null);
    setWeb(null);
    try {
      const res = await fetch('/api/qa/web', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = (await res.json().catch(() => null)) as {
        text?: string;
        sources?: { title: string; url: string }[];
        message?: string;
      } | null;
      if (res.ok && data && typeof data.text === 'string') setWeb({ text: data.text, sources: data.sources ?? [] });
      else setWebError(data?.message ?? '웹 검색 답변을 가져오지 못했습니다.');
    } catch {
      setWebError('서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요.');
    } finally {
      setWebBusy(false);
    }
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'web') {
      setError(null);
      setAnswer(null);
      setPr(null);
      await askWeb();
      return;
    }
    if (asking || question.trim() === '') return;
    setAsking(true);
    setError(null);
    setAnswer(null);
    setPr(null);
    setWeb(null);
    setWebError(null);
    try {
      const res = await fetch('/api/qa', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) setError(errorMessage(res.status, data));
      else showAnswer(data as QaAnswer);
    } catch {
      setError('서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요.');
    } finally {
      setAsking(false);
    }
  }

  async function signIn() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch('/api/auth/sign-in/social', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'github', callbackURL: '/ask' }),
      });
      const data = (await res.json()) as { url?: string };
      if (!res.ok || typeof data.url !== 'string') throw new Error('sign-in failed');
      window.location.assign(data.url);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  // Fills the viewport below the 49px header and the main padding (py-6 × 2 = 48px): the form stays fixed at the top,
  // the answer area below takes the remaining height and scrolls inside itself.
  return (
    <div className="grid h-[calc(100dvh-97px)] min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      <div className="min-h-0">
        <h1 className="mb-1 font-medium text-[1.75rem] leading-[1.235] break-words sm:text-[2.125rem]">Q&amp;A</h1>
        {devLocal ? (
          <p data-testid="dev-local-note" className="mb-6 text-sm text-fg-2">
            로컬 개발 모드입니다. 로그인 없이 질문할 수 있고, 일일 한도는 서버 메모리에서만 셉니다.
          </p>
        ) : (
          <>
            <p className="mb-6 text-sm text-fg-2">
              위키 소유자 전용 기능입니다. 소유자의 GitHub 계정으로 로그인한 경우에만 질문할 수 있습니다.
            </p>
            <button type="button" onClick={signIn} disabled={busy} className={`${BTN_OUTLINED} py-1.5 disabled:opacity-60`}>
              GitHub로 로그인
            </button>
            {failed && (
              <p role="alert" className="mt-3 text-sm text-error">
                로그인을 시작하지 못했습니다. 잠시 후 다시 시도하세요.
              </p>
            )}
          </>
        )}

        <form onSubmit={ask} className="mt-8">
          <label htmlFor="qa-question" className="mb-1 block text-sm font-medium">
            질문
          </label>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] rounded border border-fg/25 bg-surface focus-within:border-primary">
            <div className="flex min-w-0 flex-col">
              <div role="group" aria-label="질문 대상" className="flex items-center gap-1 px-2 pt-2">
                {(
                  [
                    ['wiki', '위키에 질문', '위키 문서에서 근거를 찾아 답합니다.'],
                    ['web', '웹 검색', '위키 근거가 아닌 웹 검색 결과입니다. 질문 1회로 계산됩니다.'],
                  ] as const
                ).map(([value, label, hint]) => (
                  <button
                    key={value}
                    type="button"
                    title={hint}
                    aria-pressed={mode === value}
                    disabled={pending}
                    onClick={() => setMode(value)}
                    className="rounded px-2.5 py-0.5 text-xs text-fg-2 hover:bg-hover aria-pressed:bg-primary/[0.08] aria-pressed:font-medium aria-pressed:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <textarea
                id="qa-question"
                value={question}
                disabled={pending}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={
                  mode === 'web'
                    ? '위키 근거가 아닌 웹 검색 결과입니다. 질문 1회로 계산됩니다. Enter로 검색, Shift+Enter로 줄바꿈'
                    : '질문을 입력하세요. Enter로 질문하기, Shift+Enter로 줄바꿈'
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                maxLength={QUESTION_MAX}
                rows={4}
                className="w-full flex-1 resize-none bg-transparent px-2 py-1 text-sm text-fg outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
              <span className="px-2 pb-1 text-xs text-fg-2">
                {question.length}/{QUESTION_MAX}
              </span>
            </div>
            <button
              type="submit"
              disabled={pending || question.trim() === ''}
              className="self-stretch rounded-r border-l border-fg/25 px-5 text-sm font-medium text-primary hover:bg-primary/[0.04] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary disabled:opacity-60"
            >
              {pendingMode === 'web' ? '검색 중…' : pendingMode === 'wiki' ? '질문 중…' : '질문하기'}
            </button>
          </div>
        </form>
      </div>
      <div className="min-h-0 overflow-y-auto pb-6 pr-1">
        {pendingMode && <PendingPanel key={pendingMode} mode={pendingMode} />}
        {error && (
          <p role="alert" className="mt-3 text-sm text-error">
            {error}
          </p>
        )}
        {(error || (answer && !answer.answerable)) && !pending && (
          <div className="mt-3">
            <button
              type="button"
              onClick={askWeb}
              disabled={webBusy}
              data-testid="web-search"
              className={`${BTN_OUTLINED} py-1.5 disabled:opacity-60`}
            >
              {webBusy ? '웹 검색 중…' : '웹 검색으로 답변 받기'}
            </button>
            <span className="ml-2 text-xs text-fg-2">위키 근거가 아닌 웹 검색 결과입니다. 질문 1회로 계산됩니다.</span>
          </div>
        )}
        {webError && (
          <p role="alert" className="mt-3 text-sm text-error">
            {webError}
          </p>
        )}
        {web && (
          <section aria-label="웹 검색 답변" data-testid="web-answer" className="mt-4 rounded border border-fg/25 p-3">
            <p className="mb-2 text-xs text-fg-2">웹 검색 답변 (위키 근거 없음, 검증되지 않음)</p>
            <p className="whitespace-pre-wrap break-words">{web.text}</p>
            {web.sources.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {web.sources.map((u) => (
                  <li key={u.url}>
                    <a href={u.url} target="_blank" rel="noopener noreferrer" className="underline break-all">
                      {u.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {answer && (
          <section aria-label="답변" className="mt-6">
            {answer.title_ko && <h2 className="mb-1 text-lg font-medium break-words">{answer.title_ko}</h2>}
            {answer.summary && <p className="mb-3 text-sm text-fg-2">{answer.summary}</p>}
            {answer.sentences.map((s, i) => (
              <div key={i} className="mb-4">
                <p className="break-words">{s.text}</p>
                {s.cites.length > 0 && (
                  <ul className="mt-1 space-y-1">
                    {s.cites.map((c, j) => (
                      <li key={j} className="text-sm">
                        <Link href={`/wiki/${c.slug}`} className={`${CHIP} text-xs`}>
                          {c.title}
                        </Link>
                        <q className="ml-2 break-words text-fg-2">{c.quote}</q>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {answer.notCovered.map((line, i) => (
              <p key={i} className="mb-1 text-sm text-fg-2">
                {line}
              </p>
            ))}
            {SAVE_ENABLED && (
              <div className="mt-6 border-t border-divider pt-4" data-testid="qa-save">
                <h3 className="mb-2 text-sm font-medium">저장</h3>
                {saveUnavailable ? (
                  <p className="text-sm text-fg-2">{SAVE_UNAVAILABLE_NOTE}</p>
                ) : (
                  <>
                    <label htmlFor="qa-slug" className="mb-1 block text-sm">
                      슬러그
                    </label>
                    <input
                      id="qa-slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      maxLength={80}
                      className="mb-3 w-full rounded border border-fg/25 bg-surface p-2 text-sm text-fg"
                    />
                    <label htmlFor="qa-summary" className="mb-1 block text-sm">
                      요약 (index에 표시, 한 줄 120자 이하)
                    </label>
                    <input
                      id="qa-summary"
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      className="mb-3 w-full rounded border border-fg/25 bg-surface p-2 text-sm text-fg"
                    />
                    <button
                      type="button"
                      onClick={save}
                      disabled={saving || pr !== null || !SLUG_RE.test(slug)}
                      className={`${BTN_OUTLINED} py-1.5 disabled:opacity-60`}
                    >
                      {saving ? '저장 중…' : '위키에 저장 (PR 생성)'}
                    </button>
                  </>
                )}
                {saveError && !saveUnavailable && (
                  <p role="alert" className="mt-3 text-sm text-error">
                    {saveError}
                  </p>
                )}
                {pr && (
                  <p className="mt-3 text-sm">
                    PR #{pr.number}:{' '}
                    <a href={pr.url} target="_blank" rel="noreferrer noopener" className="text-primary underline">
                      {pr.url}
                    </a>
                  </p>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
