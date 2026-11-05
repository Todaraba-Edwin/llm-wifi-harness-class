export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Transform {
  x: number;
  y: number;
  k: number;
}

export interface LabelNode {
  id: string;
  x: number;
  y: number;
  /** circle radius in graph units */
  r: number;
  degree: number;
  /** full title as displayed, already wrapped into lines (see wrapLabel) */
  lines: string[];
}

export interface LabelOptions {
  /** constant on-screen font size in px */
  baseFontSize?: number;
  /** on-screen padding around each label box in px */
  padding?: number;
  /** text width in px at the given font size; defaults to estimateTextWidth */
  measure?: (label: string, fontSize: number) => number;
}

export function nodeRadius(degree: number): number {
  return 6 + Math.sqrt(degree) * 1.5;
}

/** Wraps a full title into lines of at most `max` characters, breaking at spaces (or mid-word when one word is longer). Never drops text. */
export function wrapLabel(title: string, max = 20): string[] {
  const lines: string[] = [];
  let cur = '';
  const push = () => {
    if (cur !== '') lines.push(cur);
    cur = '';
  };
  for (const word of title.split(/\s+/).filter(Boolean)) {
    let w = Array.from(word);
    while (w.length > max) {
      push();
      lines.push(w.slice(0, max).join(''));
      w = w.slice(max);
    }
    const piece = w.join('');
    if (cur === '') cur = piece;
    else if (Array.from(cur).length + 1 + w.length <= max) cur += ` ${piece}`;
    else {
      push();
      cur = piece;
    }
  }
  push();
  return lines.length ? lines : [title];
}

export function neighborSet(edges: ReadonlyArray<{ source: string; target: string }>, id: string): Set<string> {
  const out = new Set<string>();
  for (const e of edges) {
    if (e.source === id && e.target !== id) out.add(e.target);
    else if (e.target === id && e.source !== id) out.add(e.source);
  }
  return out;
}

export function bboxOf(items: ReadonlyArray<{ x: number; y: number; r: number }>): Box {
  if (items.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const i of items) {
    minX = Math.min(minX, i.x - i.r);
    minY = Math.min(minY, i.y - i.r);
    maxX = Math.max(maxX, i.x + i.r);
    maxY = Math.max(maxY, i.y + i.r);
  }
  return { minX, minY, maxX, maxY };
}

/** Transform (screen = x + k * graph) that centers bbox in width x height with at least `margin` px around it. */
export function fitTransform(bbox: Box, width: number, height: number, margin = 48, maxScale = 4): Transform {
  const bw = Math.max(bbox.maxX - bbox.minX, 1);
  const bh = Math.max(bbox.maxY - bbox.minY, 1);
  const raw = Math.min((width - 2 * margin) / bw, (height - 2 * margin) / bh, maxScale);
  const k = Math.max(raw, 0.01);
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  return { x: width / 2 - cx * k, y: height / 2 - cy * k, k };
}

/** Rough text width: CJK glyphs are about 1em wide, others about 0.6em. */
export function estimateTextWidth(label: string, fontSize: number): number {
  let w = 0;
  for (const ch of label) {
    const code = ch.codePointAt(0) ?? 0;
    w += code >= 0x1100 ? 1.05 : 0.6;
  }
  return w * fontSize;
}

/** Label box in graph units; the label sits just below its circle at constant screen font size. */
export function labelBox(n: LabelNode, k: number, opts: LabelOptions = {}): Box {
  const base = opts.baseFontSize ?? 11;
  const pad = (opts.padding ?? 2) / k;
  const measure = opts.measure ?? estimateTextWidth;
  const width = Math.max(...n.lines.map((l) => measure(l, base))) / k;
  const top = n.y + n.r + 2 / k;
  return {
    minX: n.x - width / 2 - pad,
    maxX: n.x + width / 2 + pad,
    minY: top - pad,
    maxY: top + (base * 1.3 * n.lines.length) / k + pad,
  };
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

function boxHitsCircle(b: Box, cx: number, cy: number, r: number): boolean {
  const nx = Math.max(b.minX, Math.min(cx, b.maxX));
  const ny = Math.max(b.minY, Math.min(cy, b.maxY));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

/**
 * Ids of labels to draw. Selected ids always show. Every other node is a candidate, taken greedily by descending degree and
 * dropped only when its box hits an accepted label or another node's circle, so wide screens and zooming show more labels.
 */
export function visibleLabelIds(
  nodes: ReadonlyArray<LabelNode>,
  k: number,
  selectedIds: ReadonlySet<string> = new Set(),
  opts: LabelOptions = {},
): Set<string> {
  const sorted = [...nodes].sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id));
  const out = new Set<string>();
  const placed: Box[] = [];

  for (const n of sorted) {
    if (!selectedIds.has(n.id)) continue;
    out.add(n.id);
    placed.push(labelBox(n, k, opts));
  }
  for (const n of sorted) {
    if (out.has(n.id)) continue;
    const box = labelBox(n, k, opts);
    if (placed.some((p) => boxesIntersect(p, box))) continue;
    if (nodes.some((o) => o.id !== n.id && boxHitsCircle(box, o.x, o.y, o.r))) continue;
    out.add(n.id);
    placed.push(box);
  }
  return out;
}
