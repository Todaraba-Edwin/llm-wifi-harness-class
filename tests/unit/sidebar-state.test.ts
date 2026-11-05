import { afterEach, describe, expect, it, vi } from 'vitest';
import vm from 'node:vm';
import {
  applyToDocument,
  getServerSnapshot,
  readCollapsed,
  SIDEBAR_INIT_SCRIPT,
  SIDEBAR_KEY,
  subscribe,
  writeCollapsed,
  type StorageLike,
} from '@/lib/sidebar-state';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}
const throwing: StorageLike = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('sidebar state', () => {
  it('defaults to expanded; only "1" means collapsed; unknown values are expanded', () => {
    expect(readCollapsed(memoryStorage())).toBe(false);
    expect(readCollapsed(memoryStorage({ [SIDEBAR_KEY]: '1' }))).toBe(true);
    expect(readCollapsed(memoryStorage({ [SIDEBAR_KEY]: '0' }))).toBe(false);
    expect(readCollapsed(memoryStorage({ [SIDEBAR_KEY]: 'yes' }))).toBe(false);
    expect(readCollapsed(null)).toBe(false);
    expect(getServerSnapshot()).toBe(false);
  });
  it('never throws when storage is unavailable', () => {
    expect(readCollapsed(throwing)).toBe(false);
    expect(() => writeCollapsed(throwing, true)).not.toThrow();
  });
  it('round-trips writes', () => {
    const s = memoryStorage();
    writeCollapsed(s, true);
    expect(readCollapsed(s)).toBe(true);
    writeCollapsed(s, false);
    expect(readCollapsed(s)).toBe(false);
  });
  it('mirrors the state onto <html data-sidebar>', () => {
    const root = { dataset: {} as DOMStringMap };
    applyToDocument(true, root);
    expect(root.dataset.sidebar).toBe('collapsed');
    applyToDocument(false, root);
    expect(root.dataset.sidebar).toBeUndefined();
  });
});

describe('subscribe', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('calls back for the custom same-tab event and storage events for the key, and stops after unsubscribe', () => {
    const listeners = new Map<string, Set<(e: unknown) => void>>();
    vi.stubGlobal('window', {
      addEventListener: (t: string, f: (e: unknown) => void) => (listeners.get(t) ?? listeners.set(t, new Set()).get(t)!).add(f),
      removeEventListener: (t: string, f: (e: unknown) => void) => listeners.get(t)?.delete(f),
    });
    const fire = (t: string, e: unknown = {}) => listeners.get(t)?.forEach((f) => f(e));
    const cb = vi.fn();
    const off = subscribe(cb);
    fire('sidebar-collapsed-change');
    expect(cb).toHaveBeenCalledTimes(1);
    fire('storage', { key: SIDEBAR_KEY });
    expect(cb).toHaveBeenCalledTimes(2);
    fire('storage', { key: 'something-else' });
    expect(cb).toHaveBeenCalledTimes(2);
    off();
    fire('sidebar-collapsed-change');
    fire('storage', { key: SIDEBAR_KEY });
    expect(cb).toHaveBeenCalledTimes(2);
  });
});

describe('SIDEBAR_INIT_SCRIPT', () => {
  const run = (localStorage: unknown) => {
    const documentElement = { dataset: {} as Record<string, string> };
    vm.runInNewContext(SIDEBAR_INIT_SCRIPT, { localStorage, document: { documentElement } });
    return documentElement.dataset.sidebar;
  };
  it('sets data-sidebar=collapsed only for a stored "1"', () => {
    expect(run(memoryStorage({ [SIDEBAR_KEY]: '1' }))).toBe('collapsed');
    expect(run(memoryStorage())).toBeUndefined();
    expect(run(memoryStorage({ [SIDEBAR_KEY]: '0' }))).toBeUndefined();
  });
  it('is silent when localStorage throws', () => {
    expect(run(throwing)).toBeUndefined();
  });
});
