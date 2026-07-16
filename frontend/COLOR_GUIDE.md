# Color Guide

## Source of truth

Runtime colors: `src/styles/dynamics-tokens.css`  
Programmatic access: `src/design-system/theme/colors.ts`

## Palette

| Token | CSS variable | Usage |
|-------|--------------|-------|
| Primary Navy | `--dyn-navy` | Save buttons, suite bar |
| Primary Blue | `--dyn-primary` | Links, focus, hover |
| Success | `--dyn-success` | Approved, completed |
| Warning | `--dyn-warning` | Pending, overdue |
| Danger | `--dyn-critical` | Rejected, blocked |
| Info | `--dyn-info` | Open, informational |
| Background | `--dyn-bg-app` | Page background |
| Surface | `--dyn-bg-card` | Cards, panels |
| Sidebar | `--dyn-bg-sidebar` | Navigation |
| Border | `--dyn-border` | Dividers, inputs |

## Rules

- Components reference `var(--dyn-*)` only
- Charts may use `erpTokens.color.*` hex values synced to Dynamics palette
- Status colors go through `StatusBadge` + `STATUS_MAP`
