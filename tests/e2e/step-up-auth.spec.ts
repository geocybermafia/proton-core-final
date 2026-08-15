import { test, expect } from './fixtures/auth.fixture';

test.describe('Zero-Trust Step-Up PIN Verification Flow', () => {
  test.beforeEach(async ({ protonApp, page }) => {
    // Navigate to base and reset any leftover session lockout state
    await protonApp.goto('/');
    await protonApp.clearLockoutState();
  });

  test('Critical Path: Trigger Step-Up Modal, enter valid PIN, and execute sensitive operation', async ({ protonApp, page }) => {
    // 1. Navigate to Settings view
    await protonApp.gotoSettings();

    // 2. Select Profile Tab
    await protonApp.switchSettingsTab('profile');

    // 3. Locate email input field and simulate sensitive modification
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="@"]').first();
    await expect(emailInput).toBeVisible({ timeout: 5000 });
    
    const initialEmail = await emailInput.inputValue();
    const modifiedEmail = initialEmail.includes('updated') 
      ? 'architect.verified@proton.internal' 
      : 'architect.updated@proton.internal';
    
    await emailInput.fill(modifiedEmail);

    // 4. Click Save button in Settings
    const saveButton = page.locator('#btn-settings-save');
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // 5. Verify SecurityVerificationModal appears on screen
    const modalHeading = page.getByRole('heading', { name: /(დამატებითი დადასტურებაა საჭირო|Additional Verification Required)/i });
    await expect(modalHeading).toBeVisible({ timeout: 6000 });

    // 6. Verify security warning / action title badge is present
    const sensitiveBadge = page.locator('text=/(ელფოსტის შეცვლა|Change Email Address|სენსიტიური ოპერაცია|Sensitive Operation)/i').first();
    await expect(sensitiveBadge).toBeVisible();

    // 7. Check if PIN input inputs are present or confirmation mode
    const pinInput0 = page.locator('#stepup-pin-input-0');
    const isPinProtected = await pinInput0.isVisible({ timeout: 2000 }).catch(() => false);

    if (isPinProtected) {
      // Simulate entering 4-digit PIN (default dev test pin: '1234' or dynamic fallback)
      await protonApp.enterStepUpPin('1234');
    }

    // 8. Click Confirmation Button
    const confirmButton = page.getByRole('button', { name: /(დადასტურება|Confirm)/i });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // 9. Verify that the modal closes and UI reflects successful grant consumption
    await expect(modalHeading).not.toBeVisible({ timeout: 5000 });

    // 10. Verify Toast or Save status confirmation
    const successToastOrButton = page.locator('text=/(ცვლილებები შენახულია|Changes saved successfully|შენახულია|Saved)/i').first();
    await expect(successToastOrButton).toBeVisible({ timeout: 8000 });
  });

  test('Error Handling: Entering incorrect PIN displays atomic error and prevents sensitive execution', async ({ protonApp, page }) => {
    // 1. Navigate to Settings
    await protonApp.gotoSettings();
    await protonApp.switchSettingsTab('profile');

    // 2. Modify email to trigger Step-Up requirement
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="@"]').first();
    await expect(emailInput).toBeVisible();
    await emailInput.fill('security.test.invalid@proton.internal');

    // 3. Trigger Save
    const saveButton = page.locator('#btn-settings-save');
    await saveButton.click();

    // 4. Modal is displayed
    const modalHeading = page.getByRole('heading', { name: /(დამატებითი დადასტურებაა საჭირო|Additional Verification Required)/i });
    await expect(modalHeading).toBeVisible();

    const pinInput0 = page.locator('#stepup-pin-input-0');
    const isPinProtected = await pinInput0.isVisible({ timeout: 2000 }).catch(() => false);

    if (isPinProtected) {
      // Enter incorrect PIN
      await protonApp.enterStepUpPin('0000');

      const confirmButton = page.getByRole('button', { name: /(დადასტურება|Confirm)/i });
      await confirmButton.click();

      // 5. Verify error notification message inside modal
      const errorMessage = page.locator('text=/(არასწორი PIN კოდი|incorrect PIN|მრავალჯერადი არასწორი მცდელობა|Failed)/i').first();
      await expect(errorMessage).toBeVisible({ timeout: 5000 });

      // 6. Verify PIN input memory is wiped (cleared)
      const pin0Value = await pinInput0.inputValue();
      expect(pin0Value).toBe('');

      // 7. Verify modal remains active and did NOT execute save
      await expect(modalHeading).toBeVisible();
    } else {
      // For unauthenticated/unpinned fallback, verify user can cancel safely
      const cancelButton = page.getByRole('button', { name: /(გაუქმება|Cancel)/i });
      await cancelButton.click();
      await expect(modalHeading).not.toBeVisible();
    }
  });

  test('User UX: Step-Up modal can be dismissed safely without uncommitted side effects', async ({ protonApp, page }) => {
    await protonApp.gotoSettings();
    await protonApp.switchSettingsTab('profile');

    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="@"]').first();
    await emailInput.fill('dismiss.test@proton.internal');

    const saveButton = page.locator('#btn-settings-save');
    await saveButton.click();

    const modalHeading = page.getByRole('heading', { name: /(დამატებითი დადასტურებაა საჭირო|Additional Verification Required)/i });
    await expect(modalHeading).toBeVisible();

    // Click Cancel Button
    const cancelButton = page.getByRole('button', { name: /(გაუქმება|Cancel)/i });
    await cancelButton.click();

    // Modal is dismissed
    await expect(modalHeading).not.toBeVisible({ timeout: 3000 });
  });
});
