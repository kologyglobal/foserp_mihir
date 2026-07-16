# Centralized UI Migration Report

Generated: 2026-06-29

## Summary

A centralized design system has been established at `src/design-system/` with theme tokens, universal components, ThemeProvider, and validation tests. Existing pages continue to work via re-export wrappers — **no breaking changes**.

## What was created

### Theme layer (`src/design-system/theme/`)
- `colors.ts` — CSS variable references only
- `spacing.ts` — 4px scale (4–64)
- `typography.ts` — Segoe UI stack + role scale
- `radius.ts`, `shadows.ts`, `zIndex.ts`, `breakpoints.ts`

### Components (`src/design-system/components/`)
30+ components including Button, Card, DataTable, FormLayout, StatusBadge, EmptyState, LoadingState, Modal, HelpPanel, FooterActions, KPI, FilterBar, and more.

### Infrastructure
- `ThemeProvider` wired in `main.tsx`
- `design-system/styles.css` imported in `index.css`
- `styles/tokens.ts` synced to Dynamics palette
- `ui/Button.tsx` migrated off hardcoded hex

### Tests
- `npm run test:design-system` — 34/34 checks
- `npm run test:ui` — aggregates design-system + UI audit suites

### Documentation
- DESIGN_SYSTEM_GUIDE.md
- TYPOGRAPHY_GUIDE.md
- COLOR_GUIDE.md
- COMPONENT_LIBRARY.md
- FORM_STANDARD.md
- TABLE_STANDARD.md
- THEME_ARCHITECTURE.md

## Migration phases

### Phase 0 — Complete ✓
Central hub with re-exports. ThemeProvider active.

### Phase 1 — In progress
Codemod imports in new features:
```tsx
// Before
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/tables/DataTable'

// After
import { Button, DataTable } from '../../design-system'
```

### Phase 2 — Planned
- Replace `ErpButton` usages with design-system `Button`
- Migrate `tables/DataTable` imports (~32 files)
- Consolidate 6 status badge variants → `StatusBadge`
- Remove duplicate CSS button classes

### Phase 3 — Planned
Physically move `components/ui/` and `components/design-system/` into `design-system/`

## Pages still on legacy imports

| Area | Count (approx) | Priority |
|------|----------------|----------|
| `components/ui/Button` | ~65 files | P1 |
| `components/tables/DataTable` | ~32 files | P1 |
| `ErpButton` / CRM forms | ~22 files | P2 |
| Custom status badges | ~6 variants | P2 |
| Inline hex colors | scattered | P3 |

## Validation checklist

| Check | Status |
|-------|--------|
| Central theme tokens | ✓ |
| ThemeProvider wraps app | ✓ |
| No hex in design-system components | ✓ |
| Universal DataTable export | ✓ |
| Universal FormLayout export | ✓ |
| Typography utilities | ✓ |
| test:design-system passes | ✓ |
| Full page migration | Pending |

## How to change the entire ERP look

1. Edit `src/styles/dynamics-tokens.css`
2. Components using `var(--dyn-*)` update automatically
3. Run `npm run test:design-system && npm run test:ui`
