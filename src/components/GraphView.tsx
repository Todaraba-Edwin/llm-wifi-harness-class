'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { drag } from 'd3-drag';
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import type { GraphData, GraphNode } from '@/lib/content/graph';
import { BTN_OUTLINED } from '@/lib/ui';
import { bboxOf, fitTransform, neighborSet, nodeRadius, visibleLabelIds, wrapLabel, type LabelNode } from '@/lib/graph-layout';

interface SimNode extends SimulationNodeDatum, GraphNode {}
type SimLink = SimulationLinkDatum<SimNode>;

const COLORS: Record<string, string> = {
  source: '#2563eb',
  concept: '#059669',
  entity: '#d97706',
  synthesis: '#9333ea',
};
const LABELS: Record<string, string> = { source: '출처 요약', concept: '개념', entity: '개체', synthesis: '종합' };
const LABEL_FONT = 11;
const LABEL_WRAP = 20;
const DIM = 0.15;

function circleLayout(nodes: GraphNode[]): SimNode[] {
  return nodes.map((n, i) => {
    const a = (2 * Math.PI * i) / nodes.length;
    return { ...n, x: Math.cos(a) * 220, y: Math.sin(a) * 220 };
  });
}

const endId = (v: string | number | SimNode): string => (typeof v === 'object' ? v.id : String(v));

const button = BTN_OUTLINED;

export default function GraphView({ data }: { data: GraphData }) {
  const initial = useMemo(() => circleLayout(data.nodes), [data.nodes]);
  const [nodes, setNodes] = useState<SimNode[]>(initial);
  const [tf, setTf] = useState<ZoomTransform>(zoomIdentity);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<ReadonlySet<string>>(new Set());
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const simNodes = useRef<SimNode[]>([]);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const sizeRef = useRef(size);
  const hiddenRef = useRef(hiddenTypes);
  const tfRef = useRef(tf);
  const fittedWidth = useRef(0);

  useEffect(() => {
    tfRef.current = tf;
  }, [tf]);
  useEffect(() => {
    hiddenRef.current = hiddenTypes;
  }, [hiddenTypes]);

  const hubDegree = useMemo(() => {
    const ds = data.nodes.map((n) => n.degree).sort((a, b) => b - a);
    return Math.max(6, ds[Math.floor(ds.length * 0.15)] ?? 6);
  }, [data.nodes]);

  const fit = useCallback(() => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    const { w, h } = sizeRef.current;
    if (!svg || !z || w === 0 || h === 0) return;
    const shown = simNodes.current.filter((n) => !hiddenRef.current.has(n.type));
    if (shown.length === 0) return;
    const box = bboxOf(shown.map((n) => ({ x: n.x ?? 0, y: n.y ?? 0, r: nodeRadius(n.degree) })));
    const t = fitTransform(box, w, h, 48);
    fittedWidth.current = w;
    select(svg).call(z.transform, zoomIdentity.translate(t.x, t.y).scale(t.k));
  }, []);

  // measure the svg and follow its container
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      const r = svg.getBoundingClientRect();
      const next = { w: Math.round(r.width), h: Math.round(r.height) };
      if (next.w === sizeRef.current.w && next.h === sizeRef.current.h) return;
      sizeRef.current = next;
      setSize(next);
      if (next.w !== fittedWidth.current) fit();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [fit]);

  // zoom / pan / pinch (d3-zoom default filter)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 6])
      .on('zoom', (e) => setTf(e.transform));
    zoomRef.current = z;
    select(svg).call(z);
    return () => {
      select(svg).on('.zoom', null);
      zoomRef.current = null;
    };
  }, []);

  // force layout: pre-relaxed synchronously, then live for dragging
  useEffect(() => {
    const ns = circleLayout(data.nodes);
    simNodes.current = ns;
    const active = data.edges;
    const links: SimLink[] = active.map((e) => ({ source: e.source, target: e.target }));
    const deg = new Map<string, number>();
    for (const e of active) {
      deg.set(e.source, (deg.get(e.source) ?? 0) + 1);
      deg.set(e.target, (deg.get(e.target) ?? 0) + 1);
    }
    const linkDeg = (l: SimLink) => Math.max(deg.get(endId(l.source)) ?? 1, deg.get(endId(l.target)) ?? 1);
    const charge = 300 + Math.min(100, ns.length * 2);
    const sim = forceSimulation<SimNode>(ns)
      .force(
        'link',
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((l) => (linkDeg(l) >= hubDegree ? 140 : 120))
          .strength((l) => 0.6 / Math.sqrt(linkDeg(l))),
      )
      .force('charge', forceManyBody<SimNode>().strength(-charge))
      .force('x', forceX<SimNode>(0).strength(0.05))
      .force('y', forceY<SimNode>(0).strength(0.05))
      .force('collide', forceCollide<SimNode>().radius((d) => nodeRadius(d.degree) + 8).iterations(2))
      .stop();
    sim.tick(300);
    simRef.current = sim;
    fit();
    let raf = 0;
    const flush = () => {
      raf = 0;
      setNodes(ns.map((n) => ({ ...n })));
    };
    // The relaxed layout is published from a frame callback, not synchronously inside the effect.
    raf = requestAnimationFrame(flush);
    sim.on('tick', () => {
      if (!raf) raf = requestAnimationFrame(flush);
    });
    return () => {
      sim.stop();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [data, hubDegree, fit]);

  // drag (re-bound whenever the rendered anchors or simulation nodes change)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const d = drag<SVGAElement, SimNode>()
      .on('start', (e) => {
        simRef.current?.alphaTarget(0.3).restart();
        e.subject.fx = e.subject.x;
        e.subject.fy = e.subject.y;
      })
      .on('drag', (e) => {
        e.subject.fx = (e.x - tfRef.current.x) / tfRef.current.k;
        e.subject.fy = (e.y - tfRef.current.y) / tfRef.current.k;
      })
      .on('end', (e) => {
        simRef.current?.alphaTarget(0);
        e.subject.fx = null;
        e.subject.fy = null;
      })
      .subject((e, datum) => datum)
      .container(svg as unknown as SVGAElement);
    const sel = select(svg).selectAll<SVGAElement, SimNode>('a[data-node]');
    sel.each(function () {
      const id = this.getAttribute('data-node');
      const n = simNodes.current.find((s) => s.id === id);
      if (n) select(this).datum(n);
    });
    sel.call(d);
  }, [data, hiddenTypes]);

  const toggleType = (type: string) =>
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  const shownNodes = useMemo(() => nodes.filter((n) => !hiddenTypes.has(n.type)), [nodes, hiddenTypes]);
  const shownIds = useMemo(() => new Set(shownNodes.map((n) => n.id)), [shownNodes]);
  const pos = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const degreeOf = useMemo(() => new Map(data.nodes.map((n) => [n.id, n.degree])), [data.nodes]);
  const edges = useMemo(
    () => data.edges.filter((e) => shownIds.has(e.source) && shownIds.has(e.target) ),
    [data.edges, shownIds],
  );
  const neighbors = useMemo(() => (activeId ? neighborSet(edges, activeId) : new Set<string>()), [edges, activeId]);

  const labelIds = useMemo(() => {
    const items: LabelNode[] = shownNodes.map((n) => ({ id: n.id, x: n.x ?? 0, y: n.y ?? 0, r: nodeRadius(n.degree), degree: n.degree, lines: wrapLabel(n.title, LABEL_WRAP) }));
    return visibleLabelIds(items, tf.k, new Set(activeId ? [activeId] : []), { baseFontSize: LABEL_FONT });
  }, [shownNodes, tf.k, activeId]);

  const fs = LABEL_FONT / tf.k;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="그래프 필터">
        {Object.entries(LABELS).map(([k, v]) => (
          <button key={k} type="button" aria-pressed={!hiddenTypes.has(k)} onClick={() => toggleType(k)} className={`${button} ${hiddenTypes.has(k) ? 'text-fg-2 line-through' : ''}`}>
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLORS[k] }} />
            {v}
          </button>
        ))}
        <button type="button" onClick={fit} className={button}>
          화면에 맞추기
        </button>
      </div>
      <ul className="mb-3 flex flex-wrap gap-3 text-sm">
        <li className="text-fg-2">드래그로 이동, 휠/핀치로 확대, 노드를 눌러 문서로 이동</li>
      </ul>
      <svg
        ref={svgRef}
        viewBox={size.w > 0 ? `0 0 ${size.w} ${size.h}` : undefined}
        className="h-[70vh] w-full touch-none rounded border border-divider bg-surface shadow-elev1 dark:shadow-none"
        role="img"
        aria-label="위키 문서 연결 그래프"
        data-testid="graph-svg"
      >
        <g transform={`translate(${tf.x} ${tf.y}) scale(${tf.k})`}>
          <g className="text-fg-2" fill="none">
            {edges.map((e) => {
              const s = pos.get(e.source);
              const t = pos.get(e.target);
              if (!s || !t) return null;
              const hub = (degreeOf.get(e.source) ?? 0) >= hubDegree || (degreeOf.get(e.target) ?? 0) >= hubDegree;
              const incident = activeId !== null && (e.source === activeId || e.target === activeId);
              const opacity = incident ? 0.85 : activeId ? 0.04 : hub ? 0.1 : 0.3;
              return (
                <line
                  key={`${e.source}>${e.target}`}
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke={incident ? COLORS[s.type] : 'currentColor'}
                  strokeOpacity={opacity}
                  strokeWidth={incident ? 1.8 : 1}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>
          {shownNodes.map((n) => {
            const r = nodeRadius(n.degree);
            const dimmed = activeId !== null && n.id !== activeId && !neighbors.has(n.id);
            const showLabel = labelIds.has(n.id);
            return (
              <Link
                key={n.id}
                href={`/wiki/${n.id}`}
                data-node={n.id}
                data-type={n.type}
                data-testid="graph-node"
                aria-label={n.title}
                className="group cursor-pointer outline-none"
                style={{ opacity: dimmed ? DIM : 1 }}
                onMouseEnter={() => setActiveId(n.id)}
                onMouseLeave={() => setActiveId(null)}
                onFocus={() => setActiveId(n.id)}
                onBlur={() => setActiveId(null)}
              >
                <title>{n.title}</title>
                <circle cx={n.x} cy={n.y} r={r + 4} fill="none" strokeWidth={2.5 / tf.k} className="stroke-fg opacity-0 group-focus-visible:opacity-100" />
                <circle data-role="dot" cx={n.x} cy={n.y} r={r} fill={COLORS[n.type]} stroke="white" strokeWidth={1.5} />
                {showLabel && (
                  <text
                    x={n.x}
                    y={(n.y ?? 0) + r + 2 / tf.k + fs * 0.95}
                    textAnchor="middle"
                    fontSize={fs}
                    strokeWidth={3 / tf.k}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    className="fill-fg stroke-surface"
                    style={{ pointerEvents: 'none' }}
                  >
                    {wrapLabel(n.title, LABEL_WRAP).map((line, i) => (
                      <tspan key={i} x={n.x} dy={i === 0 ? 0 : fs * 1.3}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                )}
              </Link>
            );
          })}
        </g>
      </svg>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-primary">목록으로 보기 ({data.nodes.length}개 문서)</summary>
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {data.nodes.map((n) => (
            <li key={n.id}>
              <Link href={`/wiki/${n.id}`} className="text-primary underline">
                {n.title}
              </Link>
              <span className="ml-1 text-fg-2">({n.degree})</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
