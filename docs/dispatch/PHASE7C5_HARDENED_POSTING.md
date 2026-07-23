# Phase 7C5 — Hardened Dispatch Posting

**Status:** Controlled UAT foundation shipped (evidence in `PHASE7C5_TEST_RESULTS.md`).  
**Not client production-ready** until UAT + reconciliation sign-off.

## Canonical rule

All FG_DISPATCH Inventory issues must go through:

`DispatchPostingService.postFgDispatch`  
(`backend/src/modules/dispatch/posting/dispatch-posting.service.ts`)

Endpoints:

| Route | Mode | Policy |
|-------|------|--------|
| `POST …/outbound/:id/confirm` | `confirm` | Soft for `BASIC_7C0`; hardened for `WORKBENCH_7C1` when `DISPATCH_HARDENED_POSTING_ENABLED` |
| `POST …/outbound/:id/post` | `post` | Hardened for `WORKBENCH_7C1` (always forceHardened) |

## Feature flag

`DISPATCH_HARDENED_POSTING_ENABLED`

- Explicit `true` / `false`
- Unset: **ON** when `NODE_ENV !== 'production'`, **OFF** in production

## What posts stock

Only successful posting:

- Creates `ISSUE` / `FG_DISPATCH` via `InventoryPostingService.postFgDispatchIssue`
- Creates immutable **`DispatchPosting` + lines** (`DPO-…`) in the same transaction
- Sets outbound `CONFIRMED`
- Consumes SO reservation (`consumeSoReservation: true`)
- Contributes to **derived** SO fulfilment (CONFIRMED lines)

See `DISPATCH_POSTING_LEDGER.md`.

## Non-stock steps

Reservation, Pick, Pack, Delivery Challan issue remain non-stock-moving.

## Readiness

`GET …/outbound/:id/posting-readiness` → `DispatchReadinessService` / `getOutboundPostingReadiness`

## Reversal

`POST …/outbound/:id/reverse` → compensating `INWARD` / `FG_DISPATCH`; header `REVERSED`.  
Reservation policy: **RESTORE_FREE_STOCK_ONLY** (no auto re-reserve).

## Reconciliation

`GET …/reconciliation` and `GET …/reconciliation.csv` — report only, no auto-fix.
