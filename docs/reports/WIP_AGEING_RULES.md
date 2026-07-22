# WIP Ageing Rules (Phase 7D)

**Executor:** `ops-reports/executors/wip-ageing.ts` · **Report key:** `wip-ageing`
**Helpers:** `AGE_BUCKETS`, `ageDaysToBucket`, `ageInDays` in `executors/helpers.ts`.

Buckets in-progress stages that are holding WIP by how long they have been open, so ageing
custody is visible without a valuation ledger.

---

## Scope

- Stages with `status` in `IN_PROGRESS` or `ON_HOLD` (optionally filtered by `workCentreId`).
- Bounded to 5000 stages per query.

## Age buckets (days)

`ageDaysToBucket(ageDays)`:

| Bucket | Rule |
|--------|------|
| `0-1` | age ≤ 1 |
| `2-3` | 1 < age ≤ 3 |
| `4-7` | 3 < age ≤ 7 |
| `8-15` | 7 < age ≤ 15 |
| `16-30` | 15 < age ≤ 30 |
| `30+` | age > 30 |

`ageInDays = floor((now − sourceDate) / 1 day)`, floored at 0. A bar chart of bucket counts is
returned in `chartData`.

## Date basis + fallback warning

- Primary basis: `stage.startedAt`.
- **Fallback:** when `startedAt` is null, age is computed from `stage.updatedAt`. The row's
  `ageSource` field then reads `updatedAt (fallback)` (vs `startedAt`), and the report emits a
  warning: `"<n> stage(s) had no startedAt — aged from updatedAt instead."`
- This keeps the age honest and flags rows whose age is approximate.

> Job Work Ageing (`job-work-ageing`) uses the same buckets, with basis `materialSentAt`
> (fallback `createdAt`) over job work orders not `CLOSED`/`CANCELLED`.
