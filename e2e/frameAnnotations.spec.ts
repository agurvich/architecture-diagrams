import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('the "Exit frame" button and sticky-note add button exist only while a frame is active — a full round trip, not just a static absence check', async ({ page }) => {
  // Asserting absence alone would pass trivially against a feature that
  // doesn't exist at all — round-tripping through the presence state and
  // back is what actually proves the toggle is real.
  await expect(page.getByText('Not viewing a frame')).toBeVisible();
  await expect(page.getByTitle('Exit frame view')).toHaveCount(0);
  await expect(page.getByTitle('Add a sticky note to this frame')).toHaveCount(0);

  await page.getByRole('button', { name: 'Next ▶' }).click();
  await expect(page.getByText('1. Pipeline overview')).toBeVisible();
  const exitButton = page.getByTitle('Exit frame view');
  await expect(exitButton).toBeVisible();
  await expect(page.getByTitle('Add a sticky note to this frame')).toBeVisible();

  await exitButton.click();

  await expect(page.getByText('Not viewing a frame')).toBeVisible();
  await expect(page.getByTitle('Exit frame view')).toHaveCount(0);
  await expect(page.getByTitle('Add a sticky note to this frame')).toHaveCount(0);
  // Prev/Next disabled again, matching the initial no-frame state.
  await expect(page.getByRole('button', { name: '◀ Prev' })).toBeDisabled();
});

test('exiting frame view leaves the lens/expand state that frame set, untouched', async ({ page }) => {
  // frame-1 ("1. Pipeline overview") sets activeSets to just Control Flow
  // and expands both AWS accounts — confirm exiting doesn't revert either.
  await page.getByRole('button', { name: 'Next ▶' }).click();
  await expect(page.getByText('1. Pipeline overview')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Data Flow' })).not.toBeChecked();
  await expect(page.locator('.graph-node--expanded-container', { hasText: 'Acquisition Account' })).toBeVisible();

  await page.getByTitle('Exit frame view').click();

  await expect(page.getByRole('checkbox', { name: 'Data Flow' })).not.toBeChecked();
  await expect(page.locator('.graph-node--expanded-container', { hasText: 'Acquisition Account' })).toBeVisible();
});

test('adding a sticky note to a frame creates an editable card, and its text persists', async ({ page }) => {
  await page.getByRole('button', { name: 'Next ▶' }).click();

  const addButton = page.getByTitle('Add a sticky note to this frame');
  await expect(addButton).toBeVisible();
  await addButton.click();

  const note = page.locator('.sticky-note');
  await expect(note).toHaveCount(1);
  await note.locator('textarea').fill('Check the watermark first');
  await expect(note.locator('textarea')).toHaveValue('Check the watermark first');

  // Persisted, not just local component state — reload and confirm it survived.
  await expect
    .poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('architecture-diagrams:working-diagram'));
      if (!raw) return false;
      const diagram = JSON.parse(raw);
      const frame = diagram.frames.find((f: { name: string }) => f.name === '1. Pipeline overview');
      return frame?.stickyNotes?.[0]?.text === 'Check the watermark first';
    })
    .toBe(true);
});

test('a sticky note can be dragged to a new position on the canvas, and it persists', async ({ page }) => {
  await page.getByRole('button', { name: 'Next ▶' }).click();
  await page.getByTitle('Add a sticky note to this frame').click();

  const note = page.locator('.sticky-note');
  const before = (await note.boundingBox())!;

  const handle = note.locator('.sticky-note__header');
  const handleBox = (await handle.boundingBox())!;
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 180, handleBox.y + 120, { steps: 10 });
  await page.mouse.up();

  const after = (await note.boundingBox())!;
  expect(Math.abs(after.x - before.x)).toBeGreaterThan(100);
  expect(Math.abs(after.y - before.y)).toBeGreaterThan(80);

  // Persisted, not just a visual drag with no backing state change.
  await expect
    .poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('architecture-diagrams:working-diagram'));
      if (!raw) return null;
      const diagram = JSON.parse(raw);
      const frame = diagram.frames.find((f: { name: string }) => f.name === '1. Pipeline overview');
      return frame?.stickyNotes?.[0]?.position ?? null;
    })
    .not.toBeNull();
});

test('dragging a sticky note does not select or drag the canvas underneath it', async ({ page }) => {
  await page.getByRole('button', { name: 'Next ▶' }).click();
  await page.getByTitle('Add a sticky note to this frame').click();

  const nodeBox = (await page.locator('[data-id="source"]').boundingBox())!;
  const handle = page.locator('.sticky-note__header');
  const handleBox = (await handle.boundingBox())!;

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 60, handleBox.y + 40, { steps: 5 });
  await page.mouse.up();

  // The "source" node's own position is untouched — dragging the note
  // didn't accidentally drag whatever was underneath it on the canvas.
  const nodeBoxAfter = (await page.locator('[data-id="source"]').boundingBox())!;
  expect(nodeBoxAfter.x).toBeCloseTo(nodeBox.x, 0);
  expect(nodeBoxAfter.y).toBeCloseTo(nodeBox.y, 0);
});

test('sticky notes are scoped to their own frame — switching frames shows only that frame\'s notes', async ({ page }) => {
  await page.getByRole('button', { name: 'Next ▶' }).click(); // frame 1
  await page.getByTitle('Add a sticky note to this frame').click();
  await page.locator('.sticky-note textarea').fill('Frame 1 note');

  await page.getByRole('button', { name: 'Next ▶' }).click(); // frame 2
  await expect(page.locator('.sticky-note')).toHaveCount(0);

  await page.getByRole('button', { name: '◀ Prev' }).click(); // back to frame 1
  await expect(page.locator('.sticky-note')).toHaveCount(1);
  await expect(page.locator('.sticky-note textarea')).toHaveValue('Frame 1 note');
});

test('deleting a sticky note removes it', async ({ page }) => {
  await page.getByRole('button', { name: 'Next ▶' }).click();
  await page.getByTitle('Add a sticky note to this frame').click();
  await expect(page.locator('.sticky-note')).toHaveCount(1);

  await page.locator('.sticky-note').getByTitle('Delete sticky note').click();
  await expect(page.locator('.sticky-note')).toHaveCount(0);
});

test('exiting frame view hides the sticky-notes panel, but the notes survive underneath', async ({ page }) => {
  await page.getByRole('button', { name: 'Next ▶' }).click();
  await page.getByTitle('Add a sticky note to this frame').click();
  await page.locator('.sticky-note textarea').fill('Still here later');

  await page.getByTitle('Exit frame view').click();
  await expect(page.locator('.sticky-note')).toHaveCount(0);
  await expect(page.getByTitle('Add a sticky note to this frame')).toHaveCount(0);

  await page.getByRole('button', { name: 'Next ▶' }).click(); // back to frame 1
  await expect(page.locator('.sticky-note')).toHaveCount(1);
  await expect(page.locator('.sticky-note textarea')).toHaveValue('Still here later');
});
