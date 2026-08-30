import { expect, test, type Page } from '@playwright/test';

// Intercepts navigator.clipboard.writeText and stashes whatever was
// "copied" on window, so tests can read it back without needing Playwright
// clipboard permissions (which the CI sandbox doesn't grant by default).
async function spyOnClipboard(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __copied: string[] }).__copied = [];
    navigator.clipboard.writeText = (text: string) => {
      (window as unknown as { __copied: string[] }).__copied.push(text);
      return Promise.resolve();
    };
  });
}

async function lastCopiedText(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.at(-1)!);
}

// A fresh page load never writes to localStorage until the first mutation
// (saveToLocalStorageDebounced only fires from mutating store actions) —
// so a diagram fresh off page.goto('/') has to come from the actual seed
// fixture, not a localStorage read that would just race the 300ms
// debounce (or find nothing at all).
async function seedDiagramJSON(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const mod = await import('/src/data/seedDiagram.ts');
    return JSON.stringify(mod.seedDiagram);
  });
}

async function encodeInPage(page: Page, diagramJSON: string): Promise<string> {
  return page.evaluate(async (json) => {
    const mod = await import('/src/utils/urlDiagramCodec.ts');
    return mod.encodeDiagramForURL(JSON.parse(json));
  }, diagramJSON);
}

async function shareLinkForSeed(page: Page, extraSearch = ''): Promise<string> {
  const encoded = await encodeInPage(page, await seedDiagramJSON(page));
  return `/?d=${encoded}${extraSearch}`;
}

test('"Copy share link" produces a URL that decodes back to the exact same diagram', async ({ page }) => {
  await spyOnClipboard(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Copy share link' }).click();
  await expect(page.getByRole('button', { name: 'Link copied!' })).toBeVisible();

  const copied = await lastCopiedText(page);
  const url = new URL(copied);
  const encoded = url.searchParams.get('d');
  expect(encoded).toBeTruthy();

  const decoded = await page.evaluate(async (param) => {
    const mod = await import('/src/utils/urlDiagramCodec.ts');
    return mod.decodeDiagramFromURL(param);
  }, encoded!);

  expect(decoded).toEqual(JSON.parse(await seedDiagramJSON(page)));
});

test('a share link generated while viewing a frame includes that frame', async ({ page }) => {
  await spyOnClipboard(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Next ▶' }).click();
  await expect(page.getByText('1. Pipeline overview')).toBeVisible();

  await page.getByRole('button', { name: 'Copy share link' }).click();
  const copied = await lastCopiedText(page);
  const url = new URL(copied);
  expect(url.searchParams.get('frame')).toBeTruthy();
});

test('opening a ?d= link loads read-only: banner shown, dragging disabled, no property panel, authoring controls hidden', async ({ page }) => {
  await page.goto('/'); // just to get onto the app's own origin before building the link
  const link = await shareLinkForSeed(page);

  await page.goto(link);

  await expect(page.getByText('Viewing a shared diagram — read-only')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();

  // Authoring controls gone.
  await expect(page.getByRole('button', { name: '+ Add node' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Import JSON' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reset to demo' })).toHaveCount(0);
  await expect(page.getByTitle('Add a sticky note to this frame')).toHaveCount(0);
  // Export still works — viewing implies you might want to keep a copy.
  await expect(page.getByRole('button', { name: 'Export JSON' })).toBeVisible();

  // Clicking a node no longer opens its editable properties panel.
  await page.locator('.graph-node', { hasText: 'USASpending.gov' }).click();
  await expect(page.locator('.properties-panel')).toHaveCount(0);

  // Dragging a node does nothing — no mutation, not even a visual move.
  const node = page.locator('[data-id="source"]');
  const before = (await node.boundingBox())!;
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + 200, before.y + 150, { steps: 10 });
  await page.mouse.up();
  const after = (await node.boundingBox())!;
  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.y).toBeCloseTo(before.y, 0);
});

test('opening a ?d= link with a ?frame= too resumes on that exact frame, in view mode', async ({ page }) => {
  await page.goto('/');
  const seedJSON = await seedDiagramJSON(page);
  const frameId = JSON.parse(seedJSON).frames[1].id; // "2. Inside the AV scan"
  const link = await shareLinkForSeed(page, `&frame=${frameId}`);

  await page.goto(link);

  await expect(page.getByText('2. Inside the AV scan')).toBeVisible();
  await expect(page.getByText('Viewing a shared diagram — read-only')).toBeVisible();
});

test('clicking "Edit" restores full editing, and the diagram param is stripped from the address bar', async ({ page }) => {
  await page.goto('/');
  const link = await shareLinkForSeed(page);
  await page.goto(link);
  await expect(page.getByText('Viewing a shared diagram — read-only')).toBeVisible();

  await page.waitForURL((url) => !url.searchParams.has('d'));

  await page.getByRole('button', { name: 'Edit' }).click();

  await expect(page.getByText('Viewing a shared diagram — read-only')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '+ Add node' })).toBeVisible();

  // And editing genuinely works again — not just that the banner is gone.
  await page.locator('.graph-node', { hasText: 'USASpending.gov' }).click();
  await expect(page.locator('.properties-panel')).toBeVisible();
});

test('a right-click context menu is unavailable on a node while viewing (only Expand/Collapse would apply, via its own chevron)', async ({ page }) => {
  await page.goto('/');
  const link = await shareLinkForSeed(page);
  await page.goto(link);

  await page.locator('.graph-node', { hasText: 'USASpending.gov' }).click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Delete node' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Edit properties…' })).toHaveCount(0);
});

test('a sticky note renders read-only while viewing: no delete button, textarea not editable, does not drag', async ({ page }) => {
  await page.goto('/');
  // Author a note first, in normal edit mode.
  await page.getByRole('button', { name: 'Next ▶' }).click();
  await page.getByTitle('Add a sticky note to this frame').click();
  await page.locator('.sticky-note textarea').fill('Look here');

  // This diagram really has been mutated, so (unlike the fixture-based
  // links above) the link has to reflect that — wait out the persistence
  // debounce rather than reading localStorage immediately.
  const diagramJSON = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const check = () => {
          const raw = localStorage.getItem('architecture-diagrams:working-diagram');
          if (raw && raw.includes('Look here')) resolve(raw);
          else setTimeout(check, 20);
        };
        check();
      }),
  );
  const frameId = JSON.parse(diagramJSON).frames[0].id;
  const encoded = await encodeInPage(page, diagramJSON);

  await page.goto(`/?d=${encoded}&frame=${frameId}`);

  const note = page.locator('.sticky-note');
  await expect(note).toBeVisible();
  await expect(note.getByTitle('Delete sticky note')).toHaveCount(0);
  await expect(note.locator('textarea')).toHaveAttribute('readonly', '');
  await expect(note.locator('textarea')).toHaveValue('Look here');
});
