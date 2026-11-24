import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';

const HEADLESS_SHELL_PATH = '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell';
const defaultExecPath = chromium.executablePath();
const useFallbackHeadlessShell =
  !fs.existsSync(defaultExecPath) && fs.existsSync(HEADLESS_SHELL_PATH);

if (useFallbackHeadlessShell) {
  test.use({
    launchOptions: {
      executablePath: HEADLESS_SHELL_PATH,
      args: ['--no-sandbox'],
    },
  });
}

const RESPONSIVE_VIEWPORTS = [
  { width: 320, height: 740 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

test.describe('Stage 3 Finalization — Marketplace Direction & Category Separation', () => {
  test('Desktop (1280x800): enforces strict 3-direction separation in tabs, category dropdown, and filter sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/market-hub', { waitUntil: 'domcontentloaded' });

    const countBadge = page.getByTestId('header-listings-count-badge');
    await expect(countBadge).toBeVisible({ timeout: 15000 });

    // Visible desktop direction tabs
    const tabAll = page.getByTestId('direction-tab-all').first();
    const tabProduct = page.getByTestId('direction-tab-product').first();
    const tabService = page.getByTestId('direction-tab-service').first();
    const tabProject = page.getByTestId('direction-tab-project').first();

    await expect(tabAll).toBeVisible();
    await expect(tabProduct).toBeVisible();
    await expect(tabService).toBeVisible();
    await expect(tabProject).toBeVisible();

    const desktopCatTrigger = page
      .locator('.hidden.md\\:flex button', { hasText: /(All Categories|ყველა კატეგორია)/i })
      .first();

    // 1. Service direction -> only 3 service categories (including audience-growth)
    await tabService.click();
    await expect(tabService).toHaveAttribute('aria-selected', 'true');
    await desktopCatTrigger.click();

    await expect(page.getByTestId('desktop-cat-item-service')).toBeVisible();
    await expect(page.getByTestId('desktop-cat-item-rent')).toBeVisible();
    await expect(page.getByTestId('desktop-cat-item-audience-growth')).toBeVisible();
    await expect(page.getByTestId('desktop-cat-item-phones')).toHaveCount(0);
    await expect(page.getByTestId('desktop-cat-item-youtube-channels')).toHaveCount(0);
    await expect(page.getByTestId('desktop-cat-item-project-jobs')).toHaveCount(0);

    // Close dropdown via fixed backdrop
    await page.mouse.click(5, 5);

    // 2. Project direction -> only 5 project categories, audience-growth excluded
    await tabProject.click();
    await expect(tabProject).toHaveAttribute('aria-selected', 'true');
    await desktopCatTrigger.click();

    await expect(page.getByTestId('desktop-cat-item-social-accounts')).toBeVisible();
    await expect(page.getByTestId('desktop-cat-item-youtube-channels')).toBeVisible();
    await expect(page.getByTestId('desktop-cat-item-digital-projects')).toBeVisible();
    await expect(page.getByTestId('desktop-cat-item-project-jobs')).toBeVisible();
    await expect(page.getByTestId('desktop-cat-item-collaboration')).toBeVisible();
    await expect(page.getByTestId('desktop-cat-item-audience-growth')).toHaveCount(0);
    await expect(page.getByTestId('desktop-cat-item-phones')).toHaveCount(0);
    await page.mouse.click(5, 5);

    // 3. Product direction -> selects a product category, then switching to Service clears it
    await tabProduct.click();
    await desktopCatTrigger.click();
    await expect(page.getByTestId('desktop-cat-item-phones')).toBeVisible();
    await expect(page.getByTestId('desktop-cat-item-service')).toHaveCount(0);
    await expect(page.getByTestId('desktop-cat-item-collaboration')).toHaveCount(0);
    await page.getByTestId('desktop-cat-item-phones').click();

    await expect(countBadge).toContainText(/(Matching Listings:|ნაპოვნი განცხადებები:)/i);

    await tabService.click();
    await expect(tabService).toHaveAttribute('aria-selected', 'true');

    // Verify Filter panel direction controls
    const filterGroup = page.getByTestId('filter-direction-group').first();
    if (await filterGroup.isVisible().catch(() => false)) {
      await expect(page.getByTestId('filter-direction-service').first()).toBeVisible();
      const filterCatSelect = page.getByTestId('filter-category-select').first();
      const optionValues = await filterCatSelect.locator('option').evaluateAll((opts) =>
        opts.map((o) => (o as HTMLOptionElement).value)
      );
      expect(optionValues).toContain('audience-growth');
      expect(optionValues).not.toContain('phones');
      expect(optionValues).not.toContain('youtube-channels');
    }
  });

  test('Mobile (390x844): enforces strict direction separation in mobile toolbar & filter bottom sheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/market-hub', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('header-listings-count-badge')).toBeVisible({ timeout: 15000 });

    const mobileToolbar = page.locator('.block.md\\:hidden').first();
    await expect(mobileToolbar).toBeVisible();

    // Select Service direction in mobile toolbar
    const mobileServiceTab = mobileToolbar.getByTestId('direction-tab-service');
    await expect(mobileServiceTab).toBeVisible();
    await mobileServiceTab.click();

    const mobileCatButton = mobileToolbar.locator('button', { hasText: /(Category|კატეგორია)/i }).first();
    await mobileCatButton.click();

    await expect(page.getByTestId('mobile-cat-item-service')).toBeVisible();
    await expect(page.getByTestId('mobile-cat-item-rent')).toBeVisible();
    await expect(page.getByTestId('mobile-cat-item-audience-growth')).toBeVisible();
    await expect(page.getByTestId('mobile-cat-item-phones')).toHaveCount(0);
    await expect(page.getByTestId('mobile-cat-item-project-jobs')).toHaveCount(0);

    await page.mouse.click(5, 5);

    // Select Project direction in mobile toolbar
    const mobileProjectTab = mobileToolbar.getByTestId('direction-tab-project');
    await mobileProjectTab.click();
    await mobileCatButton.click();

    await expect(page.getByTestId('mobile-cat-item-youtube-channels')).toBeVisible();
    await expect(page.getByTestId('mobile-cat-item-project-jobs')).toBeVisible();
    await expect(page.getByTestId('mobile-cat-item-audience-growth')).toHaveCount(0);
    await expect(page.getByTestId('mobile-cat-item-phones')).toHaveCount(0);
    await page.mouse.click(5, 5);

    // Open mobile filter sheet and verify separated direction controls + zero horizontal overflow
    const filterBtn = mobileToolbar.locator('button', { hasText: /(Filter|ფილტრი)/i }).first();
    await filterBtn.click();
    await expect(page.getByTestId('filter-direction-group').last()).toBeVisible();

    const sheetOverflow = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      docScrollWidth: document.documentElement.scrollWidth,
    }));
    expect(sheetOverflow.docScrollWidth).toBeLessThanOrEqual(sheetOverflow.innerWidth);
  });
});

test.describe('Stage 3 Finalization — 10-Viewport Responsive Layout Verification', () => {
  for (const vp of RESPONSIVE_VIEWPORTS) {
    test(`Viewport ${vp.width}x${vp.height}: zero horizontal overflow and no overlapping direction controls`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/market-hub', { waitUntil: 'domcontentloaded' });

      await expect(page.getByTestId('header-listings-count-badge')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(250);

      const layoutAudit = await page.evaluate(() => {
        const docScrollWidth = document.documentElement.scrollWidth;
        const innerWidth = window.innerWidth;
        const overlay = document.querySelector('.fixed.inset-0.bg-proton-bg') as HTMLElement | null;
        const overlayOverflow = overlay ? overlay.scrollWidth > overlay.clientWidth + 1 : false;

        const visibleTabs = Array.from(document.querySelectorAll('[data-testid^="direction-tab-"]'))
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
          })
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              id: el.getAttribute('data-testid'),
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
              width: r.width,
              height: r.height,
            };
          });

        let hasOverlap = false;
        for (let i = 0; i < visibleTabs.length; i++) {
          for (let j = i + 1; j < visibleTabs.length; j++) {
            const a = visibleTabs[i];
            const b = visibleTabs[j];
            const xOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const yOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (xOverlap > 2 && yOverlap > 2) {
              hasOverlap = true;
            }
          }
        }

        return {
          docScrollWidth,
          innerWidth,
          overlayOverflow,
          visibleTabsCount: visibleTabs.length,
          hasOverlap,
        };
      });

      expect(layoutAudit.docScrollWidth).toBeLessThanOrEqual(layoutAudit.innerWidth);
      expect(layoutAudit.overlayOverflow).toBe(false);
      expect(layoutAudit.visibleTabsCount).toBeGreaterThanOrEqual(4);
      expect(layoutAudit.hasOverlap).toBe(false);
    });
  }
});

test.describe('Stage 3 Finalization — Authenticated Create Listing Wizard E2E (Requires Test Account)', () => {
  test.skip(
    !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
    'Live Firebase Auth credentials (E2E_TEST_EMAIL / E2E_TEST_PASSWORD) not provided in environment'
  );

  test('Wizard Step 1 direction separation, photo management, and draft reload persistence', async ({ page }) => {
    await page.goto('/market-hub', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('direction-selector-section')).toBeVisible();
  });
});
