# Design System Guide

## Overview

Vasant Trailer ERP uses a **centralized design system** at `src/design-system/`. All UI changes should flow through this layer — inspired by Microsoft Dynamics 365 Business Central with modern SaaS refinements.

## Import convention

```tsx
import {
  ThemeProvider,
  Button,
  DataTable,
  FormLayout,
  FormSection,
  StatusBadge,
  EmptyState,
  HelpPanel,
} from '../design-system'
```

## Architecture

| Layer | Path | Purpose |
|-------|------|---------|
| Theme | `design-system/theme/` | Colors, typography, spacing, radius, shadows |
| Components | `design-system/components/` | Universal UI primitives |
| Hooks | `design-system/hooks/` | `useTheme`, `useDesignTokens`, typography helpers |
| Constants | `design-system/constants/` | Form sections, status map, button variants |
| Styles | `design-system/styles.css` | Typography utility classes |

## Rules

1. **No hardcoded hex** in components — use CSS variables (`var(--dyn-*)`)
2. **No per-page font sizes** — use `ds-type-*` classes or theme typography roles
3. **No custom tables** — use `DataTable` (wraps `DataGrid`)
4. **No custom form footers** — use `FooterActions` or `FormLayout`
5. **No blank pages** — use `EmptyState` with primary action
6. **One icon library** — Lucide React only

## ThemeProvider

Wrap the app once (done in `main.tsx`). Changing tokens in `dynamics-tokens.css` updates the entire ERP.

## Migration status

Existing pages continue to work via re-export wrappers. New pages **must** import from `design-system`. See `CENTRALIZED_UI_MIGRATION_REPORT.md`.
