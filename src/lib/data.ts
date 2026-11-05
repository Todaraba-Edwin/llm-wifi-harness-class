import pagesJson from '@/generated/pages.json';
import graphJson from '@/generated/graph.json';
import dashboardsJson from '@/generated/dashboards.json';
import displayTitlesJson from '@/generated/display-titles.json';
import type { WikiPage } from '@/lib/content/corpus';
import type { GraphData } from '@/lib/content/graph';
import type { Dashboards } from '@/lib/content/dashboards';

export type PageRecord = Omit<WikiPage, 'fullBody'>;

export const pages = pagesJson.pages as PageRecord[];
export const indexBody = pagesJson.index.body;
export const logBody = pagesJson.log.body;
export const graph = graphJson as GraphData;
export const dashboards = dashboardsJson as Dashboards;

/** Bilingual "English (한글)" titles. Used by the sidebar and drawer only; everything else keeps `titles`. */
export const displayTitles = displayTitlesJson as Record<string, string>;

export const titles: Record<string, string> = Object.fromEntries(pages.map((p) => [p.slug, p.title]));
export const bySlug: Record<string, PageRecord> = Object.fromEntries(pages.map((p) => [p.slug, p]));

export const TYPE_LABEL: Record<string, string> = {
  source: '출처 요약',
  concept: '개념',
  entity: '개체',
  synthesis: '종합',
};
export const TYPE_ORDER = ['source', 'concept', 'entity', 'synthesis'] as const;
