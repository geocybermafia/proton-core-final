import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('Organizer Scroll Architecture & Single Scrollbar Verification', async (t) => {
  const indexCss = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf-8');
  const appTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
  const organizerTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/components/OrganizerView.tsx'), 'utf-8');

  await t.test('1. index.css does not enforce min-height: 100vh on html, body, #root', () => {
    // Ensuring min-height: 100vh is removed from html, body, #root to prevent false viewport overflow
    const rootRuleMatch = indexCss.match(/html,\s*body,\s*#root\s*\{([^}]+)\}/);
    assert.ok(rootRuleMatch, 'html, body, #root rule exists in index.css');
    const ruleContent = rootRuleMatch[1];
    assert.ok(!ruleContent.includes('min-height: 100vh'), 'min-height: 100vh must not be present on html, body, #root');
    assert.ok(ruleContent.includes('height: 100%'), 'height: 100% is present');
  });

  await t.test('2. App.tsx main element is constrained with min-h-0, h-full, and overflow-hidden', () => {
    // The <main> wrapper must be constrained so flex children cannot cause outer expansion
    assert.ok(
      appTsx.includes('<main className="flex-1 min-w-0 min-h-0 h-full flex flex-col relative bg-proton-bg w-full overflow-hidden">'),
      '<main> element must have flex-1 min-w-0 min-h-0 h-full flex flex-col relative bg-proton-bg w-full overflow-hidden'
    );
  });

  await t.test('3. App.tsx locks document-level scrollbar in authenticated app shell', () => {
    assert.ok(
      appTsx.includes("if (activeView !== 'landing')"),
      'App.tsx checks activeView !== landing to lock document scrolling'
    );
    assert.ok(
      appTsx.includes("document.documentElement.style.overflow = 'hidden'"),
      'App.tsx sets documentElement overflow to hidden'
    );
    assert.ok(
      appTsx.includes("document.body.style.overflow = 'hidden'"),
      'App.tsx sets body overflow to hidden'
    );
  });

  await t.test('4. App.tsx #main-scroll-container is the single authoritative scroll container', () => {
    assert.ok(
      appTsx.includes('id="main-scroll-container"'),
      '#main-scroll-container element exists'
    );
    assert.ok(
      appTsx.includes('overflow-y-auto overscroll-y-contain custom-scrollbar-minimal'),
      '#main-scroll-container has overflow-y-auto overscroll-y-contain custom-scrollbar-minimal'
    );
  });

  await t.test('5. OrganizerView outer container does not introduce competing top-level overflow-y', () => {
    // Root of OrganizerView should not have overflow-y-auto
    const rootLine = organizerTsx.slice(0, 3000);
    assert.ok(
      !rootLine.includes('max-w-7xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 transition-colors duration-500 overflow-y-auto'),
      'OrganizerView root container does not have redundant overflow-y-auto'
    );
  });
});
