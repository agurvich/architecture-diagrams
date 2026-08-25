import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('loads the seeded demo diagram', async ({ page }) => {
  await expect(page.locator('.toolbar__stats')).toHaveText('12 nodes · 24 edges · 3 lenses');
  await expect(page.locator('.graph-node', { hasText: 'User' })).toBeVisible();
  await expect(page.locator('.graph-node', { hasText: 'Canvas' })).toBeVisible();
  // Canvas starts collapsed, carrying its two children
  await expect(page.locator('.graph-node', { hasText: 'Canvas' })).toContainText('2 nodes');
});

test('adding a node creates it, selects it, and supports color/icon/rename', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add node' }).click();

  await expect(page.locator('.toolbar__stats')).toHaveText('13 nodes · 24 edges · 3 lenses');
  const newNode = page.locator('.graph-node', { hasText: 'New node' });
  await expect(newNode).toBeVisible();

  const panel = page.locator('.properties-panel');
  await expect(panel.getByLabel('Label')).toHaveValue('New node');

  await panel.getByLabel('Label').fill('Redis Cache');
  await expect(page.locator('.graph-node', { hasText: 'Redis Cache' })).toBeVisible();

  await panel.getByTitle('Cache').click();
  await expect(page.locator('.graph-node', { hasText: 'Redis Cache' }).locator('.graph-node__icon')).toBeVisible();

  await panel.locator('input[type="color"]').fill('#e0475a');
  await expect(page.locator('.graph-node', { hasText: 'Redis Cache' })).toHaveCSS('border-left-color', 'rgb(224, 71, 90)');
});

test('right-clicking empty canvas opens a menu to add a node at that position', async ({ page }) => {
  const pane = page.locator('.react-flow__pane');
  const box = (await pane.boundingBox())!;
  const clickPoint = { x: box.x + box.width * 0.75, y: box.y + box.height * 0.8 };

  await page.mouse.click(clickPoint.x, clickPoint.y, { button: 'right' });
  const menu = page.getByText('Add node', { exact: true });
  await expect(menu).toBeVisible();
  await menu.click();

  await expect(page.locator('.toolbar__stats')).toHaveText('13 nodes · 24 edges · 3 lenses');
  const newNode = page.locator('.graph-node', { hasText: 'New node' });
  await expect(newNode).toBeVisible();

  // Created roughly where the right-click happened, not at some fixed spot.
  const nodeBox = (await newNode.boundingBox())!;
  const nodeCenter = { x: nodeBox.x + nodeBox.width / 2, y: nodeBox.y + nodeBox.height / 2 };
  expect(Math.abs(nodeCenter.x - clickPoint.x)).toBeLessThan(60);
  expect(Math.abs(nodeCenter.y - clickPoint.y)).toBeLessThan(60);

  // The new node should also already be selected.
  await expect(page.locator('.properties-panel').getByLabel('Label')).toHaveValue('New node');
});

test('right-clicking a node opens its own menu, not the empty-canvas one', async ({ page }) => {
  await page.locator('.graph-node', { hasText: 'User' }).click({ button: 'right' });

  await expect(page.getByRole('menuitem', { name: 'Edit properties…' })).toBeVisible();
  await expect(page.getByText('Add node', { exact: true })).toHaveCount(0);
});

async function totalMergedEdgeCount(page: import('@playwright/test').Page) {
  const texts = await page.locator('.graph-edge__count-badge').allTextContents();
  return texts.reduce((sum, t) => sum + Number(t), 0);
}

test('toggling a lens off reduces merged edge counts without touching raw node/edge totals', async ({ page }) => {
  // At this diagram's topology every node pair with a Data Flow edge also
  // carries a Structure edge between the same two nodes, so no line
  // disappears entirely from just turning Data Flow off — instead each
  // merged edge's underlying count should drop.
  const mergedCountBefore = await totalMergedEdgeCount(page);

  await page.getByRole('checkbox', { name: 'Data Flow' }).uncheck();

  await expect(page.locator('.toolbar__stats')).toHaveText('12 nodes · 24 edges · 3 lenses'); // raw counts unchanged
  await expect.poll(() => totalMergedEdgeCount(page)).toBeLessThan(mergedCountBefore);

  await page.getByRole('checkbox', { name: 'Data Flow' }).check();
  await expect.poll(() => totalMergedEdgeCount(page)).toBe(mergedCountBefore);
});

test('turning off every lens leaves nodes visible with zero edges', async ({ page }) => {
  await page.getByRole('checkbox', { name: 'Structure' }).uncheck();
  await page.getByRole('checkbox', { name: 'Data Flow' }).uncheck();
  await page.getByRole('checkbox', { name: 'Persistence' }).uncheck();

  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  await expect(page.locator('.graph-node', { hasText: 'User' })).toBeVisible();
});

test('expanding a collapsed group reveals its children and merged edges split back out', async ({ page }) => {
  const canvasGroup = page.locator('.graph-node--collapsed-group', { hasText: 'Canvas' });
  await expect(canvasGroup).toBeVisible();

  await canvasGroup.locator('.graph-node__chevron').click();

  await expect(page.locator('.graph-node', { hasText: 'Node Renderer' })).toBeVisible();
  await expect(page.locator('.graph-node', { hasText: 'Edge Renderer' })).toBeVisible();
  await expect(page.locator('.graph-node--collapsed-group', { hasText: 'Canvas' })).toHaveCount(0);
});

test('hovering a node highlights its neighbors and dims everything else', async ({ page }) => {
  const userNode = page.locator('.graph-node', { hasText: 'User' });
  const toolbarNode = page.locator('.graph-node', { hasText: 'Toolbar' });
  const storeNode = page.locator('.graph-node', { hasText: 'Diagram Store' });

  await userNode.hover();

  await expect(userNode).toHaveClass(/graph-node--highlighted/);
  await expect(toolbarNode).toHaveClass(/graph-node--highlighted/);
  await expect(storeNode).toHaveClass(/graph-node--dimmed/);
});

test('frame player steps forward and back through the narrated sequence', async ({ page }) => {
  const next = page.getByRole('button', { name: 'Next ▶' });
  const prev = page.getByRole('button', { name: '◀ Prev' });
  const title = page.locator('.frame-player__title');

  await expect(title).toContainText('Not viewing a frame');
  await expect(prev).toBeDisabled();

  await next.click();
  await expect(title).toContainText('1. Component architecture');
  await expect(title).toContainText('1 / 4');

  await next.click();
  await expect(title).toContainText('2. Inside the UI layer');
  // frame 2 expands Canvas (and Panels) and highlights their children
  await expect(page.locator('.graph-node', { hasText: 'Node Renderer' })).toBeVisible();

  await prev.click();
  await expect(title).toContainText('1. Component architecture');
});

test('dragging a node tracks the cursor live instead of jumping only on release', async ({ page }) => {
  const node = page.locator('[data-id="user"]');
  const startBox = (await node.boundingBox())!;
  const startCenter = { x: startBox.x + startBox.width / 2, y: startBox.y + startBox.height / 2 };
  const dx = 0;
  const dy = 220;

  await page.mouse.move(startCenter.x, startCenter.y);
  await page.mouse.down();
  await page.waitForTimeout(50);
  // Move halfway, in several small steps so real mousemove events fire along the way.
  await page.mouse.move(startCenter.x + dx / 2, startCenter.y + dy / 2, { steps: 10 });
  await page.waitForTimeout(50);

  const midBox = (await node.boundingBox())!;
  // The node must have already moved partway — not still sitting at its
  // start position waiting for mouseup to "teleport" it.
  expect(midBox.y).toBeGreaterThan(startBox.y + dy / 4);
  expect(midBox.y).toBeLessThan(startBox.y + (dy * 3) / 4);

  await page.mouse.move(startCenter.x + dx, startCenter.y + dy, { steps: 10 });
  await page.waitForTimeout(50);
  await page.mouse.up();

  const endBox = (await node.boundingBox())!;
  expect(Math.abs(endBox.y - (startBox.y + dy))).toBeLessThan(20);

  // Confirm the drop position — not some intermediate one — was what got
  // persisted. Reading localStorage directly (rather than comparing
  // on-screen boxes post-reload) sidesteps fitView re-centering the
  // viewport differently now that this node's position has changed.
  await expect
    .poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('architecture-diagrams:working-diagram'));
      const diagram = raw ? JSON.parse(raw) : null;
      return diagram?.nodes.find((n: { id: string }) => n.id === 'user')?.position.y;
    })
    .toBeGreaterThan(dy - 20);
});

test('dragging from a handle to another node opens the tagging popover and creates an edge', async ({ page }) => {
  const source = page.locator('[data-id="user"] .react-flow__handle-right');
  const target = page.locator('[data-id="engine"] .react-flow__handle-left');

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

  await popover.getByRole('checkbox', { name: 'Persistence' }).check();
  await popover.getByRole('button', { name: 'Add edge' }).click();

  await expect(popover).toHaveCount(0);
  await expect(page.locator('.react-flow__edge')).toHaveCount(edgeCountBefore + 1);
  await expect(page.locator('.toolbar__stats')).toHaveText('12 nodes · 25 edges · 3 lenses');
});
