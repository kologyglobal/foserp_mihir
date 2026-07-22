# Manufacturing Phase 5C — Corrections, Reversals and Transaction Hardening

**Status:** Shipped (2026-07-20)  
**Depends on:** Phases 2A–5B, Inventory 3A, Quality 4A, Job Work 4B

## Principle

Posted transactions are **immutable**. Corrections create compensating transactions + reversal links + audit — never `UPDATE`/`DELETE` ledger or stock rows.

## API

Base: `/api/v1/t/:tenantSlug/manufacturing/corrections`

| Method | Path | Permission |
|--------|------|------------|
| GET | `/` | `correction.view` |
| POST | `/preview` | `correction.request` |
| POST | `/` | `correction.request` |
| GET/PATCH | `/:id` | view / request |
| POST | `/:id/submit\|approve\|reject\|apply\|cancel` | request / approve / reject / apply |
| GET | `/:id/dependencies` | view |
| GET | `/transactions/:entityType/:entityId/correction-history` | view |

## Supported handlers

| Type | Behaviour |
|------|-----------|
| `PRODUCTION_PROGRESS` | Wraps Stage Ledger REVERSAL + CORRECTION (2A) |
| `MATERIAL_ISSUE` / `ADDITIONAL_MATERIAL_ISSUE` | Compensating `RETURN_FROM_WO` |
| `MATERIAL_RETURN` | Re-issue `ISSUE_TO_WO` |
| `WIP_MOVEMENT` / `MATERIAL_TRANSFER` | Compensating WIP movement + stock swap |
| `FG_RECEIPT` | Compensating ISSUE; stock-availability blockers |
| `JOB_WORK_DISPATCH` | `SUBCON_IN` compensate; blocked if receipts exist |
| `JOB_WORK_RECEIPT` | Compensating issue; QC/AP warnings |
| `WORK_ORDER_SPLIT` | Policy blocker (split not shipped) |
| `QUALITY_DECISION` | Supersede policy — no overwrite |
| `RESERVATION_TRANSFER` / batch DP | Policy / guided blockers |

Approval is **manufacturing-local** (same pattern as Phase 5A / ADR-035) — not Finance GL approval.

## Frontend

- Register: `/manufacturing/corrections`
- `CorrectionDrawer` on API WO detail
- Accounting/CRM list styling

## Tests

```bash
cd backend && npx vitest run tests/manufacturing-phase5c.test.ts
```

## Deferred

WO merge, automatic cascade reversal, costing/WIP valuation, manufacturing GL, OEE, MRP/scheduling.

## Accepted depth limits (gate for Phase 6A)

**Accepted 2026-07-20** before Production Planning (Phase 6A):

| Limit | Meaning |
|-------|---------|
| **WO split feature** | Split correction remains a hard policy blocker until a real WO split feature ships. Merge stays deferred. |
| **No cascade reverse** | Corrections do not auto-reverse dependent documents; operator handles dependent steps via guided/manual corrections. |
| **No manufacturing GL** | 5C does not reverse Finance vouchers / manufacturing accounting posts. Costing + `MANUFACTURING_ACCOUNTING` remain Phase 6B+. |

These limits are product acceptance, not bugs.
