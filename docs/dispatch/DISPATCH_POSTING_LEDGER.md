# Dispatch Posting Ledger (Phase 7C5)

Immutable posting / reversal transaction tables. **Not** a second inventory ledger — stock remains on `InventoryStockMovement` (`ISSUE` / `FG_DISPATCH`).

## Models

| Table | Purpose |
|-------|---------|
| `dispatch_postings` | One posting per outbound (unique `tenantId + outboundDispatchId`) |
| `dispatch_posting_lines` | Line qty + `inventoryMovementId` + pick/pack/challan refs |
| `dispatch_reversals` | Approval-capable reverse header (`DRAFT_REQUEST`…`APPLIED`) |
| `dispatch_reversal_lines` | Compensating movement linkage |

## Status

**Posting:** `POSTED` \| `PARTIALLY_REVERSED` \| `REVERSED` \| `LEGACY_POSTED`  
**Reversal:** `DRAFT_REQUEST` → `SUBMITTED` → `APPROVED` → `APPLIED` (pilot apply path sets `APPLIED` in one step)

## Number series

- `DISPATCH_POSTING` → `DPO-######`
- `DISPATCH_REVERSAL` → `DRV-######`

## Behaviour

- `DispatchPostingService.postFgDispatch` creates posting + Inventory ISSUE atomically.
- `reverseOutboundDispatch` creates `DispatchReversal` (`APPLIED`) + compensating INWARD; original posting stays immutable; status → `REVERSED`.
- Migration backfills historical CONFIRMED/REVERSED outbounds as `LEGACY_POSTED` / `REVERSED` with `mode=legacy`.

## Migration

`20260723220000_dispatch_posting_reversal_ledger`
