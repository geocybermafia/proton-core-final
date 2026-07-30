# Changelog

## [Unreleased]

### UI Migration

#### Step 1 – ProtonCard Migration

Date: 2026-07-30

Files Modified:
- src/components/DashboardView.tsx

Summary:
- Migrated the Dashboard Hero container to ProtonCard.
- Preserved identical appearance.
- Preserved identical functionality.
- No behavior changes.
- No layout changes.
- Regression Risk: Very Low.
- Verification: Build passed successfully.

---

#### Step 2 – ProtonButton Migration

Date: 2026-07-30

Files Modified:
- src/ui/components/ProtonButton.tsx
- src/components/DashboardView.tsx

Summary:
- Migrated the Widget Visibility Toggle button to ProtonButton.
- Added fullWidth prop.
- Added justify prop.
- Improved complex JSX children rendering.
- Preserved identical appearance.
- Preserved identical functionality.
- No user-visible changes.
- Regression Risk: Low.
- Verification: TypeScript checks passed.
- Verification: Production build passed.

---

## Migration Statistics

Total UI Components Migrated:
- ProtonCard: 1
- ProtonButton: 1

Design System Progress:
- Cards: Started
- Buttons: Started
- Inputs: Pending
- Badges: Pending
- Modals: Pending
- Avatars: Pending
- Icon Containers: Pending

## Next Planned Steps

- Migrate one Dashboard input to ProtonInput.
- Migrate one Dashboard badge to ProtonBadge.
- Migrate one Dashboard modal to ProtonModal.
- Continue using only small, isolated migrations.
- Never refactor more than one visual component per migration.
