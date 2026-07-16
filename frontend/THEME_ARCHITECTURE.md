# Theme Architecture

## Layers

```
dynamics-tokens.css     ← CSS source of truth (:root --dyn-*)
        ↓
design-system/theme/    ← TS token mirror (var references)
        ↓
ThemeProvider           ← React context + ds-root wrapper
        ↓
design-system/styles.css← Typography utilities
        ↓
Tailwind erp-* config   ← Utility classes
        ↓
Components              ← Consume tokens only
```

## ThemeProvider

Located at `src/design-system/ThemeProvider.tsx`. Wired in `main.tsx`.

Provides:
- `useTheme()` — theme + density
- `useDesignTokens()` — full token object for charts

## Changing the theme

1. Edit `src/styles/dynamics-tokens.css`
2. All `--erp-*` bridges update automatically
3. Design system components re-render with new values
4. Sync `erpTokens` hex in `styles/tokens.ts` for chart libraries

## Density

`ThemeProvider density="compact"` sets `data-density` on root for future compact mode.
