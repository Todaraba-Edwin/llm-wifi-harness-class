import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { remarkWikilinks } from '@/lib/content/wikilinks';
import { titles } from '@/lib/data';

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="prose max-w-none break-words prose-headings:scroll-mt-20">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkWikilinks(titles)]}
        rehypePlugins={[rehypeSlug]}
        components={{
          a({ href, children: c, className }) {
            if (href && href.startsWith('/')) {
              return (
                <Link href={href} className={className}>
                  {c}
                </Link>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
                {c}
              </a>
            );
          },
          table({ children: c }) {
            return (
              <div className="overflow-x-auto">
                <table>{c}</table>
              </div>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
