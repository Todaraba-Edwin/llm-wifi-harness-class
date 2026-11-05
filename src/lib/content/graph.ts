import type { PageType } from './frontmatter';

export interface GraphInputPage {
  slug: string;
  title: string;
  type: PageType;
  tags: string[];
  outgoing: string[];
}
export interface GraphNode {
  id: string;
  title: string;
  type: PageType;
  tags: string[];
  degree: number;
}
export interface GraphEdge {
  source: string;
  target: string;
}
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Content-to-content edges only: deduped, self links dropped, no index/log sources. */
export function buildGraph(pages: GraphInputPage[]): { graph: GraphData; backlinks: Record<string, string[]> } {
  const slugs = new Set(pages.map((p) => p.slug));
  const seen = new Set<string>();
  const edges: GraphEdge[] = [];
  const backlinks: Record<string, string[]> = Object.fromEntries(pages.map((p) => [p.slug, [] as string[]]));
  const degree: Record<string, number> = Object.fromEntries(pages.map((p) => [p.slug, 0]));
  for (const p of [...pages].sort((a, b) => a.slug.localeCompare(b.slug))) {
    for (const t of p.outgoing) {
      if (t === p.slug || !slugs.has(t)) continue;
      const key = `${p.slug}\u0000${t}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: p.slug, target: t });
      backlinks[t].push(p.slug);
      degree[p.slug]++;
      degree[t]++;
    }
  }
  for (const k of Object.keys(backlinks)) backlinks[k].sort();
  const nodes = [...pages]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((p) => ({ id: p.slug, title: p.title, type: p.type, tags: p.tags, degree: degree[p.slug] }));
  return { graph: { nodes, edges }, backlinks };
}
