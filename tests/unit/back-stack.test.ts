import { describe, expect, it } from 'vitest';
import { backTarget, labelFor, parseStack, pop, push } from '@/lib/back-stack';

describe('back stack', () => {
  it('offers a way back only when the top entry targets the current path', () => {
    const s = push([], { from: '/wiki/a', to: '/wiki/b' });
    expect(backTarget(s, '/wiki/b')).toEqual({ from: '/wiki/a', to: '/wiki/b' });
    expect(backTarget(s, '/wiki/c')).toBeNull();
    expect(backTarget([], '/wiki/b')).toBeNull();
  });
  it('supports a chain a -> b -> c and unwinds one step at a time', () => {
    let s = push([], { from: '/wiki/a', to: '/wiki/b' });
    s = push(s, { from: '/wiki/b', to: '/wiki/c' });
    expect(backTarget(s, '/wiki/c')?.from).toBe('/wiki/b');
    s = pop(s);
    expect(backTarget(s, '/wiki/b')?.from).toBe('/wiki/a');
    expect(backTarget(pop(s), '/wiki/a')).toBeNull();
  });
  it('ignores self links and caps the depth', () => {
    expect(push([], { from: '/wiki/a', to: '/wiki/a' })).toEqual([]);
    let s: ReturnType<typeof push> = [];
    for (let i = 0; i < 80; i++) s = push(s, { from: `/wiki/p${i}`, to: `/wiki/p${i + 1}` });
    expect(s).toHaveLength(50);
  });
  it('parses stored data defensively', () => {
    expect(parseStack(null)).toEqual([]);
    expect(parseStack('not json')).toEqual([]);
    expect(parseStack('{"a":1}')).toEqual([]);
    expect(parseStack('[{"from":"/a","to":"/b"},{"x":1}]')).toEqual([{ from: '/a', to: '/b' }]);
  });
  it('labels wiki pages by title and top-level pages by name', () => {
    expect(labelFor('/wiki/a', { a: 'Alpha' })).toBe('Alpha');
    expect(labelFor('/wiki/zzz', {})).toBe('zzz');
    expect(labelFor('/log', {})).toBe('변경 기록');
    expect(labelFor('/', {})).toBe('홈');
  });
});
