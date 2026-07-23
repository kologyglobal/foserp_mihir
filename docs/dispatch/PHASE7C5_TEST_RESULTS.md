# Phase 7C5 — Test Results

**Date:** 2026-07-23  
**Suite:** `backend/tests/dispatch-phase7c5.test.ts`

## Command

```bash
cd backend && npx vitest run tests/dispatch-phase7c5.test.ts
```

## Results (live MySQL)

| Area | Result |
|------|--------|
| Gate blocks (reservation/pick/pack/challan) | PASS |
| Workbench confirm gated when hardened ON | PASS |
| Posting readiness blockers | PASS |
| Happy path reserve→pick→pack→issue→post | PASS |
| Auto DRAFT SI helper (flag opt-in ON in-test) | PASS |
| Idempotent re-post | PASS |
| Full reverse + immutable original | PASS |
| Reconciliation | PASS |
| BASIC_7C0 soft confirm → `LEGACY_POSTED` | PASS |
| Outbox `DISPATCH_POSTED` / `SALES_ORDER_INVOICE_READY` | PASS |
| Partial reverse + approval workflow | PASS |
| Partial reverse nets fulfilment | PASS |
| COGS/accounting hard reverse block | PASS |
| Sales Invoice source-link hard reverse block | PASS |
| Concurrent double-post | PASS |
| Emergency override (perm + soft gates + ledger mode) | PASS |
| Serial/lot matrix (incomplete / seeded / duplicate unique) | PASS |
| Concurrency stress (N posts → 1 ISSUE; reverse apply once) | PASS |

**17/17 tests passed.**

## Schema

Migration `20260723223000_dispatch_domain_events_partial_reverse` applied (posting-line `reversedQuantity` + `dispatch_domain_events` outbox).
