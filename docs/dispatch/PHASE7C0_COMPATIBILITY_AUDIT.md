# Phase 7C0 Compatibility Audit (for Phase 7C1)

**Date:** 2026-07-21  
**Scope:** Code + docs audit of Dispatch Phase 7C0 before Phase 7C1 workbench work.  
**Rule:** Do not remove 7C0. Do not silently change FG_DISPATCH posting semantics.

---

## Classification

| Layer | Classification | Rationale |
|-------|----------------|-----------|
| **Overall** | **SAFE_WITH_REFACTOR** | Models, fulfilment projection, and DRAFT lifecycle are sound foundations for 7C1. Confirm posting must stay compatibility-gated and must not become the primary workbench action until 7C5 hardens QC/tracking/reversal. |
| Models + DRAFT create/edit/cancel | **SAFE_FOUNDATION** | Reuse `OutboundDispatch` / `OutboundDispatchLine` as the Draft Dispatch document. |
| Confirm → FG_DISPATCH | **LEGACY_COMPATIBILITY_PATH** | Thin stock-out without Quality / tracking / ship-to / readiness gates. Keep available under `dispatch.post` (label as **Basic Dispatch**). |
| Confirmed cancel / reverse | **PILOT_ONLY gap** | Explicitly out of scope in 7C0; Phase 7C5 owns hardening. |

**Not an UNSAFE_BLOCKER:** Fulfilment quantities are server-derived and 7C0 does not rewrite Sales Order ordered quantity.

---

## 1. Database models

| Model | Table | Role |
|-------|-------|------|
| `SalesOrderLineFulfilment` | `sales_order_line_fulfilments` | Optional cancelled-qty ledger keyed by `tenantId + salesOrderId + salesOrderLineId` (JSON line UUID). |
| `OutboundDispatch` | `outbound_dispatches` | Header: `DRAFT` → `CONFIRMED` / `CANCELLED`. Soft SO FK. Idempotency key unique per tenant. |
| `OutboundDispatchLine` | `outbound_dispatch_lines` | Lines carry `itemId`, `warehouseId`, `quantity`, optional `salesOrderId` / `salesOrderLineId`, and post-confirm `inventoryMovementId` / `inventoryMovementNo`. |

Migration: `backend/prisma/migrations/20260721030000_dispatch_phase7c0_fulfilment`  
Schema evidence: `backend/prisma/schema.prisma` (`SalesOrderLineFulfilment`, `OutboundDispatch`, `OutboundDispatchLine`).

---

## 2. Lifecycle

```text
DRAFT ──confirm──► CONFIRMED
  │
  └──cancel──► CANCELLED   (DRAFT only)

CONFIRMED ──cancel──► ❌ ConflictError (no stock reverse in 7C0)
```

Evidence: `backend/src/modules/dispatch/outbound/outbound-dispatch.service.ts` (`confirmOutboundDispatch`, `cancelOutboundDispatch`).

---

## 3. Confirmation endpoint

| Item | Value |
|------|-------|
| Route | `POST /api/v1/t/:tenantSlug/dispatch/outbound/:id/confirm` |
| Permission | `dispatch.post` |
| Mount | `backend/src/modules/dispatch/dispatch.routes.ts` → `/outbound` |
| Behaviour | If already `CONFIRMED`, returns current document (idempotent at status level). |
| Pre-checks | Re-validates each line with `assertDispatchQtyAllowed` when SO line is linked. |

Evidence: `outbound-dispatch.routes.ts`, `outbound-dispatch.service.ts`.

---

## 4. Stock movement posted

| Field | Value |
|-------|-------|
| Movement type | `ISSUE` |
| Reference type | `FG_DISPATCH` |
| Poster | `postFgDispatchIssueMovement` → `postStockMovement` |
| Quantity | Negative signed quantity = line quantity |
| Idempotency key | `fg-dispatch:{outboundDispatchId}:{lineId}` |
| Reservation | `consumeSoReservation: true` (may consume active `SO` reservations) |
| Balance update | Via Inventory balance service only — Dispatch never writes balances |

Evidence: `backend/src/modules/inventory/shared/stock-posting.service.ts` (`postFgDispatchIssueMovement`); confirm loop in `outbound-dispatch.service.ts`.

---

## 5. Sales Order fulfilment update

| Question | Answer |
|----------|--------|
| Does confirm write `CrmSalesOrder.qty` / `lines`? | **No** |
| Does confirm write a cached dispatched qty column? | **No** |
| How is dispatched qty obtained? | **Derived** — sum of `OutboundDispatchLine.quantity` where parent status = `CONFIRMED` and `salesOrderLineId` matches |
| Cancelled qty | Stored on `SalesOrderLineFulfilment.cancelledQty` via separate CRM endpoint |
| Remaining | `max(0, ordered − cancelled − dispatched)` |

Evidence: `backend/src/modules/crm/sales-orders/fulfilment/sales-order-fulfilment.service.ts`.

---

## 6. Quantity semantics

| Capability | Supported? | Notes |
|------------|------------|-------|
| Partial dispatch | **Yes** | Confirm qty gated by remaining; over-dispatch rejected |
| Multiple dispatches per line | **Yes** | Summed in projection |
| Draft qty subtracted from remaining | **No** | Only CONFIRMED lines count (correct for 7C1) |
| Reversed dispatch qty | **No** | Confirmed cancel blocked; reversed qty = 0 for now |
| Quality checked on confirm | **No** | Gap — do not expose as primary workbench post |
| Tracking (lot/serial/heat) checked | **No** | Deferred |
| Feature-flagged | **No** | Always mounted when backend is up |
| API-mode frontend | **Yes** | `ApiOutboundDispatchPages` + `dispatchApi.ts`; demo store untouched when `VITE_USE_API=false` |
| Coexist with Pick/Pack/Challan | **Yes, with rules** | Keep DRAFT as planning shell; later phases extend same document. Confirm remains Basic Dispatch until 7C5. |

---

## 7. Idempotency

| Path | Mechanism |
|------|-----------|
| Create DRAFT | Optional `idempotencyKey` unique on `OutboundDispatch` |
| Confirm status | Early return if already `CONFIRMED` |
| Stock movement | Unique `(tenantId, idempotencyKey)` on `InventoryStockMovement` |
| Cancel DRAFT | Early return if already `CANCELLED` |

---

## 8. Known gaps that Phase 7C1 must wrap (not rewrite)

1. **No Quality gate on Basic Confirm** — workbench readiness must compute Quality blockers separately; Basic Confirm stays permission-gated.
2. **No ship-to / customer consolidation rules** on 7C0 create — 7C1 Draft create must validate compatibility server-side.
3. **Dispatch Readiness report still ignores FG stock** — ops report warns that product↔item mapping is not joined; 7C1 must reuse `resolveManufacturedProductItem` and Inventory free qty, then update the report.
4. **Quality Hold vs unrestricted** — distinguishable only via `ManufacturingWarehouseMapping.qualityHoldWarehouseId` vs FG warehouse, not a balance status flag.
5. **No confirmed reverse** — fulfilment position must expose `reversedDispatchQty = 0` honestly until 7C5.
6. **Pre-existing FE type noise** — `dispatchApi.ts` / `ApiOutboundDispatchPages.tsx` already fail frontend typecheck; 7C1 must not worsen this and should fix call signatures when touching those files.
7. **Live MySQL** — as of this audit, Prisma pool cannot obtain a connection (`45028` pool timeout); Docker daemon not running. Live 7C0 suite currently **skips**, which is not a pass.

---

## 9. Phase 7C1 coexistence rules

1. Reuse `OutboundDispatch` as Draft Dispatch; do **not** invent a competing header table unless a later audit proves extension impossible.
2. Synchronise `DispatchRequirement` from confirmed Sales Order lines; unique key `tenantId + salesOrderId + salesOrderLineId`.
3. Draft create/edit must **not** call `postFgDispatchIssueMovement` and must **not** change fulfilment.
4. Workbench primary actions: synchronise, readiness, create/edit/cancel Draft — **not** Basic Confirm.
5. Basic Confirm remains on existing detail/register under `dispatch.post` (optional future alias `dispatch.basic_confirm` / `dispatch.legacy_7c0_use` only if role matrices require separation).
6. After any CONFIRMED 7C0 post, requirement sync / readiness recalculation must recompute remaining from fulfilment projection.

---

## 10. Readiness gate snapshot (pre-7C1 build)

| Check | Result |
|-------|--------|
| SO line IDs stable after create | **Pass** — UUID assigned in `buildLinesFromInput`; confirmed SO not editable |
| Confirmed SO queryable | **Pass** |
| Net ordered qty reliable | **Pass** — fulfilment service |
| FG stock only via Inventory | **Pass** |
| Unrestricted vs Quality Hold distinguishable | **Pass with conditions** — warehouse mapping |
| Quality blockers queryable | **Pass** — `collectQualityBlockers` (WO-scoped) |
| Net dispatch qty queryable | **Pass** |
| Reversed dispatch handled where supported | **N/A** — not supported |
| 7C0 does not mutate ordered qty | **Pass** |
| API mode mock leakage on 7C0 surface | **Pass** for register/detail API pages |
| Backend typecheck | **Fail (pre-existing)** — 3 Fixed Assets disposal errors |
| Frontend typecheck | **Fail (pre-existing)** — includes dispatch/quality/store-workbench noise |
| Live `dispatch-phase7c0` | **Skipped** — MySQL pool timeout; Docker unavailable |

**Verdict for starting Phase 7C1 implementation:** **READY WITH CONDITIONS**  
Conditions: reuse product→item resolver; treat Basic Confirm as legacy path; restore MySQL before claiming live acceptance; isolate pre-existing typecheck noise.

**Not** `PHASE 7C1 READINESS: NOT READY` — fulfilment quantity spine is reliable enough to build the workbench without inventing mock remaining quantities.
