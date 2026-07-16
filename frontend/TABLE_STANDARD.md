# Table Standard

## Component

Use `DataTable` from `design-system` — wraps `DataGrid` (TanStack Table).

## Required features (built-in)

- Search
- Column filters
- Sort
- Pagination
- Column chooser
- CSV export
- Row selection (optional)
- Status badges via column cell renderers
- Responsive horizontal scroll

## Rules

- Never implement custom `<table>` layouts in module pages
- Use `LoadingState variant="table"` while fetching
- Use `EmptyState` when zero rows
- Row actions in trailing column with `Button variant="ghost"`

## Import migration

```tsx
// Preferred
import { DataTable } from '../../design-system'

// Legacy (still works)
import { DataTable } from '../../components/tables/DataTable'
```
