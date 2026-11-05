import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import type { Root, Nodes, Text, PhrasingContent } from 'mdast';

const WIKILINK_RE = /\[\[([^\]\n]*)\]\]/g;

export function parseMarkdown(md: string): Root {
  return unified().use(remarkParse).use(remarkGfm).parse(md) as Root;
}

export interface WikilinkScan {
  /** Targets in first-appearance order, duplicates kept. */
  targets: string[];
  /** Raw inner text of unsupported forms such as [[a|b]] / [[a#b]] / empty. */
  invalid: string[];
}

/** Wikilinks come from mdast text nodes only, so code spans and blocks are skipped. */
export function scanWikilinks(tree: Root): WikilinkScan {
  const targets: string[] = [];
  const invalid: string[] = [];
  visit(tree, 'text', (node: Text) => {
    for (const m of node.value.matchAll(WIKILINK_RE)) {
      const inner = m[1].trim();
      if (!inner || /[|#]/.test(inner)) invalid.push(m[1]);
      else targets.push(inner);
    }
  });
  return { targets, invalid };
}

/** remark plugin: replaces [[slug]] with a link to /wiki/slug whose text is the target title. */
export function remarkWikilinks(titles: Record<string, string>) {
  return () => (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === undefined) return;
      const out: PhrasingContent[] = [];
      let last = 0;
      const value = node.value;
      for (const m of value.matchAll(WIKILINK_RE)) {
        const slug = m[1].trim();
        const title = titles[slug];
        if (!title) continue;
        if (m.index > last) out.push({ type: 'text', value: value.slice(last, m.index) });
        out.push({
          type: 'link',
          url: `/wiki/${slug}`,
          children: [{ type: 'text', value: title }],
          data: { hProperties: { className: ['wikilink'] } },
        });
        last = m.index + m[0].length;
      }
      if (out.length === 0) return;
      if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
      (parent.children as PhrasingContent[]).splice(index, 1, ...out);
      return index + out.length;
    });
  };
}

const BLOCKS = new Set(['paragraph', 'heading', 'listItem', 'tableRow', 'blockquote', 'thematicBreak', 'table', 'list']);

/**
 * Plain text of the displayed content: text, inline code, code, image alt;
 * a wikilink contributes the target title; html and frontmatter are dropped;
 * block boundaries become spaces.
 */
export function toPlainText(tree: Root, titles: Record<string, string>): string {
  const parts: string[] = [];
  const walk = (node: Nodes) => {
    switch (node.type) {
      case 'text':
        parts.push(node.value.replace(WIKILINK_RE, (_m, s: string) => titles[s.trim()] ?? s.trim()));
        return;
      case 'inlineCode':
      case 'code':
        parts.push(node.value);
        break;
      case 'image':
        parts.push(node.alt ?? '');
        return;
      case 'html':
      case 'yaml':
        return;
      case 'tableCell':
        parts.push(' ');
        break;
      default:
        break;
    }
    if ('children' in node) for (const c of node.children as Nodes[]) walk(c);
    if (BLOCKS.has(node.type) || node.type === 'tableCell' || node.type === 'code') parts.push(' ');
  };
  walk(tree);
  return parts.join('').replace(/\s+/g, ' ').trim();
}
