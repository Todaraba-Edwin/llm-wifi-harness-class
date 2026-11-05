// Persisted desktop sidebar state. Default is expanded; the stored value '1' means collapsed.
// Reads and writes never throw: storage can be unavailable (private mode, blocked cookies).

export const SIDEBAR_KEY = 'sidebar-collapsed';
const CHANGE_EVENT = 'sidebar-collapsed-change';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readCollapsed(storage: StorageLike | undefined | null): boolean {
  try {
    return storage?.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeCollapsed(storage: StorageLike | undefined | null, collapsed: boolean): void {
  try {
    storage?.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  } catch {
    // Keep working for this page view even if the value cannot be saved.
  }
}

function localStorageOrNull(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Subscribes to same-tab writes (custom event) and other-tab writes (storage event). Returns the unsubscribe. */
export function subscribe(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === SIDEBAR_KEY) cb();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function getSnapshot(): boolean {
  return readCollapsed(localStorageOrNull());
}

export function getServerSnapshot(): boolean {
  return false;
}

/** Writes the value, mirrors it onto <html data-sidebar>, and notifies same-tab subscribers. */
export function setCollapsed(collapsed: boolean): void {
  writeCollapsed(localStorageOrNull(), collapsed);
  applyToDocument(collapsed);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function applyToDocument(collapsed: boolean, root: { dataset: DOMStringMap } = document.documentElement): void {
  if (collapsed) root.dataset.sidebar = 'collapsed';
  else delete root.dataset.sidebar;
}

/** Runs before first paint (inline in <head>), same pattern as next-themes. CSS does the hiding. */
export const SIDEBAR_INIT_SCRIPT = `try{if(localStorage.getItem('${SIDEBAR_KEY}')==='1')document.documentElement.dataset.sidebar='collapsed'}catch(e){}`;
