# Delivery Challan Numbering

**Policy:** `NUMBER_ON_ISSUE` (default)

## Series

- Entity: `CodeSeriesEntity.DELIVERY_CHALLAN`
- Prefix: `DC` (via `codeSeries.service.ts`)
- Scope: tenant (+ legal-entity where series is configured)

## Behaviour

| Event | Number |
|-------|--------|
| Draft create | No official number |
| Issue | Allocate next `DC-######` in same DB transaction |
| Issue retry (idempotent) | Same number; no second allocation |
| Cancel / supersede | Original number retained on historical document |
| Replacement issue | New number for new version (original preserved) |

## Forbidden

- Frontend-generated numbers
- `count + 1` outside number-series service
- Timestamp-only or random official numbers
- Reusing cancelled official numbers for a different document identity
