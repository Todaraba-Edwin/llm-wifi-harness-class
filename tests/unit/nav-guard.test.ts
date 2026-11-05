import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { shouldBlockSamePageClick, shouldBlockSearchSubmit, type ClickLike } from '@/lib/nav-guard';
import { REPO } from './helpers';

const click = (over: Partial<ClickLike> = {}): ClickLike => ({
  button: 0,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
  ...over,
});
const anchor = (attrs: Record<string, string> = {}) => ({ getAttribute: (n: string) => attrs[n] ?? null });

describe('shouldBlockSamePageClick', () => {
  it('blocks a plain primary click on the current path', () => {
    expect(shouldBlockSamePageClick(click(), anchor(), '/graph', '/graph', '')).toBe(true);
    expect(shouldBlockSamePageClick(click(), anchor({ target: '_self' }), '/', '/', '')).toBe(true);
  });
  it('keeps native behavior for other pages, queries and hashes', () => {
    expect(shouldBlockSamePageClick(click(), anchor(), '/search', '/graph', '')).toBe(false);
    expect(shouldBlockSamePageClick(click(), anchor(), '/search', '/search', '?q=abc')).toBe(false);
    expect(shouldBlockSamePageClick(click(), anchor(), '/wiki/a#top', '/wiki/a', '')).toBe(false);
  });
  it.each([
    ['ctrl', { ctrlKey: true }],
    ['meta', { metaKey: true }],
    ['shift', { shiftKey: true }],
    ['alt', { altKey: true }],
    ['middle button', { button: 1 }],
    ['right button', { button: 2 }],
    ['already prevented', { defaultPrevented: true }],
  ])('does not block with %s', (_n, over) => {
    expect(shouldBlockSamePageClick(click(over), anchor(), '/graph', '/graph', '')).toBe(false);
  });
  it('does not block target=_blank or download links', () => {
    expect(shouldBlockSamePageClick(click(), anchor({ target: '_blank' }), '/graph', '/graph', '')).toBe(false);
    expect(shouldBlockSamePageClick(click(), anchor({ download: '' }), '/graph', '/graph', '')).toBe(false);
  });
});

describe('shouldBlockSearchSubmit', () => {
  it('blocks empty and whitespace queries', () => {
    expect(shouldBlockSearchSubmit('', '/', '')).toBe(true);
    expect(shouldBlockSearchSubmit('   ', '/search', '?q=a')).toBe(true);
  });
  it('blocks the same query on /search but not a new one or the same text elsewhere', () => {
    expect(shouldBlockSearchSubmit('compaction', '/search', '?q=compaction')).toBe(true);
    expect(shouldBlockSearchSubmit(' compaction ', '/search', '?q=compaction')).toBe(true);
    expect(shouldBlockSearchSubmit('harness', '/search', '?q=compaction')).toBe(false);
    expect(shouldBlockSearchSubmit('compaction', '/graph', '?q=compaction')).toBe(false);
    expect(shouldBlockSearchSubmit('compaction', '/search', '')).toBe(false);
  });
});

describe('layout source regressions (static)', () => {
  const shell = fs.readFileSync(path.join(REPO, 'src/components/SiteShell.tsx'), 'utf8');
  const css = fs.readFileSync(path.join(REPO, 'src/app/globals.css'), 'utf8');
  it('the shell has no max-width and uses the auto/1fr grid with min-w-0 on main', () => {
    expect(shell).not.toMatch(/max-w-7xl/);
    expect(shell).toContain('id="site-layout"');
    expect(shell).toContain('lg:grid-cols-[auto_minmax(0,1fr)]');
    expect(shell).toMatch(/<main id="main-content" className="min-w-0/);
  });
  it('the sidebar keeps its sticky classes and id, and the collapsed rules are unlayered CSS', () => {
    expect(shell).toContain('id="sidebar"');
    expect(shell).toContain('sticky top-[49px] hidden h-[calc(100vh-49px)] w-64 shrink-0 self-start overflow-y-auto py-4 lg:block');
    expect(css).toMatch(/html\[data-sidebar='collapsed'\] #sidebar\s*\{\s*display:\s*none/);
    expect(css).toMatch(/html\[data-sidebar='collapsed'\] #site-layout\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
    expect(css).not.toMatch(/^\s*@layer\b/m);
  });
});
