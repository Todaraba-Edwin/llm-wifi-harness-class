'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { shouldBlockSamePageClick, shouldBlockSearchSubmit } from '@/lib/nav-guard';
import { FOCUS_RING, FOCUS_RING_ON_PRIMARY } from '@/lib/ui';
import SidebarToggle from './SidebarToggle';
import ThemeToggle from './ThemeToggle';

export interface NavItem {
  slug: string;
  /** Display title shown in the sidebar and drawer ("English (한글)"). */
  title: string;
  type: string;
}
export interface NavGroup {
  type: string;
  label: string;
  items: NavItem[];
}

const LINKS = [
  { href: '/', label: '홈', hint: '위키 전체 문서 목록(index)' },
  { href: '/search', label: '검색', hint: '제목, 본문, 태그 전문 검색' },
  { href: '/graph', label: '그래프', hint: '문서 간 연결을 그래프로 보기' },
  { href: '/path', label: '학습 순서', hint: '권장 읽기 순서를 단계별로 보기' },
  { href: '/skills', label: '직무 역량', hint: '채용공고에서 뽑은 직무 요구 역량' },
  { href: '/ask', label: '질문', hint: 'Q&A (소유자 전용)' },
  { href: '/log', label: '변경 기록', hint: '위키 작업 이력(ingest, query, lint)' },
];

const ACTIVE = 'bg-selected font-semibold text-primary';
const ACTIVE_ON_PRIMARY = 'bg-on-primary/[0.16] font-semibold';

/** Link that ignores a plain click on the page you are already on (shared guard, native behavior otherwise). */
function NavLink({
  href,
  className,
  activeClassName = ACTIVE,
  title,
  onSamePage,
  children,
  ...rest
}: {
  href: string;
  className: string;
  activeClassName?: string;
  title?: string;
  onSamePage?: () => void;
  children: ReactNode;
  'data-testid'?: string;
}) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      title={title}
      aria-current={active ? 'page' : undefined}
      className={`${className} ${active ? activeClassName : ''}`}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        if (shouldBlockSamePageClick(e, e.currentTarget, href, pathname, window.location.search)) {
          e.preventDefault();
          onSamePage?.();
        }
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}

function NavTree({ groups, onSamePage }: { groups: NavGroup[]; onSamePage?: () => void }) {
  return (
    <nav aria-label="문서 목록" className="space-y-3 text-sm">
      {groups.map((g) => (
        <div key={g.type}>
          <h2 className="px-3 pb-1 pt-2 font-display text-sm font-medium text-fg-2">{g.label}</h2>
          <ul>
            {g.items.map((it) => (
              <li key={it.slug}>
                <NavLink
                  href={`/wiki/${it.slug}`}
                  title={it.title}
                  onSamePage={onSamePage}
                  className={`block min-h-9 break-words rounded px-3 py-2 hover:bg-hover ${FOCUS_RING}`}
                >
                  {it.title}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default function SiteShell({ groups, children }: { groups: NavGroup[]; children: ReactNode }) {
  const pathname = usePathname();
  // The drawer is tied to the path it was opened on, so navigating closes it.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (v: boolean) => setOpenAt(v ? pathname : null);

  return (
    <div className="min-h-screen bg-canvas text-fg">
      <header className="sticky top-0 z-30 h-[49px] bg-primary text-on-primary shadow-elev4 dark:border-b dark:border-divider dark:bg-surface dark:shadow-none dark:[--on-primary:#fff]">
        <div className="flex h-full items-center gap-3 px-3 sm:px-4">
          <button
            type="button"
            aria-label="메뉴 열기"
            aria-expanded={open}
            data-testid="drawer-toggle"
            onClick={() => setOpen(!open)}
            className={`rounded border border-on-primary/50 px-2.5 py-1.5 text-sm font-medium hover:bg-on-primary/[0.08] aria-expanded:bg-on-primary/[0.16] lg:hidden ${FOCUS_RING_ON_PRIMARY}`}
          >
            메뉴
          </button>
          <SidebarToggle />
          <NavLink href="/" activeClassName="" className={`shrink-0 rounded font-display text-lg font-bold ${FOCUS_RING_ON_PRIMARY}`}>
            Harness 위키
          </NavLink>
          <nav aria-label="주요 메뉴" className="ml-2 hidden items-center gap-1 text-sm lg:flex">
            {LINKS.map((l) => (
              <NavLink key={l.href} href={l.href} title={l.hint} activeClassName={ACTIVE_ON_PRIMARY} className={`rounded px-3 py-1.5 font-medium hover:bg-on-primary/[0.08] ${FOCUS_RING_ON_PRIMARY}`}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <form
            action="/search"
            method="get"
            role="search"
            className="ml-auto min-w-0 flex-1 sm:max-w-xs"
            onSubmit={(e) => {
              const q = new FormData(e.currentTarget).get('q');
              if (shouldBlockSearchSubmit(typeof q === 'string' ? q : '', window.location.pathname, window.location.search)) e.preventDefault();
            }}
          >
            <input
              name="q"
              type="search"
              placeholder="검색"
              aria-label="위키 검색"
              className={`w-full min-w-0 rounded border-0 bg-on-primary/15 px-3 py-1.5 text-sm text-on-primary placeholder:text-on-primary/70 hover:bg-on-primary/25 ${FOCUS_RING_ON_PRIMARY}`}
            />
          </form>
          <ThemeToggle />
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 top-[49px] z-20 lg:hidden" data-testid="drawer">
          <button type="button" aria-label="메뉴 닫기" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative h-full w-4/5 max-w-xs overflow-y-auto bg-surface p-3 shadow-elev4">
            <ul className="mb-4 grid grid-cols-2 gap-1 text-sm">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <NavLink
                    href={l.href}
                    title={l.hint}
                    onSamePage={() => setOpen(false)}
                    className={`block min-h-9 rounded border border-divider px-3 py-1.5 hover:bg-hover ${FOCUS_RING}`}
                  >
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <NavTree groups={groups} onSamePage={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div id="site-layout" className="grid grid-cols-1 gap-6 px-3 sm:px-4 lg:grid-cols-[auto_minmax(0,1fr)]">
        <aside
          id="sidebar"
          className="sticky top-[49px] hidden h-[calc(100vh-49px)] w-64 shrink-0 self-start overflow-y-auto py-4 lg:block"
        >
          <NavTree groups={groups} />
        </aside>
        <main id="main-content" className="min-w-0 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
