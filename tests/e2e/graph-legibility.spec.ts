import { expect, test, type Page } from '@playwright/test';

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

async function openGraph(page: Page) {
  await page.goto('/graph');
  await expect(page.getByTestId('graph-node').first()).toBeAttached();
  await page.waitForTimeout(1500);
}

async function svgRect(page: Page): Promise<Rect> {
  return page.getByTestId('graph-svg').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  });
}

async function dotRects(page: Page): Promise<Rect[]> {
  return page.locator('[data-testid=graph-node] circle[data-role=dot]').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }),
  );
}

function expectInside(rects: Rect[], box: Rect) {
  expect(rects.length).toBeGreaterThan(0);
  for (const r of rects) {
    expect(r.left).toBeGreaterThanOrEqual(box.left - 1);
    expect(r.top).toBeGreaterThanOrEqual(box.top - 1);
    expect(r.right).toBeLessThanOrEqual(box.right + 1);
    expect(r.bottom).toBeLessThanOrEqual(box.bottom + 1);
  }
}

test.describe('graph legibility (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('nodes inside svg, spaced apart, labels do not overlap', async ({ page }) => {
    await openGraph(page);
    const box = await svgRect(page);
    const dots = await dotRects(page);
    expectInside(dots, box);

    const centers = dots.map((r) => ({ x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 }));
    let min = Infinity;
    for (let i = 0; i < centers.length; i++) {
      for (let j = i + 1; j < centers.length; j++) min = Math.min(min, Math.hypot(centers[i].x - centers[j].x, centers[i].y - centers[j].y));
    }
    expect(min).toBeGreaterThanOrEqual(14);

    const labels = await page.locator('[data-testid=graph-svg] text').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      }),
    );
    expect(labels.length).toBeGreaterThan(0);
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i];
        const b = labels[j];
        const overlap = a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
        expect(overlap, `labels ${i} and ${j} overlap`).toBe(false);
      }
    }
  });

  test('hovering a node dims non-neighbors', async ({ page }) => {
    await openGraph(page);
    const node = page.locator('[data-testid=graph-node]:not([data-node=index])').first();
    await node.hover();
    await expect
      .poll(async () => {
        const ops = await page.getByTestId('graph-node').evaluateAll((els) => els.map((el) => Number(getComputedStyle(el).opacity)));
        return { dimmed: ops.some((o) => o < 0.5), lit: ops.some((o) => o >= 0.99) };
      })
      .toEqual({ dimmed: true, lit: true });
  });

  test('fit button restores view after zoom', async ({ page }) => {
    await openGraph(page);
    const box = await svgRect(page);
    await page.mouse.move((box.left + box.right) / 2, (box.top + box.bottom) / 2);
    await page.mouse.wheel(0, -1500);
    await page.waitForTimeout(300);
    const zoomed = await dotRects(page);
    const outside = zoomed.some((r) => r.left < box.left || r.top < box.top || r.right > box.right || r.bottom > box.bottom);
    expect(outside).toBe(true);
    await page.getByRole('button', { name: '화면에 맞추기' }).click();
    await page.waitForTimeout(300);
    expectInside(await dotRects(page), box);
  });

  test('type filter chip hides nodes of that type', async ({ page }) => {
    await openGraph(page);
    const total = await page.getByTestId('graph-node').count();
    const chip = page.getByRole('button', { name: '개념' });
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-testid=graph-node][data-type=concept]')).toHaveCount(0);
    expect(await page.getByTestId('graph-node').count()).toBeLessThan(total);
    await chip.click();
    await expect(page.getByTestId('graph-node')).toHaveCount(total);
  });
});

test.describe('graph legibility (mobile)', () => {
  test.use({ viewport: { width: 375, height: 700 } });

  test('no horizontal overflow and nodes inside svg', async ({ page }) => {
    await openGraph(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expectInside(await dotRects(page), await svgRect(page));
  });
});
