# Proton — End-to-End (E2E) Testing Guide & Documentation
# ავტომატური E2E ტესტირების სრული გზამკვლევი

ეს დოკუმენტი წარმოადგენს Proton პლატფორმის Playwright-ზე დაფუძნებული End-to-End (E2E) ტესტირების ინსტრუქციას.

---

## 📁 დირექტორიის სტრუქტურა (Directory Structure)

```
tests/e2e/
├── fixtures/
│   └── auth.fixture.ts        # Page Object, ავტორიზაციის დამხმარე მეთოდები და სესიის გასუფთავება
├── step-up-auth.spec.ts       # Zero-Trust Step-Up PIN ვერიფიკაციის ტესტები
├── clips-commerce.spec.ts     # Shoppable Clips და კალათის რაოდენობის მთვლელის ტესტები
└── README.md                  # E2E ტესტირების სრული გაიდი (ეს ფაილი)
```

---

## ⚙️ Playwright კონფიგურაცია (`playwright.config.ts`)

ფაილი `playwright.config.ts` კონფიგურირებულია შემდეგი პარამეტრებით:

1. **პარალელური გაშვება (`fullyParallel: true`):**
   * ყველა ტესტი ეშვება იზოლირებულად და პარალელურ ნაკადებში მაქსიმალური სისწრაფისთვის.
2. **ჩავარდნილი ტესტების ვიდეო ჩაწერა (`video: 'retain-on-failure'`):**
   * თუ ტესტი წარმატებით დასრულდა, დროებითი ვიდეო იშლება დისკის დასაზოგად.
   * თუ ტესტი ჩავარდა (Failed), Playwright ინახავს ეკრანის ვიდეოჩანაწერს, სქრინშოტს (`screenshot: 'only-on-failure'`) და ქსელის დეტალურ Trace-ს (`trace: 'retain-on-failure'`).
3. **მრავალპლატფორმიანი ბრაუზერები (`projects`):**
   * `chromium` (Google Chrome / Chromium)
   * `firefox` (Mozilla Firefox)
   * `webkit` (Apple Safari)
   * `Mobile Chrome` (მობილური ემულაცია Pixel 5)
4. **ავტომატური ლოკალური სერვერი (`webServer`):**
   * ტესტების გაშვებისას Playwright ავტომატურად უშვებს `npm run dev`-ს პორტზე `3000`.

---

## 🚀 როგორ გავუშვათ ტესტები (Running Tests)

### 1. ყველა ტესტის გაშვება ფონურ (Headless) რეჟიმში:
```bash
npm run test:e2e
```
ან პირდაპირ Playwright CLI-ით:
```bash
npx playwright test
```

### 2. ვიზუალური UI რეჟიმი (Interactive UI Mode - საუკეთესოა დეველოპმენტისა და დემოსთვის):
```bash
npx playwright test --ui
```
*ამ რეჟიმში შეგიძლიათ თვალი ადევნოთ თითოეულ ნაბიჯს, გადაახვიოთ დროში (Time Travel Debugging) და ნახოთ DOM-ის მდგომარეობა.*

### 3. კონკრეტული ტესტ-ფაილის გაშვება:
```bash
# მხოლოდ Step-Up PIN უსაფრთხოების ტესტი
npx playwright test tests/e2e/step-up-auth.spec.ts

# მხოლოდ Clips კომერციის ტესტი
npx playwright test tests/e2e/clips-commerce.spec.ts
```

### 4. ტესტების გაშვება ხილულ ბრაუზერში (Headed Mode):
```bash
npx playwright test --headed
```

---

## 📹 რეპორტებისა და ჩაწერილი ვიდეოების ნახვა (Viewing Reports & Videos)

ტესტების დასრულების შემდეგ გენერირდება ინტერაქტიული HTML რეპორტი:

```bash
npx playwright show-report
```

თუ რომელიმე ტესტი ჩავარდება:
1. ბრაუზერში გაიხსნება რეპორტის გვერდი.
2. ჩავარდნილი ტესტის დეტალებში გამოჩნდება **Video** და **Trace** სექცია.
3. შეგეძლებათ ვიდეოს პირდაპირ ბრაუზერში დაკვრა, რათა ზუსტად დაინახოთ რა მომენტში და რატომ წარმოიშვა შეცდომა.

---

## 🛡️ ახალი ტესტის დამატება (Adding New Tests)

ახალი ტესტის შესაქმნელად გამოიყენეთ `fixtures/auth.fixture.ts`:

```typescript
import { test, expect } from './fixtures/auth.fixture';

test.describe('My New Feature Suite', () => {
  test('User can perform action', async ({ protonApp, page }) => {
    // ნავიგაცია პარამეტრებში
    await protonApp.gotoSettings();
    
    // ჩანართის შეცვლა
    await protonApp.switchSettingsTab('security');
    
    // ლოკატორების შემოწმება
    await expect(page.locator('#settings-view-root')).toBeVisible();
  });
});
```
