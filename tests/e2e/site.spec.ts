import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { expect, test, type Page } from '@playwright/test';

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/generated/manifest.json'), 'utf8')) as { slugs: string[] };
const slugs = manifest.slugs;

function indexSlugs(): string[] {
  const text = fs.readFileSync(path.join(root, 'wiki/index.md'), 'utf8');
  return [...new Set([...text.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]))].sort();
}

async function noHorizontalOverflow(page: Page) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(o).toBeLessThanOrEqual(0);
}

test.describe('pages and links', () => {
  test('every wiki page renders (200) and unknown slugs 404', async ({ request }) => {
    expect(slugs).toHaveLength(39);
    for (const s of slugs) {
      const res = await request.get(`/wiki/${s}`);
      expect(res.status(), s).toBe(200);
    }
    expect((await request.get('/wiki/no-such-page')).status()).toBe(404);
    expect((await request.get('/raw/anything.md')).status()).toBe(404);
    expect((await request.get('/raw/blogs/karpathy-llm-wiki.md')).status()).toBe(404);
  });

  test('wikilink navigation and backlinks (src-job-postings <-> harness-job-requirements)', async ({ page }) => {
    await page.goto('/wiki/src-job-postings');
    await page.locator('article a[href="/wiki/harness-job-requirements"]').first().click();
    await expect(page).toHaveURL(/\/wiki\/harness-job-requirements$/);
    await expect(page.locator('[data-testid=backlinks] a[href="/wiki/src-job-postings"]')).toBeVisible();
    // Arrived through an inline wikilink: a way back with the previous page title.
    const back = page.getByTestId('back-link');
    await expect(back).toContainText('돌아가기 (채용공고 13건 (harness 언급))');
    await back.click();
    await expect(page).toHaveURL(/\/wiki\/src-job-postings$/);
    await expect(page.getByTestId('back-link')).toHaveCount(0);
  });

  test('source links point at the source URL from frontmatter, opening in a new tab', async ({ page }) => {
    await page.goto('/wiki/src-karpathy-llm-wiki');
    const links = page.locator('[data-testid=source-links] a');
    await expect(links).toHaveCount(1);
    const fm = matter(fs.readFileSync(path.join(root, 'raw/blogs/karpathy-llm-wiki.md'), 'utf8')).data as { source: string };
    await expect(links.first()).toHaveAttribute('href', fm.source);
    await expect(links.first()).toHaveAttribute('target', '_blank');
    await expect(links.first()).toHaveAttribute('rel', /noopener/);
  });

  test('noindex via meta tag and X-Robots-Tag, no robots.txt', async ({ page, request }) => {
    const res = await page.goto('/');
    expect(res?.headers()['x-robots-tag']).toBe('noindex, nofollow');
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
    expect((await request.get('/robots.txt')).status()).toBe(404);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  });
});

test.describe('search', () => {
  async function search(page: Page, q: string) {
    await page.goto('/search');
    await page.getByTestId('search-input').fill(q);
  }
  const hrefs = (page: Page) => page.locator('[data-testid=search-results] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));

  test('title, body (Korean and English), tag and particle queries', async ({ page }) => {
    await search(page, 'Agent harness');
    await expect(page.locator('[data-testid=search-results] a').first()).toHaveAttribute('href', '/wiki/agent-harness');
    await search(page, '컨텍스트');
    await expect(page.locator('[data-testid=search-results] li').first()).toBeVisible();
    await search(page, 'compaction');
    await expect.poll(() => hrefs(page)).toContain('/wiki/context-resets-vs-compaction');
    await search(page, 'jobs');
    await expect.poll(() => hrefs(page)).toContain('/wiki/src-job-postings');
    await search(page, '하네스를');
    await expect(page.locator('[data-testid=search-results] li').first()).toBeVisible();
  });

  test('empty query shows a prompt and nonsense shows no results', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByText('검색어를 입력하세요.')).toBeVisible();
    await page.getByTestId('search-input').fill('zzzqqqxxyy');
    await expect(page.getByTestId('no-results')).toBeVisible();
  });

  test('header search form submits to /search?q=', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox', { name: '위키 검색' }).fill('compaction');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/search\?q=compaction/);
    await expect(page.locator('[data-testid=search-results] li').first()).toBeVisible();
  });
});

test.describe('graph', () => {
  test('node count equals content pages equals slugs linked from index; click navigates', async ({ page }) => {
    await page.goto('/graph');
    const nodes = page.getByTestId('graph-node');
    await expect(nodes).toHaveCount(39);
    expect(indexSlugs()).toEqual([...slugs].sort());
    const ids = await nodes.evaluateAll((els) => els.map((e) => e.getAttribute('data-node')).sort());
    expect(ids).toEqual([...slugs].sort());
    await page.locator('[data-testid=graph-node][data-node=agent-harness]').click();
    await expect(page).toHaveURL(/\/wiki\/agent-harness$/);
  });
});

test.describe('dashboards', () => {
  test('/path shows the reading-order steps', async ({ page }) => {
    await page.goto('/path');
    await expect(page.getByTestId('path-step')).toHaveCount(7);
    await expect(page.getByTestId('path-step').first()).toContainText('세션 간 인계');
    await expect(page.locator('[data-testid=path-step] a[href="https://arxiv.org/abs/2606.10106"]')).toBeVisible();
    // Every step (1-7) has exactly one title link to its page, no chip duplicates.
    for (const i of [5, 6]) await expect(page.getByTestId('path-step').nth(i).locator('a[href^="/wiki/"]')).toHaveCount(1);
    // The step title is the link; no duplicate chip for the same page.
    const first = page.getByTestId('path-step').first();
    await expect(first.locator('a[href="/wiki/src-anthropic-effective-harnesses"]')).toHaveCount(1);
    await first.getByRole('link', { name: 'Anthropic: Effective harnesses for long-running agents' }).click();
    await expect(page).toHaveURL(/\/wiki\/src-anthropic-effective-harnesses$/);
    await expect(page.getByTestId('reading-prev')).toHaveCount(0);
    await page.getByTestId('reading-next').click();
    await expect(page).toHaveURL(/\/wiki\/src-openai-harness-engineering$/);
    await expect(page.getByTestId('reading-prev')).toHaveAttribute('href', '/wiki/src-anthropic-effective-harnesses');
  });

  test('/skills shows 9 skills and 13 postings linked positionally to the source URLs', async ({ page }) => {
    await page.goto('/skills');
    await expect(page.getByTestId('skill-card')).toHaveCount(9);
    const rows = page.getByTestId('posting-row');
    await expect(rows).toHaveCount(13);
    const sources = (matter(fs.readFileSync(path.join(root, 'wiki/sources/src-job-postings.md'), 'utf8')).data as { sources: string[] }).sources;
    const expected = sources.map((s) => (matter(fs.readFileSync(path.join(root, s), 'utf8')).data as { source: string }).source);
    const urls = await rows.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(urls).toEqual(expected);
    // Chips follow the org-title rule: skill 6 -> OpenAI, Anthropic, Decagon.
    const card6 = page.getByTestId('skill-card').nth(5);
    await expect(card6.getByTestId('skill-chip')).toHaveText(['OpenAI', 'Anthropic', 'Decagon']);
    await expect(page.getByTestId('skill-card').nth(2).getByTestId('skill-chip')).toHaveCount(0);
  });

  test('both wiki pages behind the dashboards also render', async ({ request }) => {
    expect((await request.get('/wiki/harness-reading-order')).status()).toBe(200);
    expect((await request.get('/wiki/harness-job-requirements')).status()).toBe(200);
  });
});

test.describe('theme and responsive', () => {
  test('dark mode toggles, persists across reload, and is applied before hydration', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    const wasDark = await html.evaluate((e) => e.classList.contains('dark'));
    await page.getByTestId('theme-toggle').click();
    await expect.poll(() => html.evaluate((e) => e.classList.contains('dark'))).toBe(!wasDark);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(await html.evaluate((e) => e.classList.contains('dark'))).toBe(!wasDark);
    await page.getByTestId('theme-toggle').click();
    await expect.poll(() => html.evaluate((e) => e.classList.contains('dark'))).toBe(wasDark);
  });

  test('no horizontal overflow on key pages; drawer, search and graph usable on mobile', async ({ page }, info) => {
    for (const p of ['/', '/wiki/src-job-postings', '/wiki/harness-job-requirements', '/skills', '/path', '/graph', '/search', '/log']) {
      await page.goto(p);
      await noHorizontalOverflow(page);
    }
    if (info.project.name !== 'mobile') return;
    await page.goto('/');
    await page.getByTestId('drawer-toggle').click();
    await expect(page.getByTestId('drawer')).toBeVisible();
    await page.getByTestId('drawer').getByRole('link', { name: 'Agent harness' }).click();
    await expect(page).toHaveURL(/\/wiki\/agent-harness$/);
    await expect(page.getByTestId('drawer')).toHaveCount(0);
    await page.goto('/search');
    await page.getByTestId('search-input').fill('compaction');
    await expect(page.locator('[data-testid=search-results] li').first()).toBeVisible();
    await page.goto('/graph');
    await expect(page.getByTestId('graph-node')).toHaveCount(39);
  });
});

test.describe('shell @gateT', () => {
  test('header links expose the current page and ignore a same-page click; search ignores empty and repeated queries', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'desktop header nav');
    await page.goto('/graph');
    const nav = page.getByRole('navigation', { name: '주요 메뉴' });
    await expect(nav.getByRole('link', { name: '그래프' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: '검색' })).not.toHaveAttribute('aria-current', 'page');
    await nav.getByRole('link', { name: '그래프' }).click();
    await expect(page).toHaveURL(/\/graph$/);
    await page.goto('/search?q=compaction');
    const box = page.getByRole('searchbox', { name: '위키 검색' });
    await box.fill('compaction');
    await box.press('Enter');
    await expect(page).toHaveURL(/\/search\?q=compaction$/);
    await box.fill('   ');
    await box.press('Enter');
    await expect(page).toHaveURL(/\/search\?q=compaction$/);
  });

  test('sidebar and drawer titles are "English (한글)" and the active page is highlighted', async ({ page }, info) => {
    await page.goto('/wiki/agent-harness');
    const scope = info.project.name === 'mobile' ? (await page.getByTestId('drawer-toggle').click(), page.getByTestId('drawer')) : page.locator('#sidebar');
    const links = scope.locator('nav[aria-label="문서 목록"] a');
    await expect(links).toHaveCount(39);
    const texts = await links.allTextContents();
    for (const t of texts) expect(t).toMatch(/^.+ \(.+\)$/);
    await expect(scope.getByRole('link', { name: 'Agent harness (에이전트 하네스)' })).toHaveAttribute('aria-current', 'page');
    // Other surfaces keep the plain frontmatter title.
    await expect(page.locator('main h1').first()).toHaveText('Agent harness');
  });

  test('desktop sidebar toggle hides, shows, persists, and keeps keyboard focus', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'desktop only');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/wiki/agent-harness');
    const toggle = page.getByTestId('sidebar-toggle');
    const aside = page.locator('#sidebar');
    const main = page.locator('#main-content');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toHaveAttribute('aria-label', '문서 목록 숨기기');
    expect((await page.locator('header').first().boundingBox())?.height).toBeCloseTo(49, 0);
    const before = (await main.boundingBox())!.width;
    await toggle.click();
    await expect(aside).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveAttribute('aria-label', '문서 목록 보기');
    expect((await main.boundingBox())!.width).toBeGreaterThanOrEqual(before + 200);
    await noHorizontalOverflow(page);
    await page.goto('/wiki/agent-harness', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-sidebar', 'collapsed');
    await expect(aside).toBeHidden();
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(aside).toBeVisible();
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Space');
    await expect(aside).toBeHidden();
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(aside.locator('a[aria-current=page]')).toHaveText('Agent harness (에이전트 하네스)');
  });

  test('mobile ignores the saved sidebar state and hides the desktop toggle', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'mobile only');
    await page.addInitScript(() => localStorage.setItem('sidebar-collapsed', '1'));
    await page.goto('/');
    await expect(page.getByTestId('sidebar-toggle')).toBeHidden();
    await page.getByTestId('drawer-toggle').click();
    await expect(page.getByTestId('drawer').locator('nav[aria-label="문서 목록"] a').first()).toBeVisible();
    await noHorizontalOverflow(page);
  });

  test('the shell has no max width: main grows with the viewport, aside keeps its natural width', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'desktop widths');
    const widths: number[] = [];
    for (const w of [1280, 1920, 2560]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto('/wiki/agent-harness');
      const main = (await page.locator('#main-content').boundingBox())!.width;
      const aside = (await page.locator('#sidebar').boundingBox())!.width;
      expect(Math.abs(aside - 256)).toBeLessThanOrEqual(1);
      expect(main).toBeGreaterThanOrEqual(w - aside - 80);
      widths.push(main);
      await noHorizontalOverflow(page);
      const tracks = await page.locator('#site-layout').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
      expect(tracks).toBe(2);
    }
    expect(widths[1]).toBeGreaterThan(widths[0]);
    expect(widths[2]).toBeGreaterThan(widths[1]);
    await page.getByTestId('sidebar-toggle').click();
    const tracks = await page.locator('#site-layout').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
    expect(tracks).toBe(1);
  });

  test('theme toggle: visible text is the name, focus ring is visible, state in aria-pressed, background changes', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByTestId('theme-toggle');
    await expect(toggle).toHaveText('다크 모드');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    const bg = () => page.locator('#site-layout').locator('xpath=..').evaluate((e) => getComputedStyle(e).backgroundColor);
    const light = await bg();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(await bg()).not.toBe(light);
    await toggle.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    const outline = await toggle.evaluate((e) => parseFloat(getComputedStyle(e).outlineWidth));
    expect(outline).toBeGreaterThanOrEqual(2);
  });
});

test.describe('owner-only Q&A shell (S2)', () => {
  test('/ask answers 200, says Q&A is disabled without configuration, and the header has the 질문 link', async ({ page }, info) => {
    const res = await page.goto('/ask');
    expect(res?.status()).toBe(200);
    await expect(page.getByText('Q&A 비활성')).toBeVisible();
    if (info.project.name !== 'mobile') await expect(page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '질문' })).toHaveAttribute('aria-current', 'page');
  });

  test('the auth route only exposes the allowlist: forged-account endpoints are 404 and unconfigured auth is 503', async ({ request }) => {
    for (const p of ['update-user', 'sign-up/email', 'sign-in/email', 'link-social', 'change-email', 'delete-user']) {
      expect((await request.post(`/api/auth/${p}`, { data: { githubId: '1' } })).status(), p).toBe(404);
    }
    expect((await request.get('/api/auth/get-session')).status()).toBe(503);
  });
});
