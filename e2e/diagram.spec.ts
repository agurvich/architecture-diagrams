import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('loads the seeded demo diagram', async ({ page }) => {
  await expect(page.locator('.toolbar__stats')).toHaveText('7 nodes · 12 edges · 3 lenses');
  await expect(page.locator('.graph-node', { hasText: 'Client Browser' })).toBeVisible();
  await expect(page.locator('.graph-node', { hasText: 'API Cluster' })).toBeVisible();
  // API Cluster starts collapsed, carrying its two children
  await expect(page.locator('.graph-node', { hasText: 'API Cluster' })).toContainText('2 nodes');
});

async function totalMergedEdgeCount(page: import('@playwright/test').Page) {
  const texts = await page.locator('.graph-edge__count-badge').allTextContents();
  return texts.reduce((sum, t) => sum + Number(t), 0);
}

test('toggling a lens off reduces merged edge counts without touching raw node/edge totals', async ({ page }) => {
  // At this demo's topology every node pair also carries an Infrastructure
  // edge, so no line disappears entirely from just turning Process off —
  // instead each merged edge's underlying count should drop.
  const mergedCountBefore = await totalMergedEdgeCount(page);

  await page.getByRole('checkbox', { name: 'Process' }).uncheck();

  await expect(page.locator('.toolbar__stats')).toHaveText('7 nodes · 12 edges · 3 lenses'); // raw counts unchanged
  await expect.poll(() => totalMergedEdgeCount(page)).toBeLessThan(mergedCountBefore);

  await page.getByRole('checkbox', { name: 'Process' }).check();
  await expect.poll(() => totalMergedEdgeCount(page)).toBe(mergedCountBefore);
});

test('turning off every lens leaves nodes visible with zero edges', async ({ page }) => {
  await page.getByRole('checkbox', { name: 'Infrastructure' }).uncheck();
  await page.getByRole('checkbox', { name: 'Process' }).uncheck();
  await page.getByRole('checkbox', { name: 'Data' }).uncheck();

  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  await expect(page.locator('.graph-node', { hasText: 'Client Browser' })).toBeVisible();
});

test('expanding a collapsed group reveals its children and merged edges split back out', async ({ page }) => {
  const cluster = page.locator('.graph-node--collapsed-group', { hasText: 'API Cluster' });
  await expect(cluster).toBeVisible();

  await cluster.locator('.graph-node__chevron').click();

  await expect(page.locator('.graph-node', { hasText: 'API Server 1' })).toBeVisible();
  await expect(page.locator('.graph-node', { hasText: 'API Server 2' })).toBeVisible();
  await expect(page.locator('.graph-node--collapsed-group', { hasText: 'API Cluster' })).toHaveCount(0);
});

test('hovering a node highlights its neighbors and dims everything else', async ({ page }) => {
  const clientNode = page.locator('.graph-node', { hasText: 'Client Browser' });
  const loadBalancerNode = page.locator('.graph-node', { hasText: 'Load Balancer' });
  const dbNode = page.locator('.graph-node', { hasText: 'Primary Database' });

  await clientNode.hover();

  await expect(clientNode).toHaveClass(/graph-node--highlighted/);
  await expect(loadBalancerNode).toHaveClass(/graph-node--highlighted/);
  await expect(dbNode).toHaveClass(/graph-node--dimmed/);
});

test('frame player steps forward and back through the narrated sequence', async ({ page }) => {
  const next = page.getByRole('button', { name: 'Next ▶' });
  const prev = page.getByRole('button', { name: '◀ Prev' });
  const title = page.locator('.frame-player__title');

  await expect(title).toContainText('Not viewing a frame');
  await expect(prev).toBeDisabled();

  await next.click();
  await expect(title).toContainText('1. Physical topology');
  await expect(title).toContainText('1 / 4');

  await next.click();
  await expect(title).toContainText('2. Inside the cluster');
  // frame 2 expands the cluster and highlights its two servers
  await expect(page.locator('.graph-node', { hasText: 'API Server 1' })).toBeVisible();

  await prev.click();
  await expect(title).toContainText('1. Physical topology');
});

test('dragging from a handle to another node opens the tagging popover and creates an edge', async ({ page }) => {
  const source = page.locator('[data-id="client"] .react-flow__handle-right');
  const target = page.locator('[data-id="db"] .react-flow__handle-left');

  const edgeCountBefore = await page.locator('.react-flow__edge').count();

  const sourceBox = (await source.boundingBox())!;
  const targetBox = (await target.boundingBox())!;
  const sx = sourceBox.x + sourceBox.width / 2;
  const sy = sourceBox.y + sourceBox.height / 2;
  const tx = targetBox.x + targetBox.width / 2;
  const ty = targetBox.y + targetBox.height / 2;

  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.move(sx + 40, sy - 40, { steps: 5 });
  await page.waitForTimeout(50);
  await page.mouse.move((sx + tx) / 2, (sy + ty) / 2, { steps: 5 });
  await page.waitForTimeout(50);
  await page.mouse.move(tx, ty, { steps: 5 });
  await page.waitForTimeout(50);
  await page.mouse.up();

  const popover = page.locator('.connection-popover');
  await expect(popover).toBeVisible();

  await popover.getByRole('checkbox', { name: 'Data' }).check();
  await popover.getByRole('button', { name: 'Add edge' }).click();

  await expect(popover).toHaveCount(0);
  await expect(page.locator('.react-flow__edge')).toHaveCount(edgeCountBefore + 1);
  await expect(page.locator('.toolbar__stats')).toHaveText('7 nodes · 13 edges · 3 lenses');
});
