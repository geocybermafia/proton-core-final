import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AuthFlow,
  EMAIL_REGISTRATION_SUCCESS_DELAY_MS,
  canSubmitAuthForm,
  executeEmailSignup,
  getEmailRegistrationSuccessMessage,
} from '../src/components/AuthFlow.js';

describe('PROTON Email Registration Completion Flow', () => {
  it('1. Returns clear Georgian success message and uses ~1s delay constant', () => {
    assert.equal(EMAIL_REGISTRATION_SUCCESS_DELAY_MS, 1000);
    assert.equal(
      getEmailRegistrationSuccessMessage('ka'),
      'რეგისტრაცია წარმატებით დასრულდა!'
    );
    assert.equal(
      getEmailRegistrationSuccessMessage('en'),
      'Registration completed successfully!'
    );
  });

  it('2. Shows success state and schedules modal close after delay only after registration succeeds', async () => {
    const events: string[] = [];
    let scheduledDelay: number | null = null;
    let successMessage = '';
    let modalClosed = false;

    const ok = await executeEmailSignup({
      register: async () => {
        events.push('register');
      },
      language: 'ka',
      onSuccess: (message) => {
        events.push('onSuccess');
        successMessage = message;
      },
      onScheduleClose: (delayMs) => {
        events.push('onScheduleClose');
        scheduledDelay = delayMs;
        setTimeout(() => {
          modalClosed = true;
        }, 10);
      },
    });

    assert.equal(ok, true);
    assert.deepEqual(events, ['register', 'onSuccess', 'onScheduleClose']);
    assert.equal(successMessage, 'რეგისტრაცია წარმატებით დასრულდა!');
    assert.equal(scheduledDelay, 1000);
    assert.equal(modalClosed, false, 'Modal must stay open briefly while success message is shown');

    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(modalClosed, true, 'Modal close callback runs after timer expires');
  });

  it('3. Does not show success state or schedule modal close when registration fails', async () => {
    let onSuccessCalled = false;
    let onScheduleCloseCalled = false;

    await assert.rejects(
      () =>
        executeEmailSignup({
          register: async () => {
            throw new Error('Firebase: Error (auth/email-already-in-use).');
          },
          language: 'ka',
          onSuccess: () => {
            onSuccessCalled = true;
          },
          onScheduleClose: () => {
            onScheduleCloseCalled = true;
          },
        }),
      /auth\/email-already-in-use/
    );

    assert.equal(onSuccessCalled, false);
    assert.equal(onScheduleCloseCalled, false);
  });

  it('4. Prevents duplicate submits while loading or after registrationSucceeded is true', () => {
    assert.equal(canSubmitAuthForm(false, false), true);
    assert.equal(canSubmitAuthForm(true, false), false);
    assert.equal(canSubmitAuthForm(false, true), false);
    assert.equal(canSubmitAuthForm(true, true), false);
  });

  it('5. Renders AuthFlow cleanly in KA and preserves App.tsx onBack modal close wiring', () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthFlow, {
        onGoogleSignIn: () => {},
        onBack: () => {},
        language: 'ka',
      })
    );
    assert.match(html, /ავტორიზაცია/);
    assert.match(html, /უკან/);

    const authFlowSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AuthFlow.tsx'),
      'utf8'
    );
    const appSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/App.tsx'),
      'utf8'
    );

    assert.match(authFlowSrc, /createUserWithEmailAndPassword\(auth, email, password\)/);
    assert.match(authFlowSrc, /setRegistrationSucceeded\(true\)/);
    assert.match(authFlowSrc, /setRegistrationSucceeded\(false\)/);
    assert.match(authFlowSrc, /disabled=\{!canSubmitAuthForm\(loading, registrationSucceeded\)\}/);
    assert.match(appSrc, /onBack=\{\(\) => setShowAuth\(false\)\}/);
  });
});
