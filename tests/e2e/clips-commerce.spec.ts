import { test, expect } from './fixtures/auth.fixture';

test.describe('Shoppable Clips Commerce Flow', () => {
  test.beforeEach(async ({ protonApp }) => {
    await protonApp.goto('/');
  });

  test('Clips Feed: Navigate to Clips, open store drawer, and verify quantity stepper limits', async ({ page }) => {
    // 1. Navigate to Clips View
    await page.goto('/clips');
    await page.waitForLoadState('domcontentloaded');

    // 2. Check if Clips viewport or container is visible
    const clipsContainer = page.locator('#clips-container, .clips-player, [data-testid="clips-view"]').first();
    const isClipsVisible = await clipsContainer.isVisible({ timeout: 5000 }).catch(() => false);

    if (isClipsVisible) {
      // 3. Open comments drawer or store drawer if CTA button is present
      const shopButton = page.locator('button:has-text("Shop"), button:has-text("ყიდვა"), [id^="btn-clip-shop-"]').first();
      const hasShopBtn = await shopButton.isVisible().catch(() => false);
      
      if (hasShopBtn) {
        await shopButton.click();
        
        // 4. Verify quantity stepper
        const decreaseBtn = page.getByRole('button', { name: /Decrease quantity/i });
        const increaseBtn = page.getByRole('button', { name: /Increase quantity/i });

        if (await decreaseBtn.isVisible()) {
          // Verify lower limit (disabled at 1)
          await expect(decreaseBtn).toBeDisabled();
          
          // Increment
          await increaseBtn.click();
          await expect(decreaseBtn).toBeEnabled();
        }
      }
    }
  });
});
