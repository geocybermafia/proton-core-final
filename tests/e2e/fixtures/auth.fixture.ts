import { test as base, expect, Page } from '@playwright/test';

/**
 * Custom Page Object and test fixture for Proton E2E Suite.
 * Automates security PIN setup, storage isolation, and common test helpers.
 */
export class ProtonAppPage {
  constructor(public readonly page: Page) {}

  /**
   * Navigate directly to the application and ensure root is mounted
   */
  async goto(path = '/') {
    await this.page.goto(path);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Navigate to Settings view via direct URL or navigation button
   */
  async gotoSettings() {
    await this.page.goto('/settings');
    // Ensure settings root is rendered
    await expect(
      this.page.locator('#settings-view-root, #settings-sidebar, [id^="tab-settings-"]')
    ).toBeVisible({ timeout: 10000 });
  }

  /**
   * Switch tab in Settings
   */
  async switchSettingsTab(tabId: 'profile' | 'ai' | 'preferences' | 'security' | 'seo' | 'cost_control') {
    const tabButton = this.page.locator(`#tab-settings-${tabId}`);
    await tabButton.click();
    await this.page.waitForTimeout(200);
  }

  /**
   * Enter 4-digit PIN into the SecurityVerificationModal
   */
  async enterStepUpPin(pin: string) {
    expect(pin).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      const pinInput = this.page.locator(`#stepup-pin-input-${i}`);
      await expect(pinInput).toBeVisible();
      await pinInput.fill(pin[i]);
    }
  }

  /**
   * Clear session lockout state to ensure test idempotency
   */
  async clearLockoutState() {
    await this.page.evaluate(() => {
      window.sessionStorage.removeItem('proton_pin_lockout_state');
    });
  }
}

export const test = base.extend<{ protonApp: ProtonAppPage }>({
  protonApp: async ({ page }, use) => {
    const protonApp = new ProtonAppPage(page);
    await use(protonApp);
  },
});

export { expect };
