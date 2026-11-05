// One shared guard for header links, the logo and sidebar items: a plain click on the link to the page you are
// already on does nothing (no re-navigation, no scroll to top). Everything else keeps native behavior.

export interface ClickLike {
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}

export interface AnchorLike {
  getAttribute(name: string): string | null;
}

/** `href` is the link target path (no origin). `search` is `window.location.search`. */
export function shouldBlockSamePageClick(event: ClickLike, anchor: AnchorLike, href: string, pathname: string, search: string): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return false;
  const target = anchor.getAttribute('target');
  if (target !== null && target !== '' && target !== '_self') return false;
  if (anchor.getAttribute('download') !== null) return false;
  if (href.includes('#') || href.includes('?')) return false;
  return href === pathname && search === '';
}

/** Search form: block an empty query and a query equal to the one already shown on /search. */
export function shouldBlockSearchSubmit(query: string, pathname: string, search: string): boolean {
  const q = query.trim();
  if (q === '') return true;
  if (pathname !== '/search') return false;
  return new URLSearchParams(search).get('q') === q;
}
