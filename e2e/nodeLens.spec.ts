import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

// Reads a currently-visible React Flow node's own translate(x, y) transform
// straight off the DOM — the same coordinate space engine/nodeLens.ts
// computes region-column positions in, and far more robust than deriving
// screen pixels through pan/zoom.
async function nodeTransform(page: import('@playwright/test').Page, id: string) {
  return page.evaluate((nodeId) => {
    const el = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${nodeId}"]`);
    if (!el) return null;
    const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.style.transform);
    return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
  }, id);
}

test('the node-lens picker offers every metadata key in use', async ({ page }) => {
  const select = page.getByTitle('Group nodes into regions by a metadata key');
  await expect(select).toBeVisible();
  const options = await select.locator('option').allTextContents();
  expect(options).toContain('permissionScope');
  expect(options).toContain('type');
});

test('grouping by permissionScope pulls IAM roles from two different AWS accounts into one shared region', async ({ page }) => {
  await page.locator('.graph-node--collapsed-group', { hasText: 'Acquisition Account' }).locator('.graph-node__chevron').click();
  await page.locator('.graph-node--collapsed-group', { hasText: 'Viz Tools Account' }).locator('.graph-node__chevron').click();

  await page.getByTitle('Group nodes into regions by a metadata key').selectOption('permissionScope');

  const [processing, ingest, internetRole, stepfnRole, avscanRole, viztoolsRole, source] = await Promise.all(
    ['account-processing', 'account-ingest', 'internet-role', 'stepfn-role', 'avscan-role', 'viztools-role', 'source'].map(
      (id) => nodeTransform(page, id),
    ),
  );

  // Three different structural parents (Acquisition Account, Viz Tools
  // Account, and — via the four IAM roles — nowhere in particular) end up
  // at three distinct x columns.
  expect(processing!.x).not.toBe(ingest!.x);
  expect(processing!.x).not.toBe(source!.x);
  expect(ingest!.x).not.toBe(source!.x);

  // All four IAM roles — three structurally nested under Acquisition
  // Account, one under the entirely separate Viz Tools Account — converge
  // on the exact same column, distinct from either account's own column.
  const roleXs = new Set([internetRole!.x, stepfnRole!.x, avscanRole!.x, viztoolsRole!.x]);
  expect(roleXs.size).toBe(1);
  const roleX = [...roleXs][0];
  expect(roleX).not.toBe(processing!.x);
  expect(roleX).not.toBe(ingest!.x);

  // Stacked vertically within that shared column, not on top of each other.
  const roleYs = new Set([internetRole!.y, stepfnRole!.y, avscanRole!.y, viztoolsRole!.y]);
  expect(roleYs.size).toBe(4);
});

test('region header labels name every group, "Unclassified" last', async ({ page }) => {
  await page.getByTitle('Group nodes into regions by a metadata key').selectOption('permissionScope');
  await expect(page.getByText('acquisition-account', { exact: true })).toBeVisible();
  await expect(page.getByText('viztools-account', { exact: true })).toBeVisible();
  await expect(page.getByText('Unclassified', { exact: true })).toBeVisible();
  // iam-security only appears once its member nodes are actually visible —
  // both accounts start collapsed, so nothing has broken out of them yet.
  await expect(page.getByText('iam-security', { exact: true })).toHaveCount(0);
});

test('expanding an account reveals its extracted IAM role and an "iam-security" region appears', async ({ page }) => {
  await page.getByTitle('Group nodes into regions by a metadata key').selectOption('permissionScope');
  await expect(page.getByText('iam-security', { exact: true })).toHaveCount(0);

  await page.locator('.graph-node--collapsed-group', { hasText: 'Acquisition Account' }).locator('.graph-node__chevron').click();

  await expect(page.getByText('iam-security', { exact: true })).toBeVisible();
  await expect(page.locator('.graph-node', { hasText: 'AV Scan Role' })).toBeVisible();
});

test('a collapsed account with an extracted IAM role shows a dashed border and a fraction badge instead of a plain count', async ({ page }) => {
  const account = page.locator('.graph-node--collapsed-group', { hasText: 'Acquisition Account' });
  await expect(account.locator('.graph-node__badge')).toHaveText('20 nodes');
  await expect(account).not.toHaveClass(/border-dashed/);

  await page.getByTitle('Group nodes into regions by a metadata key').selectOption('permissionScope');

  await expect(account.locator('.graph-node__badge')).toHaveText('17/20');
  await expect(account).toHaveClass(/border-dashed/);
});

test('the unclassified bundle (no tagged ancestor at all) is dimmed', async ({ page }) => {
  const source = page.locator('.graph-node--collapsed-group', { hasText: 'USASpending.gov' });
  await expect(source).not.toHaveClass(/graph-node--dimmed/);

  await page.getByTitle('Group nodes into regions by a metadata key').selectOption('permissionScope');

  await expect(source).toHaveClass(/graph-node--dimmed/);
});

test('turning the lens back off restores the normal nested layout and plain counts', async ({ page }) => {
  const account = page.locator('.graph-node--collapsed-group', { hasText: 'Acquisition Account' });
  const before = await nodeTransform(page, 'account-processing');

  const select = page.getByTitle('Group nodes into regions by a metadata key');
  await select.selectOption('permissionScope');
  await expect(account.locator('.graph-node__badge')).toHaveText('17/20');

  await select.selectOption('');

  await expect(account.locator('.graph-node__badge')).toHaveText('20 nodes');
  await expect(account).not.toHaveClass(/border-dashed/);
  const after = await nodeTransform(page, 'account-processing');
  expect(after).toEqual(before);
});

test('a lens-detached bundle root cannot be dragged (its position is a computed slot, not draggable state)', async ({ page }) => {
  // Regression: onNodeDrag writes the live drag position straight into the
  // diagram's stored position (see useNodeDragAndReparent.ts). For a
  // lens-detached node — parentId cleared for rendering, but its true
  // stored parentId is still whatever it always was — that write would
  // land in the wrong coordinate space the instant the lens turns back
  // off. The fix is disabling drag entirely for a lens-detached node
  // (EffectiveNode.lensDetached), not just relying on the render snapping
  // back — this confirms no mutation happens at all, not merely that the
  // node "looks" unmoved.
  await page.locator('.graph-node--collapsed-group', { hasText: 'Acquisition Account' }).locator('.graph-node__chevron').click();
  await page.getByTitle('Group nodes into regions by a metadata key').selectOption('permissionScope');

  const role = page.locator('[data-id="internet-role"]');
  const before = await nodeTransform(page, 'internet-role');
  const box = (await role.boundingBox())!;

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, box.y + 100, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  expect(await nodeTransform(page, 'internet-role')).toEqual(before);
  const raw = await page.evaluate(() => localStorage.getItem('architecture-diagrams:working-diagram'));
  expect(raw).toBeNull(); // no mutation at all, not even a silently-wrong one
});

test('a saved frame remembers the active node lens and restores it on playback', async ({ page }) => {
  await page.getByTitle('Group nodes into regions by a metadata key').selectOption('permissionScope');

  await page.getByPlaceholder('New frame name').fill('Permission boundaries');
  await page.getByRole('button', { name: 'Capture current state' }).click();

  const select = page.getByTitle('Group nodes into regions by a metadata key');
  await select.selectOption('');
  await expect(select).toHaveValue('');

  // saveFrame appends to the end of the list, after the four seed frames —
  // the last "Go to this frame" button is always the one just captured.
  await page.getByTitle('Go to this frame').last().click();

  await expect(select).toHaveValue('permissionScope');
});
