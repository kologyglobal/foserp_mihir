# Typography Guide

## Font stack

```
Segoe UI → Inter → Roboto → Helvetica Neue → Arial → sans-serif
```

Monospace: `Cascadia Mono, Consolas, Courier New`

## Roles

| Role | CSS class | Token |
|------|-----------|-------|
| Page Title | `.ds-type-page-title` | `--dyn-font-page` |
| Workspace Title | `.ds-type-workspace-title` | `--dyn-font-title` |
| Section Title | `.ds-type-section-title` | `--dyn-font-section` |
| Card Title | `.ds-type-card-title` | `--dyn-font-sm` |
| Table Header | `.ds-type-table-header` | `--dyn-font-xs` |
| Body | `.ds-type-body` | `--dyn-font-body` |
| Caption | `.ds-type-caption` | `--dyn-font-xs` |
| Helper | `.ds-type-helper` | `--dyn-font-micro` |
| Button | `.ds-type-button` | `--dyn-font-sm` |
| KPI Number | `.ds-type-kpi` | `--dyn-font-kpi` |

## Rules

- Never set `font-size` or `font-weight` inline in page components
- Use `useTypographyClass('sectionTitle')` for dynamic class names
- KPI values use tabular numerals for alignment
