import type { Metadata } from 'next';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';
import WikiLinkTracker from '@/components/WikiLinkTracker';
import SiteShell, { type NavGroup } from '@/components/SiteShell';
import { displayTitles, pages, TYPE_LABEL, TYPE_ORDER } from '@/lib/data';
import { SIDEBAR_INIT_SCRIPT } from '@/lib/sidebar-state';

export const metadata: Metadata = {
  title: { default: 'Harness 위키', template: '%s | Harness 위키' },
  description: 'Harness engineering 학습용 LLM 위키',
  robots: { index: false, follow: false },
};

const groups: NavGroup[] = TYPE_ORDER.map((type) => ({
  type,
  label: TYPE_LABEL[type],
  items: pages.filter((p) => p.type === type).map((p) => ({ slug: p.slug, title: displayTitles[p.slug], type: p.type })),
}));

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* Applies the saved sidebar state before first paint (CSS in globals.css does the hiding), like next-themes. */}
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <WikiLinkTracker />
          <SiteShell groups={groups}>{children}</SiteShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
