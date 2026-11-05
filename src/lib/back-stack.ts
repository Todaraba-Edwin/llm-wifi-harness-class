// Back trail for wikilink navigation: a click on an inline [[wikilink]] pushes {from, to}; the destination page shows a
// "돌아가기" link to `from` while the top of the stack targets the current path. Stored in sessionStorage (per tab).

export const BACK_KEY = 'wikilink-back-stack';
const CHANGE_EVENT = 'wikilink-back-change';
const MAX_DEPTH = 50;

export interface BackEntry {
  from: string;
  to: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function parseStack(raw: string | null): BackEntry[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (e): e is BackEntry => typeof e === 'object' && e !== null && typeof (e as BackEntry).from === 'string' && typeof (e as BackEntry).to === 'string',
    );
  } catch {
    return [];
  }
}

export function push(stack: BackEntry[], entry: BackEntry): BackEntry[] {
  if (entry.from === entry.to) return stack;
  return [...stack, entry].slice(-MAX_DEPTH);
}

/** The entry to offer on `pathname`, or null when the current page was not reached through a wikilink. */
export function backTarget(stack: BackEntry[], pathname: string): BackEntry | null {
  const top = stack[stack.length - 1];
  return top && top.to === pathname ? top : null;
}

export function pop(stack: BackEntry[]): BackEntry[] {
  return stack.slice(0, -1);
}

function storage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readRaw(): string {
  try {
    return storage()?.getItem(BACK_KEY) ?? '';
  } catch {
    return '';
  }
}

function write(stack: BackEntry[]): void {
  try {
    storage()?.setItem(BACK_KEY, JSON.stringify(stack));
  } catch {
    // Navigation keeps working without the back trail.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function recordWikilinkClick(entry: BackEntry): void {
  write(push(parseStack(readRaw()), entry));
}

export function popBack(): void {
  write(pop(parseStack(readRaw())));
}

export function subscribe(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

/** Label for the page we came from: wiki page title, or the name of a top-level page. */
export function labelFor(path: string, titles: Record<string, string>): string {
  const m = /^\/wiki\/([^/]+)$/.exec(path);
  if (m) return titles[decodeURIComponent(m[1])] ?? m[1];
  const fixed: Record<string, string> = { '/': '홈', '/log': '변경 기록', '/search': '검색', '/path': '학습 순서', '/skills': '직무 역량', '/ask': '질문' };
  return fixed[path] ?? path;
}
