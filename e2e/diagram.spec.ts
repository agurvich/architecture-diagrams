import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('loads the seeded demo diagram', async ({ page }) => {
  await expect(page.locator('.toolbar__stats')).toHaveText('29 nodes · 24 edges · 2 lenses');
  await expect(page.locator('.graph-node', { hasText: 'USASpending.gov' })).toBeVisible();
  await expect(page.locator('.graph-node', { hasText: 'Acquisition Account' })).toBeVisible();
  // Everything starts collapsed, carrying its full descendant count.
  await expect(page.locator('.graph-node', { hasText: 'Acquisition Account' })).toContainText('20 nodes');
});

test('adding a node creates it, selects it, and supports color/icon/rename', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add node' }).click();

  await expect(page.locator('.toolbar__stats')).toHaveText('30 nodes · 24 edges · 2 lenses');
  const newNode = page.locator('.graph-node', { hasText: 'New node' });
  await expect(newNode).toBeVisible();

  const panel = page.locator('.properties-panel');
  await expect(panel.getByLabel('Label')).toHaveValue('New node');

  await panel.getByLabel('Label').fill('Redis Cache');
  await expect(page.locator('.graph-node', { hasText: 'Redis Cache' })).toBeVisible();

  await panel.getByTitle('Cache').click();
  await expect(page.locator('.graph-node', { hasText: 'Redis Cache' }).locator('.graph-node__icon')).toBeVisible();

  await panel.locator('input[type="color"]').fill('#e0475a');
  await expect(
    page.locator('.graph-node', { hasText: 'Redis Cache' }).locator('.graph-node__icon-bar'),
  ).toHaveCSS('background-color', 'rgb(224, 71, 90)');
});

test('right-clicking empty canvas opens a menu to add a node at that position', async ({ page }) => {
  const pane = page.locator('.react-flow__pane');
  const box = (await pane.boundingBox())!;
  const clickPoint = { x: box.x + box.width * 0.75, y: box.y + box.height * 0.8 };

  await page.mouse.click(clickPoint.x, clickPoint.y, { button: 'right' });
  const menu = page.getByText('Add node', { exact: true });
  await expect(menu).toBeVisible();
  await menu.click();

  await expect(page.locator('.toolbar__stats')).toHaveText('30 nodes · 24 edges · 2 lenses');
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
  await page.locator('.graph-node', { hasText: 'USASpending.gov' }).click({ button: 'right' });

  await expect(page.getByRole('menuitem', { name: 'Edit properties…' })).toBeVisible();
  await expect(page.getByText('Add node', { exact: true })).toHaveCount(0);
});

test('toggling a lens off reduces the edges actually drawn, and back on restores them', async ({ page }) => {
  const edgeCountBefore = await page.locator('.react-flow__edge').count();
  expect(edgeCountBefore).toBeGreaterThan(0);

  await page.getByRole('checkbox', { name: 'Data Flow' }).uncheck();

  await expect(page.locator('.toolbar__stats')).toHaveText('29 nodes · 24 edges · 2 lenses'); // raw counts unchanged
  await expect(page.locator('.react-flow__edge')).not.toHaveCount(edgeCountBefore);

  await page.getByRole('checkbox', { name: 'Data Flow' }).check();
  await expect(page.locator('.react-flow__edge')).toHaveCount(edgeCountBefore);
});

test('turning off every lens leaves nodes visible with zero edges', async ({ page }) => {
  await page.getByRole('checkbox', { name: 'Control Flow' }).uncheck();
  await page.getByRole('checkbox', { name: 'Data Flow' }).uncheck();

  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  await expect(page.locator('.graph-node', { hasText: 'USASpending.gov' })).toBeVisible();
});

test('expanding a collapsed group reveals its children and merged edges split back out', async ({ page }) => {
  const sourceGroup = page.locator('.graph-node--collapsed-group', { hasText: 'USASpending.gov' });
  await expect(sourceGroup).toBeVisible();

  await sourceGroup.locator('.graph-node__chevron').click();

  await expect(page.locator('.graph-node', { hasText: 'list_files' })).toBeVisible();
  await expect(page.locator('.graph-node', { hasText: 'batch_download' })).toBeVisible();
  await expect(page.locator('.graph-node--collapsed-group', { hasText: 'USASpending.gov' })).toHaveCount(0);
});

test('hovering a node highlights its neighbors and dims everything else', async ({ page }) => {
  const sourceNode = page.locator('.graph-node', { hasText: 'USASpending.gov' });
  const processingNode = page.locator('.graph-node', { hasText: 'Acquisition Account' });
  const ingestNode = page.locator('.graph-node', { hasText: 'Viz Tools Account' });

  await sourceNode.hover();

  await expect(sourceNode).toHaveClass(/graph-node--highlighted/);
  await expect(processingNode).toHaveClass(/graph-node--highlighted/);
  await expect(ingestNode).toHaveClass(/graph-node--dimmed/);
});

test('frame player steps forward and back through the narrated sequence', async ({ page }) => {
  const next = page.getByRole('button', { name: 'Next ▶' });
  const prev = page.getByRole('button', { name: '◀ Prev' });
  const title = page.locator('.frame-player__title');

  await expect(title).toContainText('Not viewing a frame');
  await expect(prev).toBeDisabled();

  await next.click();
  await expect(title).toContainText('1. Pipeline overview');
  await expect(title).toContainText('1 / 4');

  await next.click();
  await expect(title).toContainText('2. Inside the AV scan');
  // frame 2 additionally expands the AV Lambda
  await expect(page.locator('.graph-node').filter({ hasText: /^Scan$/ })).toBeVisible();

  await prev.click();
  await expect(title).toContainText('1. Pipeline overview');
});

test('dragging a node tracks the cursor live instead of jumping only on release', async ({ page }) => {
  const node = page.locator('[data-id="source"]');
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
      return diagram?.nodes.find((n: { id: string }) => n.id === 'source')?.position.y;
    })
    .toBeGreaterThan(dy - 20 + 380); // seed's starting y for 'source' is 380
});

test('dragging from a handle to another node opens the tagging popover and creates an edge', async ({ page }) => {
  // 'source' and 'account-ingest' have no existing edge between them at the
  // top level, so a plain +1 edge-count assertion is unambiguous.
  const source = page.locator('[data-id="source"] .react-flow__handle-right');
  const target = page.locator('[data-id="account-ingest"] .react-flow__handle-left');

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

  await popover.getByRole('checkbox', { name: 'Control Flow' }).check();
  await popover.getByRole('button', { name: 'Add edge' }).click();

  await expect(popover).toHaveCount(0);
  await expect(page.locator('.react-flow__edge')).toHaveCount(edgeCountBefore + 1);
  await expect(page.locator('.toolbar__stats')).toHaveText('29 nodes · 25 edges · 2 lenses');
});

// --- Regression coverage for bugs fixed this session, none of which a
// jsdom-based component/unit test can exercise: all three depend on a real
// pointer-drag gesture resolving against real, measured DOM geometry. ---

test('dragging an edge endpoint to a different handle on the SAME node updates it in place, without creating a duplicate', async ({ page }) => {
  // Expanding just these two reveals cf-watermark-list (read-watermark ->
  // list-files) as a plain, unmerged (count === 1, reconnectable) control
  // edge between two real leaf nodes.
  await page.locator('.graph-node--collapsed-group', { hasText: 'Acquisition Account' }).locator('.graph-node__chevron').click();
  await page.locator('.graph-node--collapsed-group', { hasText: 'Ingest Step Function' }).locator('.graph-node__chevron').click();

  const edgeCountBefore = await page.locator('.react-flow__edge').count();
  const sourceHandle = page.locator('[data-id="merged:read-watermark=>list-files"] circle.react-flow__edgeupdater-source');
  const handleBox = (await sourceHandle.boundingBox())!;
  const hx = handleBox.x + handleBox.width / 2;
  const hy = handleBox.y + handleBox.height / 2;

  // Drag the source anchor a short distance sideways — same node, almost
  // certainly a different resolved handle side — and drop back onto that
  // same node's own body so the reconnect resolves onto it, not elsewhere.
  const sourceNodeBox = (await page.locator('[data-id="read-watermark"]').boundingBox())!;
  const dropX = sourceNodeBox.x + sourceNodeBox.width - 4;
  const dropY = sourceNodeBox.y + sourceNodeBox.height / 2;

  await page.mouse.move(hx, hy);
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.move(dropX, dropY, { steps: 10 });
  await page.waitForTimeout(50);
  await page.mouse.up();
  await page.waitForTimeout(100);

  await expect(page.locator('.react-flow__edge')).toHaveCount(edgeCountBefore);
});

test('dragging an edge endpoint to a different node reassigns it, without creating a reversed duplicate', async ({ page }) => {
  // Expanding both accounts reveals a-clean-ingest (clean-bucket ->
  // ingest-bucket) as a plain, unmerged action edge between two real leaf
  // buckets.
  await page.locator('.graph-node--collapsed-group', { hasText: 'Acquisition Account' }).locator('.graph-node__chevron').click();
  await page.locator('.graph-node--collapsed-group', { hasText: 'Viz Tools Account' }).locator('.graph-node__chevron').click();

  const edgeCountBefore = await page.locator('.react-flow__edge').count();
  const sourceHandle = page.locator('[data-id="merged:clean-bucket=>ingest-bucket"] circle.react-flow__edgeupdater-source');
  const handleBox = (await sourceHandle.boundingBox())!;
  const hx = handleBox.x + handleBox.width / 2;
  const hy = handleBox.y + handleBox.height / 2;

  // Re-aim this edge's source (currently clean-bucket) onto the Acquisition
  // Account container itself — its own top-center handle, clear of any
  // nested child.
  const dropHandle = page.locator('[data-id="account-processing"] .react-flow__handle-top');
  const dropBox = (await dropHandle.boundingBox())!;
  const dropX = dropBox.x + dropBox.width / 2;
  const dropY = dropBox.y + dropBox.height / 2;

  await page.mouse.move(hx, hy);
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.move(dropX, dropY, { steps: 10 });
  await page.waitForTimeout(50);
  await page.mouse.up();
  await page.waitForTimeout(100);

  // No spurious second (and reversed) edge from the same gesture.
  await expect(page.locator('.react-flow__edge')).toHaveCount(edgeCountBefore);

  await expect
    .poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('architecture-diagrams:working-diagram'));
      const diagram = raw ? JSON.parse(raw) : null;
      return diagram?.edges.find((e: { id: string }) => e.id === 'a-clean-ingest')?.sourceId;
    })
    .toBe('account-processing');
});

test('dragging a node inside an auto-layout container does not move unrelated siblings elsewhere in the diagram', async ({ page }) => {
  // Turn on auto layout for the Step Function container via its own
  // context menu, then confirm dragging one of its children doesn't
  // perturb something with no relation to it (the account container
  // sitting entirely outside this subtree).
  await page.locator('.graph-node--collapsed-group', { hasText: 'Acquisition Account' }).locator('.graph-node__chevron').click();
  await page.locator('.graph-node--collapsed-group', { hasText: 'Ingest Step Function' }).locator('.graph-node__chevron').click();

  // Target the container's own collapse/expand chevron specifically — a
  // real, well-defined element inside the header strip, unlike guessing a
  // pixel offset that a nested child might occlude depending on zoom.
  await page.locator('[data-id="step-fn"] .graph-node__chevron').click({ button: 'right' });
  await page.getByText('Auto layout').hover();
  await page.getByText('Vertical', { exact: true }).click();

  const unrelatedBefore = (await page.locator('[data-id="account-ingest"]').boundingBox())!;

  const child = page.locator('[data-id="read-watermark"]');
  const childBox = (await child.boundingBox())!;
  const start = { x: childBox.x + childBox.width / 2, y: childBox.y + childBox.height / 2 };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.move(start.x, start.y + 120, { steps: 10 });
  await page.waitForTimeout(50);
  await page.mouse.up();
  await page.waitForTimeout(100);

  const unrelatedAfter = (await page.locator('[data-id="account-ingest"]').boundingBox())!;
  expect(Math.abs(unrelatedAfter.x - unrelatedBefore.x)).toBeLessThan(2);
  expect(Math.abs(unrelatedAfter.y - unrelatedBefore.y)).toBeLessThan(2);
});

test('marquee-selecting two nodes offers "Wrap in container", which nests both', async ({ page }) => {
  const source = page.locator('[data-id="source"]');
  const processing = page.locator('[data-id="account-processing"]');
  const sourceBox = (await source.boundingBox())!;
  const processingBox = (await processing.boundingBox())!;

  const minX = Math.min(sourceBox.x, processingBox.x) - 30;
  const minY = Math.min(sourceBox.y, processingBox.y) - 30;
  const maxX = Math.max(sourceBox.x + sourceBox.width, processingBox.x + processingBox.width) + 30;
  const maxY = Math.max(sourceBox.y + sourceBox.height, processingBox.y + processingBox.height) + 30;

  // Shift-drag a marquee box from empty canvas around both nodes.
  await page.keyboard.down('Shift');
  await page.mouse.move(minX, minY);
  await page.mouse.down();
  await page.mouse.move(maxX, maxY, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up('Shift');

  const wrapButton = page.getByRole('button', { name: 'Wrap in container' });
  await expect(wrapButton).toBeVisible();
  await wrapButton.click();

  await expect
    .poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('architecture-diagrams:working-diagram'));
      const diagram = raw ? JSON.parse(raw) : null;
      const src = diagram?.nodes.find((n: { id: string }) => n.id === 'source');
      const proc = diagram?.nodes.find((n: { id: string }) => n.id === 'account-processing');
      return src && proc && src.parentId && src.parentId === proc.parentId ? src.parentId : null;
    })
    .not.toBeNull();
});

test('Run graph layout repositions top-level nodes', async ({ page }) => {
  // Read straight off the rendered DOM rather than localStorage — on a
  // fresh load nothing has ever been written back yet (the store only
  // persists on a mutation), so a pre-interaction localStorage read is
  // unreliable here in a way it isn't once something has already changed.
  const ids = ['source', 'account-processing', 'account-ingest'];
  const boxesBefore = await Promise.all(ids.map((id) => page.locator(`[data-id="${id}"]`).boundingBox()));

  await page.getByRole('button', { name: 'Run graph layout' }).click();
  await page.waitForTimeout(300);

  const boxesAfter = await Promise.all(ids.map((id) => page.locator(`[data-id="${id}"]`).boundingBox()));
  expect(boxesAfter).not.toEqual(boxesBefore);
});

test('Delete removes a selected node', async ({ page }) => {
  // A fresh, unconnected leaf avoids any cascade-delete ambiguity from
  // deleting an existing seed node with children/actor-attributed edges —
  // this test is purely about the Delete key path, not cascade behavior.
  await page.getByRole('button', { name: '+ Add node' }).click();
  await expect(page.locator('.toolbar__stats')).toHaveText('30 nodes · 24 edges · 2 lenses');
  await expect(page.locator('.properties-panel').getByLabel('Label')).toHaveValue('New node');

  await page.keyboard.press('Delete');

  await expect(page.locator('.graph-node', { hasText: 'New node' })).toHaveCount(0);
  await expect(page.locator('.toolbar__stats')).toHaveText('29 nodes · 24 edges · 2 lenses');
});

test('toggling the Anchor on an action edge with a trigger still renders the trigger (regression: used to vanish)', async ({ page }) => {
  await page.locator('.graph-node--collapsed-group', { hasText: 'Acquisition Account' }).locator('.graph-node__chevron').click();
  await page.locator('.graph-node--collapsed-group', { hasText: 'Ingest Step Function' }).locator('.graph-node__chevron').click();

  // The trigger (dotted line from the process step to the actor anchor)
  // has no label of its own, so it has no clickable hit target — its
  // geometry is entirely derived from the action edge it points at
  // (a-clean-ingest, "Cross-account CopyObject"), which is what actually
  // has a clickable label. Toggling *that* edge's Anchor is what recomputes
  // the anchor's position and the trigger's path.
  const trigger = page.locator('[data-id="merged:x-account-copy=>anchor:a-clean-ingest"]');
  await expect(trigger).toHaveCount(1);

  // A nearby actor-anchor icon (an absolutely-positioned SVG sitting at
  // zIndex 1000, see useCanvasNodesAndEdges.ts) overlaps this label at
  // this zoom level, so a real screen-coordinate click resolves to the
  // icon instead. Dispatch a real bubbling click directly on the label —
  // it reaches the same React onClick handler without depending on which
  // element the browser's hit-test happens to pick at this coordinate.
  await page
    .locator('.graph-edge__label-text', { hasText: 'Cross-account CopyObject' })
    .evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })));

  const panel = page.locator('.properties-panel');
  await expect(panel.locator('h3')).toHaveText('Edge');
  const anchorSwitch = panel.getByRole('switch', { name: 'Anchor' });

  await anchorSwitch.click(); // on
  await expect(trigger.locator('.react-flow__edge-path')).toHaveCount(1);
  await expect(trigger.locator('.react-flow__edge-path')).toHaveAttribute('d', /\S/);

  await anchorSwitch.click(); // off
  await expect(trigger.locator('.react-flow__edge-path')).toHaveCount(1);
  await expect(trigger.locator('.react-flow__edge-path')).toHaveAttribute('d', /\S/);

  await anchorSwitch.click(); // on again — this is the exact bug repro
  await expect(trigger.locator('.react-flow__edge-path')).toHaveCount(1);
  await expect(trigger.locator('.react-flow__edge-path')).toHaveAttribute('d', /\S/);
});

test('clicking an actor anchor opens the properties panel for the action it sits on, not itself', async ({ page }) => {
  await page.locator('.graph-node--collapsed-group', { hasText: 'Acquisition Account' }).locator('.graph-node__chevron').click();

  const anchor = page.locator('[data-id="anchor:a-landing-unscanned"] .graph-node__anchor');
  await anchor.click();

  const panel = page.locator('.properties-panel');
  await expect(panel.locator('h3')).toHaveText('Edge');
  await expect(panel).toContainText('Landing Bucket');
  await expect(panel).toContainText('Unscanned Bucket');
});

test('hierarchy panel: dragging a row onto another row\'s middle reparents it', async ({ page }) => {
  // Expand "Acquisition Account" in the HIERARCHY list (left panel, not
  // the canvas) via its own row's chevron button.
  await page.locator('div[draggable="true"]', { hasText: 'Acquisition Account' }).locator('button').click();

  const landingRow = page.locator('div[draggable="true"]', { hasText: 'Landing Bucket' });
  const avLambdaRow = page.locator('div[draggable="true"]', { hasText: 'AV Lambda' });
  await expect(landingRow).toBeVisible();
  await expect(avLambdaRow).toBeVisible();

  await landingRow.dragTo(avLambdaRow);

  await expect
    .poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('architecture-diagrams:working-diagram'));
      const diagram = raw ? JSON.parse(raw) : null;
      return diagram?.nodes.find((n: { id: string }) => n.id === 'landing-bucket')?.parentId;
    })
    .toBe('av-lambda');
});

test('hierarchy panel context menu: Duplicate copies a node, Expand all/Collapse all recurse the subtree', async ({ page }) => {
  await page.locator('div[draggable="true"]', { hasText: 'Acquisition Account' }).locator('button').click();

  const avLambdaRow = page.locator('div[draggable="true"]', { hasText: 'AV Lambda' });
  await avLambdaRow.click({ button: 'right' });
  await page.getByText('Expand all', { exact: true }).click();

  await expect(page.locator('div[draggable="true"]', { hasText: /^Quarantine$/ })).toBeVisible();

  await avLambdaRow.click({ button: 'right' });
  await page.getByText('Collapse all', { exact: true }).click();
  await expect(page.locator('div[draggable="true"]', { hasText: /^Quarantine$/ })).toHaveCount(0);

  const landingRow = page.locator('div[draggable="true"]', { hasText: 'Landing Bucket' });
  await page.keyboard.press('Escape'); // make sure the previous context menu is fully closed first
  await landingRow.click({ button: 'right' });
  await page.getByText('Duplicate', { exact: true }).last().click();

  await expect(page.locator('.toolbar__stats')).toHaveText('30 nodes · 24 edges · 2 lenses');
  await expect(page.locator('.graph-node', { hasText: 'Landing Bucket copy' })).toBeVisible();
});

test('bulk anchor toggle: "Make curvy" applies to every selected edge at once', async ({ page }) => {
  await page.locator('.graph-node--collapsed-group', { hasText: 'Acquisition Account' }).locator('.graph-node__chevron').click();
  await page.locator('.graph-node--collapsed-group', { hasText: 'Ingest Step Function' }).locator('.graph-node__chevron').click();
  await page.locator('.graph-node--collapsed-group', { hasText: 'AV Lambda' }).locator('.graph-node__chevron').click();

  const passLabel = page.locator('.graph-edge__label-text', { hasText: 'Pass' });
  const failLabel = page.locator('.graph-edge__label-text', { hasText: 'Fail' });
  // An edge-reconnect handle circle from a nearby edge sits directly on
  // top of this label at this zoom level, so a real screen-coordinate
  // click (even with force:true, which only skips Playwright's own
  // actionability check — the browser's actual hit-test still resolves
  // to whatever's visually on top) lands on that circle instead of the
  // label underneath it. Dispatch a real bubbling click event directly on
  // the label element instead: it reaches the exact same React onClick
  // handler a real click would, without depending on which element the
  // browser's hit-test happens to pick at this coordinate.
  const shiftClick = (locator: typeof passLabel) =>
    locator.evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true, view: window })));

  // Shift-click BOTH — a plain click on the first would single-select it
  // (into `selected`, not `multiSelectedEdgeIds`), leaving only one edge
  // in the multi-selection and the bulk action bar never appearing.
  await shiftClick(passLabel);
  await shiftClick(failLabel);

  await expect(page.getByText('2 edges selected')).toBeVisible();
  await page.getByRole('button', { name: 'Make curvy' }).click();

  // saveToLocalStorageDebounced waits ~300ms before writing — poll instead
  // of reading immediately, or this reads the pre-mutation (null) value.
  await expect
    .poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('architecture-diagrams:working-diagram'));
      if (!raw) return false;
      const diagram = JSON.parse(raw);
      const edge = diagram.edges.find((e: { id: string }) => e.id === 'cf-scan-copy');
      return Boolean(edge?.sourceHandle && edge?.targetHandle);
    })
    .toBe(true);

  const raw = await page.evaluate(() => localStorage.getItem('architecture-diagrams:working-diagram'));
  const diagram = JSON.parse(raw!);
  for (const id of ['cf-scan-copy', 'cf-scan-quarantine']) {
    const edge = diagram.edges.find((e: { id: string }) => e.id === id);
    expect(edge.sourceHandle).toBeDefined();
    expect(edge.targetHandle).toBeDefined();
  }
});

test('bulk delete removes every multi-selected node', async ({ page }) => {
  // Two plain top-level nodes with no children — keeps this test about the
  // bulk-delete path itself, not cascade-delete edge cases for a deleted
  // container's descendants.
  const source = page.locator('[data-id="source"]');
  const processing = page.locator('[data-id="account-processing"]');
  const sourceBox = (await source.boundingBox())!;
  const processingBox = (await processing.boundingBox())!;

  const minX = Math.min(sourceBox.x, processingBox.x) - 30;
  const minY = Math.min(sourceBox.y, processingBox.y) - 30;
  const maxX = Math.max(sourceBox.x + sourceBox.width, processingBox.x + processingBox.width) + 30;
  const maxY = Math.max(sourceBox.y + sourceBox.height, processingBox.y + processingBox.height) + 30;

  await page.keyboard.down('Shift');
  await page.mouse.move(minX, minY);
  await page.mouse.down();
  await page.mouse.move(maxX, maxY, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up('Shift');

  await expect(page.getByText('2 nodes selected')).toBeVisible();
  await page.locator('button', { hasText: 'Delete' }).first().click();

  await expect(source).toHaveCount(0);
  await expect(processing).toHaveCount(0);
});

test('Export JSON then Import JSON round-trips the diagram exactly', async ({ page }) => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export JSON' }).click(),
  ]);
  const exportPath = await download.path();
  expect(exportPath).toBeTruthy();

  // Mutate afterward so the import is a real round-trip, not a no-op.
  await page.getByRole('button', { name: '+ Add node' }).click();
  await expect(page.locator('.toolbar__stats')).toHaveText('30 nodes · 24 edges · 2 lenses');

  // setInputFiles talks to the hidden <input type="file"> directly — no
  // need to click "Import JSON" first (that would just try to open a real
  // native OS file picker).
  await page.locator('input[type="file"]').setInputFiles(exportPath!);

  await expect(page.locator('.toolbar__stats')).toHaveText('29 nodes · 24 edges · 2 lenses');
  await expect(page.locator('.graph-node', { hasText: 'New node' })).toHaveCount(0);
});

test('a change survives a full page reload (persisted to localStorage)', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add node' }).click();
  await page.locator('.properties-panel').getByLabel('Label').fill('Survives Reload');
  await expect(page.locator('.graph-node', { hasText: 'Survives Reload' })).toBeVisible();

  // The save to localStorage is debounced (300ms) — wait for it to
  // actually land before reloading, or the reload just re-reads the seed.
  await expect
    .poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('architecture-diagrams:working-diagram'));
      const diagram = raw ? JSON.parse(raw) : null;
      return diagram?.nodes.some((n: { label: string }) => n.label === 'Survives Reload');
    })
    .toBe(true);

  await page.reload();

  await expect(page.locator('.graph-node', { hasText: 'Survives Reload' })).toBeVisible();
  await expect(page.locator('.toolbar__stats')).toHaveText('30 nodes · 24 edges · 2 lenses');
});

test('"Load example" swaps in a different diagram entirely', async ({ page }) => {
  await page.getByTitle('Load one of the built-in example diagrams').selectOption('three-tier-web-app');

  await expect(page.locator('.toolbar__stats')).toHaveText('6 nodes · 5 edges · 1 lenses');
  await expect(page.locator('.graph-node', { hasText: 'Client' })).toBeVisible();
  await expect(page.locator('.graph-node', { hasText: 'Database' })).toBeVisible();
  await expect(page.locator('.graph-node', { hasText: 'USASpending.gov' })).toHaveCount(0);
});

test('frame highlight authoring: toggling a node while editing marks it highlighted for that frame', async ({ page }) => {
  await page.getByRole('button', { name: 'Capture current state' }).click();

  // The seed ships with its own 4 frames already — the newly captured one
  // is appended last.
  const editButton = page.getByRole('button', { name: /Edit highlights/ }).last();
  await expect(editButton).toHaveText('Edit highlights (0)');
  await editButton.click();

  await expect(page.getByText(/click nodes\/edges to toggle/)).toBeVisible();
  await page.locator('.graph-node', { hasText: 'USASpending.gov' }).click();

  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('button', { name: /Edit highlights/ }).last()).toHaveText('Edit highlights (1)');
});

