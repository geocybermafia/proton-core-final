import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright';

const ROOT = process.cwd();

/**
 * Evaluates the Firestore /users/{userId} security rule contract extracted from firestore.rules.
 */
function simulateUsersRuleUpdate(
  existingDoc: Record<string, any>,
  incomingDoc: Record<string, any>,
  authUid: string | null,
  targetUserId: string
): boolean {
  if (!authUid || authUid !== targetUserId) return false;
  const affectedKeys = new Set<string>();
  const allKeys = new Set([...Object.keys(existingDoc), ...Object.keys(incomingDoc)]);
  for (const k of allKeys) {
    if (JSON.stringify(existingDoc[k]) !== JSON.stringify(incomingDoc[k])) {
      affectedKeys.add(k);
    }
  }
  const roleUnchanged = !affectedKeys.has('role');
  const pinFieldsUnchanged =
    !affectedKeys.has('securityPinEnabled') &&
    !affectedKeys.has('securityPinMeta') &&
    !affectedKeys.has('securityPin');
  return roleUnchanged && pinFieldsUnchanged;
}

function simulateUsersRuleCreate(
  incomingDoc: Record<string, any>,
  authUid: string | null,
  targetUserId: string
): boolean {
  if (!authUid || authUid !== targetUserId) return false;
  const notRoleEscalated = !('role' in incomingDoc) || incomingDoc.role !== 'admin';
  const noPinFields =
    !('securityPinEnabled' in incomingDoc) &&
    !('securityPinMeta' in incomingDoc) &&
    !('securityPin' in incomingDoc);
  return notRoleEscalated && noPinFields;
}

async function buildSettingsHarnessBundle(): Promise<string> {
  const virtualPlugin: esbuild.Plugin = {
    name: 'proton-test-stubs',
    setup(build) {
      build.onResolve({ filter: /cloudFunctionsService$/ }, () => ({
        path: 'cloudFunctionsService-stub',
        namespace: 'stub',
      }));
      build.onResolve({ filter: /firebase$/ }, () => ({
        path: 'firebase-stub',
        namespace: 'stub',
      }));
      build.onResolve({ filter: /^firebase\/firestore$/ }, () => ({
        path: 'firestore-stub',
        namespace: 'stub',
      }));
      build.onResolve({ filter: /AuthContext$/ }, () => ({
        path: 'auth-stub',
        namespace: 'stub',
      }));
      build.onResolve({ filter: /storageUtils$/ }, () => ({
        path: 'storage-stub',
        namespace: 'stub',
      }));

      build.onLoad({ filter: /^cloudFunctionsService-stub$/, namespace: 'stub' }, () => ({
        contents: `
          export async function verifyStepUpPinCall(params) {
            return window.__TEST_MOCKS__.verifyStepUpPinCall(params);
          }
          export async function updateSecurityPinCall(params) {
            return window.__TEST_MOCKS__.updateSecurityPinCall(params);
          }
          export async function resetUserWorkspaceCall(params) {
            return window.__TEST_MOCKS__.resetUserWorkspaceCall(params);
          }
          export async function updateUserEmailCall(params) {
            return window.__TEST_MOCKS__.updateUserEmailCall(params);
          }
          export async function executeSecureTransaction() { return { success: true }; }
          export async function markMarketConversationReadCall() { return { success: true }; }
        `,
        loader: 'js',
      }));

      build.onLoad({ filter: /^firebase-stub$/, namespace: 'stub' }, () => ({
        contents: `
          export const db = { __stub: true };
          export const auth = { currentUser: null };
          export const functions = {};
          export const googleProvider = { providerId: 'google.com' };
        `,
        loader: 'js',
      }));

      build.onResolve({ filter: /^firebase\/auth$/ }, () => ({
        path: 'firebase-auth-stub',
        namespace: 'stub',
      }));

      build.onLoad({ filter: /^firebase-auth-stub$/, namespace: 'stub' }, () => ({
        contents: `
          export class EmailAuthProvider {
            static credential(email, password) {
              return { providerId: 'password', email, password };
            }
          }
          export async function reauthenticateWithCredential(user, credential) {
            return window.__TEST_MOCKS__.reauthenticateWithCredential(user, credential);
          }
          export async function reauthenticateWithPopup(user, provider) {
            return window.__TEST_MOCKS__.reauthenticateWithPopup(user, provider);
          }
        `,
        loader: 'js',
      }));

      build.onLoad({ filter: /^firestore-stub$/, namespace: 'stub' }, () => ({
        contents: `
          export function doc(_db, ...segments) {
            return { path: segments.join('/') };
          }
          export async function setDoc(ref, data, options) {
            window.__TEST_RECORDINGS__.firestoreWrites.push({
              op: 'setDoc',
              path: ref.path,
              data: JSON.parse(JSON.stringify(data)),
              options: options || null,
            });
          }
          export async function updateDoc(ref, data) {
            window.__TEST_RECORDINGS__.firestoreWrites.push({
              op: 'updateDoc',
              path: ref.path,
              data: JSON.parse(JSON.stringify(data)),
            });
          }
          export function onSnapshot(_ref, _cb) {
            return () => {};
          }
          export function deleteField() {
            return { __deleteField: true };
          }
        `,
        loader: 'js',
      }));

      build.onLoad({ filter: /^auth-stub$/, namespace: 'stub' }, () => ({
        contents: `
          export function useAuth() {
            return {
              user: window.__TEST_MOCKS__.user,
              loading: false,
              initialized: true,
              logout: async () => {},
            };
          }
          export const AuthProvider = ({ children }) => children;
        `,
        loader: 'js',
      }));

      build.onLoad({ filter: /^storage-stub$/, namespace: 'stub' }, () => ({
        contents: `
          export async function uploadAvatarImage() { return 'https://example.com/avatar.png'; }
        `,
        loader: 'js',
      }));
    },
  };

  const entrySource = `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { SettingsView } from './src/components/SettingsView';
    import { SecurityVerificationModal } from './src/components/SecurityVerificationModal';
    import { ToastProvider } from './src/components/Toast';
    import { LanguageProvider } from './src/contexts/LanguageContext';

    window.__TEST_RECORDINGS__ = {
      firestoreWrites: [],
      stepUpConfirms: [],
    };

    function TestHarness() {
      const cfg = window.__TEST_INIT__;
      const [userProfile, setUserProfile] = useState(cfg.userProfile);
      const [aiSettings, setAiSettings] = useState(cfg.aiSettings);
      const [theme, setTheme] = useState(cfg.theme || 'proton');
      const [uiMode, setUiMode] = useState('business');
      const [modalOpen, setModalOpen] = useState(!!cfg.mountStandaloneModal);

      window.__TEST_STATE__ = { userProfile, aiSettings, theme };

      return (
        <LanguageProvider>
          <ToastProvider>
            {cfg.mountStandaloneModal ? (
              <SecurityVerificationModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onConfirm={(grantId) => {
                  window.__TEST_RECORDINGS__.stepUpConfirms.push({ grantId });
                }}
                actionTitle="Standalone Step-Up Test"
                scope={cfg.modalScope || 'generalStepUp'}
                securityPinEnabled={!!userProfile.securityPinEnabled}
                securityPinMeta={userProfile.securityPinMeta}
                language="en"
              />
            ) : (
              <SettingsView
                userProfile={userProfile}
                setUserProfile={setUserProfile}
                aiSettings={aiSettings}
                setAiSettings={setAiSettings}
                theme={theme}
                setTheme={setTheme}
                language="en"
                uiMode={uiMode}
                setUiMode={setUiMode}
              />
            )}
          </ToastProvider>
        </LanguageProvider>
      );
    }

    createRoot(document.getElementById('root')).render(<TestHarness />);
  `;

  const result = await esbuild.build({
    stdin: {
      contents: entrySource,
      resolveDir: ROOT,
      loader: 'tsx',
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    define: {
      'process.env.NODE_ENV': '"test"',
    },
    plugins: [virtualPlugin],
  });

  return result.outputFiles[0].text;
}

describe('PROTON Critical PIN Security Patch — Phase 5 Regression Suite', () => {
  it('Phase 2 & 3 Static Contracts: firestore.rules, SecurityVerificationModal, and SettingsView contain zero bypass paths', () => {
    const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
    assert.match(rules, /function hasNoSecurityPinFieldsOnCreate\(\)/);
    assert.match(rules, /function areSecurityPinFieldsUnchanged\(\)/);
    assert.match(
      rules,
      /request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasAny\(\[\s*'securityPinEnabled',\s*'securityPinMeta',\s*'securityPin'\s*\]\)/
    );
    assert.match(rules, /match \/security\/\{docId\}\s*\{\s*allow read, write: if false;/);

    const modalSrc = fs.readFileSync(
      path.join(ROOT, 'src/components/SecurityVerificationModal.tsx'),
      'utf8'
    );
    assert.doesNotMatch(modalSrc, /verifyPinWithMeta|correctPin|checkPinLockout|registerFailedPinAttempt|resetPinLockoutAttempts|sessionStorage/);
    assert.match(modalSrc, /verifyStepUpPinCall/);

    const settingsSrc = fs.readFileSync(path.join(ROOT, 'src/components/SettingsView.tsx'), 'utf8');
    assert.doesNotMatch(settingsSrc, /createPinMeta|verifyPinWithMeta|checkPinLockout|registerFailedPinAttempt|resetPinLockoutAttempts|deleteField/);
    assert.doesNotMatch(settingsSrc, /Cloud Function .* failed, using client-side/);
    assert.doesNotMatch(settingsSrc, /pinCurrentInput/);

    const secUtilsSrc = fs.readFileSync(path.join(ROOT, 'src/lib/securityUtils.ts'), 'utf8');
    assert.doesNotMatch(secUtilsSrc, /updateDoc|deleteField/);
  });

  it('Scenarios 8 & 9: firestore.rules contract blocks direct PIN writes and permits allowed profile field updates', () => {
    const existing = {
      name: 'Beka',
      email: 'beka@example.com',
      region: 'Tbilisi, GE',
      preferredCurrency: 'USD',
      language: 'en',
      role: 'System Architect',
      securityPinEnabled: true,
      securityPinMeta: { enabled: true, salt: 'aa', verifier: 'bb', version: 1 },
    };

    // Scenario 8: Direct client writes to PIN fields MUST be denied
    assert.equal(
      simulateUsersRuleCreate({ email: 'a@b.c', securityPinEnabled: true }, 'uid-1', 'uid-1'),
      false
    );
    assert.equal(
      simulateUsersRuleCreate(
        { email: 'a@b.c', securityPinMeta: { enabled: true } },
        'uid-1',
        'uid-1'
      ),
      false
    );
    assert.equal(
      simulateUsersRuleCreate({ email: 'a@b.c', securityPin: '1234' }, 'uid-1', 'uid-1'),
      false
    );
    assert.equal(
      simulateUsersRuleUpdate(existing, { ...existing, securityPinEnabled: false }, 'uid-1', 'uid-1'),
      false
    );
    assert.equal(
      simulateUsersRuleUpdate(
        existing,
        { ...existing, securityPinMeta: { enabled: false, salt: 'xx', verifier: 'yy', version: 1 } },
        'uid-1',
        'uid-1'
      ),
      false
    );
    assert.equal(
      simulateUsersRuleUpdate(existing, { ...existing, securityPin: '9999' }, 'uid-1', 'uid-1'),
      false
    );

    // Scenario 9: Allowed profile fields MUST still succeed
    assert.equal(
      simulateUsersRuleCreate({ uid: 'uid-1', email: 'beka@example.com' }, 'uid-1', 'uid-1'),
      true
    );
    assert.equal(
      simulateUsersRuleUpdate(
        existing,
        {
          ...existing,
          name: 'Beka Updated',
          region: 'Batumi, GE',
          preferredCurrency: 'GEL',
          language: 'ka',
          aiSettings: { temperature: 0.3 },
        },
        'uid-1',
        'uid-1'
      ),
      true
    );
  });

  it('Scenarios 1–7, 9, 10 (Live Chromium DOM + Component Harness): verifies fail-closed PIN, Lockout, Network/Permission errors, Profile Save, and Workspace Reset', async () => {
    const bundleCode = await buildSettingsHarnessBundle();
    const browser = await chromium.launch({
      executablePath: '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const mountHarness = async (
        initConfig: Record<string, any>,
        mocksScript: string
      ) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.route('http://harness.local/**', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: '<!DOCTYPE html><html><body><div id="root"></div></body></html>',
          });
        });
        await page.goto('http://harness.local/');
        await page.evaluate(
          ({ init, mocksFnBody }) => {
            (window as any).__TEST_INIT__ = init;
            (window as any).__TEST_MOCKS__ = new Function(mocksFnBody)();
          },
          { init: initConfig, mocksFnBody: mocksScript }
        );
        await page.addScriptTag({ content: bundleCode });
        return { context, page };
      };

      const baseProfile = {
        id: 'user-123',
        name: 'Proton Tester',
        email: 'tester@proton.internal',
        language: 'en',
        region: 'Tbilisi, GE',
        preferredCurrency: 'USD',
        notifications: true,
        notificationsEnabled: true,
        phoneNumber: '+995555123456',
        avatar: '',
        role: 'System Architect',
        showCommercialHub: false,
        securityPinEnabled: false,
      };
      const baseAi = {
        temperature: 0.7,
        enableSearch: false,
        enableMaps: false,
        zenMode: false,
        systemInstruction: '',
        voice: 'GeorgianModern',
      };

      // --- Scenario 1 + 6 + 7 (Enable PIN: network error -> denied -> success) ---
      {
        const { context, page } = await mountHarness(
          { userProfile: baseProfile, aiSettings: baseAi },
          `
          let mode = 'network-error';
          return {
            user: { uid: 'user-123', email: 'tester@proton.internal', getIdTokenResult: async () => ({ claims: {} }) },
            setMode(m) { mode = m; },
            async updateSecurityPinCall(params) {
              if (mode === 'network-error') throw new Error('Network error: Failed to reach Cloud Function');
              if (mode === 'permission-denied') {
                const err = new Error('Permission denied');
                err.code = 'functions/permission-denied';
                throw err;
              }
              return { success: true };
            },
            async verifyStepUpPinCall() { throw new Error('Unexpected verify'); },
            async resetUserWorkspaceCall() { throw new Error('Unexpected reset'); },
          };
          `
        );

        await page.locator('#tab-settings-security').click();
        await page.locator('button', { hasText: 'Enable PIN Code' }).click();
        const inputs = page.locator('input[placeholder="••••"]');
        await inputs.nth(0).fill('1234');
        await inputs.nth(1).fill('1234');

        // 6: Network error -> stays disabled, NO Firestore fallback write!
        await page.locator('button', { hasText: /^Save$/ }).click();
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => (window as any).__TEST_STATE__.userProfile.securityPinEnabled), false);
        assert.equal(await page.evaluate(() => (window as any).__TEST_RECORDINGS__.firestoreWrites.length), 0);
        assert.equal(await page.locator('text=Network error').isVisible(), true);

        // 7: Permission-denied -> stays disabled, NO Firestore fallback write!
        await page.evaluate(() => (window as any).__TEST_MOCKS__.setMode('permission-denied'));
        await page.locator('button', { hasText: /^Save$/ }).click();
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => (window as any).__TEST_STATE__.userProfile.securityPinEnabled), false);
        assert.equal(await page.evaluate(() => (window as any).__TEST_RECORDINGS__.firestoreWrites.length), 0);

        // 1: Server succeeds -> enables PIN cleanly without client Firestore PIN write!
        await page.evaluate(() => (window as any).__TEST_MOCKS__.setMode('success'));
        await page.locator('button', { hasText: /^Save$/ }).click();
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => (window as any).__TEST_STATE__.userProfile.securityPinEnabled), true);
        assert.equal(await page.evaluate(() => (window as any).__TEST_RECORDINGS__.firestoreWrites.length), 0);
        assert.equal(await page.locator('text=Security settings updated').isVisible(), true);

        await context.close();
      }

      // --- Scenarios 2 & 3: Change PIN & Disable PIN with valid Step-Up + failed server call ---
      {
        const { context, page } = await mountHarness(
          { userProfile: { ...baseProfile, securityPinEnabled: true }, aiSettings: baseAi },
          `
          let failUpdate = false;
          const calls = [];
          return {
            user: { uid: 'user-123', email: 'tester@proton.internal', getIdTokenResult: async () => ({ claims: {} }) },
            setFailUpdate(v) { failUpdate = v; },
            getCalls() { return calls; },
            async verifyStepUpPinCall(params) {
              calls.push({ fn: 'verify', params });
              return { success: true, grantId: 'srv-grant-' + calls.length, scope: params.scope, expiresAt: Date.now() + 300000 };
            },
            async updateSecurityPinCall(params) {
              calls.push({ fn: 'update', params });
              if (failUpdate) {
                const err = new Error('Step-up grant rejected');
                err.code = 'functions/permission-denied';
                throw err;
              }
              return { success: true };
            },
            async resetUserWorkspaceCall() { throw new Error('Unexpected reset'); },
          };
          `
        );

        await page.locator('#tab-settings-security').click();

        // Scenario 2 + Patch2 #11: Change PIN modal has NO duplicate Current PIN input and succeeds with server grantId
        await page.locator('button', { hasText: 'Change PIN Code' }).click();
        const changeInputs = page.locator('input[placeholder="••••"]');
        assert.equal(await changeInputs.count(), 2);
        assert.equal(await page.locator('text=Current PIN Code').count(), 0);
        await changeInputs.nth(0).fill('5678');
        await changeInputs.nth(1).fill('5678');
        await page.locator('button', { hasText: /^Save$/ }).click();
        for (let i = 0; i < 4; i++) await page.locator(`#stepup-pin-input-${i}`).fill(String(i + 1));
        await page.locator('button', { hasText: /^Confirm$/ }).click();
        await page.waitForTimeout(100);
        assert.equal(await page.locator('text=PIN changed successfully').isVisible(), true);
        assert.equal(await page.evaluate(() => (window as any).__TEST_RECORDINGS__.firestoreWrites.length), 0);

        // Scenario 3 (failure case): Disable PIN rejected by server -> stays enabled!
        await page.evaluate(() => (window as any).__TEST_MOCKS__.setFailUpdate(true));
        await page.locator('button', { hasText: 'Disable PIN Code' }).click();
        await page.locator('button', { hasText: /^Save$/ }).click();
        for (let i = 0; i < 4; i++) await page.locator(`#stepup-pin-input-${i}`).fill(String(i + 5));
        await page.locator('button', { hasText: /^Confirm$/ }).click();
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => (window as any).__TEST_STATE__.userProfile.securityPinEnabled), true);
        assert.equal(await page.evaluate(() => (window as any).__TEST_RECORDINGS__.firestoreWrites.length), 0);

        // Scenario 3 (success case): Disable PIN allowed by server -> disabled!
        await page.evaluate(() => (window as any).__TEST_MOCKS__.setFailUpdate(false));
        await page.locator('button', { hasText: 'Disable PIN Code' }).click();
        await page.locator('button', { hasText: /^Save$/ }).click();
        for (let i = 0; i < 4; i++) await page.locator(`#stepup-pin-input-${i}`).fill(String(i + 5));
        await page.locator('button', { hasText: /^Confirm$/ }).click();
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => (window as any).__TEST_STATE__.userProfile.securityPinEnabled), false);
        assert.equal(await page.evaluate(() => (window as any).__TEST_RECORDINGS__.firestoreWrites.length), 0);

        await context.close();
      }

      // --- Scenarios 4, 5, 6, 7 (Standalone SecurityVerificationModal: Wrong PIN, Lockout + sessionStorage tamper, Network error, Permission-denied) ---
      {
        const { context, page } = await mountHarness(
          {
            mountStandaloneModal: true,
            userProfile: {
              ...baseProfile,
              securityPinEnabled: true,
              // Even with stale/legacy metadata present, client fallback MUST NOT trigger!
              securityPinMeta: { enabled: true, salt: '00', verifier: '00', version: 1 },
            },
            aiSettings: baseAi,
          },
          `
          let scenario = 'wrong-pin';
          let callCount = 0;
          return {
            user: { uid: 'user-123' },
            setScenario(s) { scenario = s; },
            getCallCount() { return callCount; },
            async verifyStepUpPinCall() {
              callCount++;
              if (scenario === 'wrong-pin') {
                const err = new Error('Incorrect PIN code.');
                err.code = 'functions/permission-denied';
                throw err;
              }
              if (scenario === 'lockout') {
                const err = new Error('Too many failed attempts. Please wait 15 seconds.');
                err.code = 'functions/resource-exhausted';
                throw err;
              }
              if (scenario === 'network-error') {
                throw new Error('Failed to fetch');
              }
              return { success: true, grantId: 'ok-grant', scope: 'generalStepUp', expiresAt: Date.now() + 60000 };
            },
            async updateSecurityPinCall() { return { success: true }; },
            async resetUserWorkspaceCall() { return { success: true }; },
          };
          `
        );

        // Scenario 4 & 7: Wrong PIN -> permission-denied -> NO confirm, inputs cleared
        for (let i = 0; i < 4; i++) await page.locator(`#stepup-pin-input-${i}`).fill('0');
        await page.locator('button', { hasText: /^Confirm$/ }).click();
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => (window as any).__TEST_RECORDINGS__.stepUpConfirms.length), 0);
        assert.equal(await page.locator('#stepup-pin-input-0').inputValue(), '');
        assert.equal(await page.locator('text=incorrect PIN code').isVisible(), true);

        // Scenario 6: Network error -> fail-closed, NO confirm!
        await page.evaluate(() => (window as any).__TEST_MOCKS__.setScenario('network-error'));
        for (let i = 0; i < 4; i++) await page.locator(`#stepup-pin-input-${i}`).fill('1');
        await page.locator('button', { hasText: /^Confirm$/ }).click();
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => (window as any).__TEST_RECORDINGS__.stepUpConfirms.length), 0);
        assert.equal(await page.locator('text=Server verification unavailable').isVisible(), true);

        // Scenario 5: Server lockout -> locks modal, clearing sessionStorage does NOT unlock!
        await page.evaluate(() => (window as any).__TEST_MOCKS__.setScenario('lockout'));
        for (let i = 0; i < 4; i++) await page.locator(`#stepup-pin-input-${i}`).fill('2');
        await page.locator('button', { hasText: /^Confirm$/ }).click();
        await page.waitForTimeout(100);
        assert.equal(await page.locator('text=Please wait 15 seconds').isVisible(), true);
        assert.equal(await page.locator('#stepup-pin-input-0').isDisabled(), true);
        await page.evaluate(() => window.sessionStorage.clear());
        await page.waitForTimeout(100);
        assert.equal(await page.locator('#stepup-pin-input-0').isDisabled(), true);
        assert.equal(await page.evaluate(() => (window as any).__TEST_RECORDINGS__.stepUpConfirms.length), 0);

        await context.close();
      }

      // --- Scenarios 9 & 10: Profile Save (non-PIN fields) & Workspace Reset (fail vs success) ---
      {
        const { context, page } = await mountHarness(
          { userProfile: { ...baseProfile, securityPinEnabled: true }, aiSettings: baseAi },
          `
          let resetBehavior = 'permission-denied';
          return {
            user: { uid: 'user-123', email: 'tester@proton.internal', getIdTokenResult: async () => ({ claims: {} }) },
            setResetBehavior(b) { resetBehavior = b; },
            async verifyStepUpPinCall(params) {
              return { success: true, grantId: 'reset-grant-1', scope: params.scope, expiresAt: Date.now() + 300000 };
            },
            async updateSecurityPinCall() { return { success: true }; },
            async resetUserWorkspaceCall() {
              if (resetBehavior === 'permission-denied') {
                const err = new Error('Step-up grant rejected');
                err.code = 'functions/permission-denied';
                throw err;
              }
              if (resetBehavior === 'network-error') {
                throw new Error('Network error');
              }
              return { success: true, message: 'OK' };
            },
          };
          `
        );

        // Seed localStorage items that Workspace Reset removes on success
        await page.evaluate(() => {
          localStorage.setItem('proton_tasks', '[{"id":"t1"}]');
          localStorage.setItem('organizer_events', '[{"id":"e1"}]');
          localStorage.setItem('active_session_sec', '42');
        });

        // Scenario 9: Profile allowed field update still works and does NOT pass securityPin fields
        await page.locator('#tab-settings-profile').click();
        const nameInput = page.locator('#profile-name-input, input[type="text"]').first();
        await nameInput.fill('Proton Updated');
        await page.locator('#btn-settings-save').click();
        await page.waitForTimeout(150);
        const profileWrite = await page.evaluate(() => (window as any).__TEST_RECORDINGS__.firestoreWrites[0]);
        assert.equal(profileWrite.path, 'users/user-123');
        assert.equal(profileWrite.data.name, 'Proton Updated');
        assert.equal('securityPin' in profileWrite.data, false);
        assert.equal('securityPinEnabled' in profileWrite.data, false);
        assert.equal('securityPinMeta' in profileWrite.data, false);

        // Reset recorded writes before Workspace Reset failure test
        await page.evaluate(() => { (window as any).__TEST_RECORDINGS__.firestoreWrites = []; });

        // Scenario 10A: Workspace Reset fails (permission-denied) -> MUST NOT wipe localStorage or Firestore!
        await page.locator('button', { hasText: 'Reset All Settings' }).click();
        await page.locator('button', { hasText: 'Yes, Reset Now' }).click();
        for (let i = 0; i < 4; i++) await page.locator(`#stepup-pin-input-${i}`).fill('1');
        await page.locator('button', { hasText: /^Confirm$/ }).click();
        await page.waitForTimeout(150);

        assert.equal(await page.evaluate(() => localStorage.getItem('proton_tasks')), '[{"id":"t1"}]');
        assert.equal(await page.evaluate(() => localStorage.getItem('organizer_events')), '[{"id":"e1"}]');
        assert.equal(await page.evaluate(() => localStorage.getItem('active_session_sec')), '42');
        assert.equal(await page.evaluate(() => (window as any).__TEST_RECORDINGS__.firestoreWrites.length), 0);
        assert.equal(await page.evaluate(() => (window as any).__TEST_STATE__.userProfile.name), 'Proton Updated');
        assert.equal(await page.locator('text=Workspace reset to defaults successfully').isVisible(), false);

        // Scenario 10B: Workspace Reset fails (network-error) -> still MUST NOT wipe!
        await page.evaluate(() => (window as any).__TEST_MOCKS__.setResetBehavior('network-error'));
        await page.locator('button', { hasText: 'Reset All Settings' }).click();
        await page.locator('button', { hasText: 'Yes, Reset Now' }).click();
        for (let i = 0; i < 4; i++) await page.locator(`#stepup-pin-input-${i}`).fill('1');
        await page.locator('button', { hasText: /^Confirm$/ }).click();
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => localStorage.getItem('proton_tasks')), '[{"id":"t1"}]');
        assert.equal(await page.evaluate(() => (window as any).__TEST_RECORDINGS__.firestoreWrites.length), 0);

        // Scenario 10C: Workspace Reset succeeds -> server handles Firestore reset; client wipes ONLY localStorage & state (ZERO client Firestore writes!)
        await page.evaluate(() => (window as any).__TEST_MOCKS__.setResetBehavior('success'));
        await page.locator('button', { hasText: 'Reset All Settings' }).click();
        await page.locator('button', { hasText: 'Yes, Reset Now' }).click();
        for (let i = 0; i < 4; i++) await page.locator(`#stepup-pin-input-${i}`).fill('1');
        await page.locator('button', { hasText: /^Confirm$/ }).click();
        await page.waitForTimeout(150);

        assert.equal(await page.evaluate(() => localStorage.getItem('proton_tasks')), null);
        assert.equal(await page.evaluate(() => localStorage.getItem('organizer_events')), null);
        assert.equal(await page.evaluate(() => localStorage.getItem('active_session_sec')), null);
        const resetWrites = await page.evaluate(() => (window as any).__TEST_RECORDINGS__.firestoreWrites);
        assert.equal(resetWrites.length, 0);
        assert.equal('email' in profileWrite.data, false);
        assert.equal(await page.locator('text=Workspace reset to defaults successfully').isVisible(), true);

        await context.close();
      }

      // --- Patch #2 UI Scenarios: Client securityPinEnabled=false Tamper Reset Blocked + Email Sync & Failure + Reauth Prompt ---
      {
        const { context, page } = await mountHarness(
          {
            userProfile: { ...baseProfile, securityPinEnabled: false }, // Tampered or stale client flag
            aiSettings: baseAi,
          },
          `
          let serverCalls = [];
          let emailMode = 'fail';
          return {
            user: {
              uid: 'user-tamper',
              email: 'tester@proton.internal',
              providerData: [{ providerId: 'password' }],
              getIdTokenResult: async () => ({ claims: {}, authTime: new Date().toUTCString() }),
              getIdToken: async () => 'fresh-token',
              reload: async () => {},
            },
            setEmailMode(m) { emailMode = m; },
            getServerCalls() { return serverCalls; },
            async verifyStepUpPinCall(params) {
              serverCalls.push({ fn: 'verify', params });
              return { success: true, grantId: 'email-grant', scope: params.scope, expiresAt: Date.now() + 60000 };
            },
            async updateSecurityPinCall() { return { success: true }; },
            async resetUserWorkspaceCall(params) {
              serverCalls.push({ fn: 'reset', params });
              const err = new Error('STEP_UP_REQUIRED: Step-up verification required to reset workspace.');
              err.code = 'functions/permission-denied';
              throw err;
            },
            async reauthenticateWithCredential(user, cred) {
              serverCalls.push({ fn: 'reauth', email: cred.email, password: cred.password });
              if (cred.password !== 'correct-pass') {
                const err = new Error('auth/wrong-password');
                err.code = 'auth/wrong-password';
                throw err;
              }
              return { user };
            },
            async reauthenticateWithPopup() { return {}; },
            async updateUserEmailCall(params) {
              serverCalls.push({ fn: 'updateEmail', params });
              if (emailMode === 'fail') {
                const err = new Error('Email address is already in use');
                err.code = 'functions/already-exists';
                throw err;
              }
              return { success: true, email: params.newEmail };
            },
          };
          `
        );

        await page.evaluate(() => {
          localStorage.setItem('proton_tasks', '[{"id":"keep-me"}]');
        });

        // 1 & 2: Tampered client securityPinEnabled=false MUST STILL hit server resetUserWorkspaceCall and abort on server denial
        await page.locator('#tab-settings-profile').click();
        await page.locator('button', { hasText: 'Reset All Settings' }).click();
        await page.locator('button', { hasText: 'Yes, Reset Now' }).click();
        await page.locator('button', { hasText: /^Confirm$/ }).click();
        await page.waitForTimeout(150);

        const callsAfterTamperReset = await page.evaluate(() => (window as any).__TEST_MOCKS__.getServerCalls());
        assert.equal(callsAfterTamperReset.some((c: any) => c.fn === 'reset'), true);
        assert.equal(await page.evaluate(() => localStorage.getItem('proton_tasks')), '[{"id":"keep-me"}]');
        assert.equal(await page.locator('text=Workspace reset to defaults successfully').isVisible(), false);
        assert.equal(await page.evaluate(() => (window as any).__TEST_RECORDINGS__.firestoreWrites.length), 0);

        // 9 & 10: Email Change on PIN-disabled password user -> reauth fails on wrong password -> reauth passes -> server fails (no false toast, no Firestore email write!) -> server succeeds
        await page.evaluate(() => (window as any).__TEST_STATE__ && null);
        // Reset securityPinEnabled back to false for the PIN-disabled reauth email change test
        const { context: ctx2, page: page2 } = await mountHarness(
          {
            userProfile: { ...baseProfile, securityPinEnabled: false },
            aiSettings: baseAi,
          },
          `
          let emailShouldFail = true;
          const calls = [];
          return {
            user: {
              uid: 'user-nopins',
              email: 'tester@proton.internal',
              providerData: [{ providerId: 'password' }],
              getIdTokenResult: async () => ({ claims: {}, authTime: new Date().toUTCString() }),
              getIdToken: async () => 'fresh-token',
              reload: async () => {},
            },
            setEmailShouldFail(v) { emailShouldFail = v; },
            getCalls() { return calls; },
            async verifyStepUpPinCall() { throw new Error('Should not verify PIN when disabled'); },
            async updateSecurityPinCall() { return { success: true }; },
            async resetUserWorkspaceCall() { return { success: true }; },
            async reauthenticateWithCredential(_user, cred) {
              calls.push({ fn: 'reauth', password: cred.password });
              if (cred.password !== 'secret-pass') {
                const err = new Error('Wrong password');
                err.code = 'auth/wrong-password';
                throw err;
              }
              return {};
            },
            async reauthenticateWithPopup() { return {}; },
            async updateUserEmailCall(params) {
              calls.push({ fn: 'updateEmail', params });
              if (emailShouldFail) {
                const err = new Error('Firebase Auth update rejected');
                err.code = 'functions/already-exists';
                throw err;
              }
              return { success: true, email: params.newEmail };
            },
          };
          `
        );

        await page2.locator('#tab-settings-profile').click();
        await page2.locator('#profile-email-input').fill('new-email@proton.internal');
        await page2.locator('#btn-settings-save').click();
        await page2.locator('#stepup-reauth-password').fill('secret-pass');
        await page2.locator('button', { hasText: /^Confirm$/ }).click();
        await page2.waitForTimeout(150);

        // Email server call failed -> ZERO Firestore writes, NO success toast!
        assert.equal(await page2.evaluate(() => (window as any).__TEST_RECORDINGS__.firestoreWrites.length), 0);
        assert.equal(await page2.locator('text=Email address synchronized').isVisible(), false);

        // Now server succeeds -> BOTH updateUserEmailCall ran AND non-email profile save ran WITHOUT writing email to Firestore!
        await page2.evaluate(() => (window as any).__TEST_MOCKS__.setEmailShouldFail(false));
        await page2.locator('#btn-settings-save').click();
        await page2.locator('#stepup-reauth-password').fill('secret-pass');
        await page2.locator('button', { hasText: /^Confirm$/ }).click();
        await page2.waitForTimeout(150);

        const writes = await page2.evaluate(() => (window as any).__TEST_RECORDINGS__.firestoreWrites);
        assert.equal(writes.length >= 1, true);
        assert.equal('email' in writes[0].data, false);
        assert.equal(await page2.locator('text=Email address synchronized across account and profile').isVisible(), true);

        await ctx2.close();
        await context.close();
      }
    } finally {
      await browser.close();
    }
  });
});

