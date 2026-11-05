import { describe, expect, it } from 'vitest';
import { bboxOf, boxesIntersect, fitTransform, labelBox, neighborSet, visibleLabelIds, wrapLabel, type LabelNode } from '@/lib/graph-layout';

describe('fitTransform', () => {
  it('fits and centers a bbox with margin', () => {
    const bbox = { minX: -300, minY: -100, maxX: 500, maxY: 300 };
    const { x, y, k } = fitTransform(bbox, 1000, 600, 40);
    const left = x + bbox.minX * k;
    const right = x + bbox.maxX * k;
    const top = y + bbox.minY * k;
    const bottom = y + bbox.maxY * k;
    expect(left).toBeGreaterThanOrEqual(40 - 1e-6);
    expect(right).toBeLessThanOrEqual(960 + 1e-6);
    expect(top).toBeGreaterThanOrEqual(40 - 1e-6);
    expect(bottom).toBeLessThanOrEqual(560 + 1e-6);
    expect((left + right) / 2).toBeCloseTo(500, 6);
    expect((top + bottom) / 2).toBeCloseTo(300, 6);
  });

  it('is limited by the tighter axis', () => {
    const { k } = fitTransform({ minX: 0, minY: 0, maxX: 100, maxY: 1000 }, 800, 600, 0, 10);
    expect(k).toBeCloseTo(0.6, 6);
  });

  it('survives a degenerate bbox', () => {
    const t = fitTransform({ minX: 5, minY: 5, maxX: 5, maxY: 5 }, 400, 300, 20);
    expect(Number.isFinite(t.x) && Number.isFinite(t.y) && t.k > 0).toBe(true);
  });
});

describe('bboxOf', () => {
  it('includes radius', () => {
    expect(bboxOf([{ x: 0, y: 0, r: 5 }, { x: 10, y: 20, r: 2 }])).toEqual({ minX: -5, minY: -5, maxX: 12, maxY: 22 });
  });
});

describe('wrapLabel', () => {
  it('keeps short titles on one line', () => {
    expect(wrapLabel('Short', 20)).toEqual(['Short']);
  });
  it('never drops text: lines rejoin to the full title and respect the max', () => {
    const title = 'OpenAI: Harness engineering: leveraging Codex in an agent-first world';
    const lines = wrapLabel(title, 20);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe(title);
    for (const l of lines) expect(Array.from(l).length).toBeLessThanOrEqual(20);
    expect(lines.join('')).not.toContain('…');
  });
  it('splits one very long word and handles Korean', () => {
    expect(wrapLabel('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
    const ko = '에이전트 하네스 설계에서 긴 문서 제목을 다루는 방법';
    const lines = wrapLabel(ko, 10);
    expect(lines.join(' ')).toBe(ko);
    for (const l of lines) expect(Array.from(l).length).toBeLessThanOrEqual(10);
  });
});

describe('neighborSet', () => {
  const edges = [
    { source: 'a', target: 'b' },
    { source: 'c', target: 'a' },
    { source: 'b', target: 'd' },
    { source: 'a', target: 'a' },
  ];
  it('collects both directions without self', () => {
    expect([...neighborSet(edges, 'a')].sort()).toEqual(['b', 'c']);
  });
  it('is empty for unknown ids', () => {
    expect(neighborSet(edges, 'zzz').size).toBe(0);
  });
});

describe('visibleLabelIds', () => {
  const mk = (id: string, x: number, y: number, degree: number, label = id): LabelNode => ({ id, x, y, r: 8, degree, lines: [label] });

  it('never returns intersecting labels and prefers higher degree', () => {
    const nodes = [mk('low', 0, -10, 1, 'low-degree-label'), mk('high', 0, 0, 20, 'high-degree-label'), mk('far', 600, 600, 2, 'far')];
    const out = visibleLabelIds(nodes, 1, new Set(), {});
    expect(out.has('high')).toBe(true);
    expect(out.has('low')).toBe(false);
    expect(out.has('far')).toBe(true);
    const boxes = nodes.filter((n) => out.has(n.id)).map((n) => labelBox(n, 1));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(boxesIntersect(boxes[i], boxes[j])).toBe(false);
  });

  it('hides a label that would cover another node circle', () => {
    const nodes = [mk('a', 0, 0, 5, 'aaaaaaaaaa'), mk('b', 0, 14, 1, 'b')];
    expect(visibleLabelIds(nodes, 10, new Set()).has('a')).toBe(false);
  });

  it('always includes selected ids', () => {
    const nodes = Array.from({ length: 20 }, (_, i) => mk(`n${i}`, i * 500, 0, i));
    const out = visibleLabelIds(nodes, 1, new Set(['n0']));
    expect(out.has('n0')).toBe(true);
  });

  it('shows every label whose box is free, regardless of degree or zoom', () => {
    const nodes = Array.from({ length: 20 }, (_, i) => mk(`n${i}`, i * 500, 0, i));
    expect(visibleLabelIds(nodes, 1, new Set()).size).toBe(20);
  });

  it('accounts for wrapped (multi-line) height', () => {
    const one = labelBox({ ...mk('a', 0, 0, 1), lines: ['x'] }, 1);
    const two = labelBox({ ...mk('a', 0, 0, 1), lines: ['x', 'y'] }, 1);
    expect(two.maxY).toBeGreaterThan(one.maxY);
  });
});
