# Inventory Transaction Type Register

**Status:** done (backend-only, 2026-08-11)
**Depends on:** existing `InventoryMovementType` / `InventoryReferenceType` enums (`docs/inventory/INVENTORY_PHASE3A_README.md`)
**Related:** `docs/inventory/DUAL_VARIABLE_UOM_DESIGN.md` (BIN transfer types are deferred to that epic's Phase 2D, not this register)

## What this is

A read-only, code-based catalogue of every inventory stock-movement transaction type in FOS ERP — direction, owning module, whether it posts to the GL, whether it is reversible, and which permission gates it today. It answers "why did stock move, which module caused it, does it post accounting, can it be reversed, who can do it" for every `InventoryReferenceType` value in one place.

## What this is **not**

It is **not** a runtime posting-time lookup and **not** an admin-editable master table. Every `postStockMovement()` caller (purchase GRN, manufacturing WO/WIP/job-work, dispatch, quality, maintenance, transfers, adjustments, stock counts) keeps passing its own fixed `(movementType, referenceType)` pair exactly as before — that remains the single source of truth for what actually posts, is costed, and hits the GL. Turning this into a fully dynamic, runtime-configurable table would require rewriting every one of those ~15 call sites plus FIFO costing and GL account mapping to do dynamic lookups instead of typed, reviewed code paths — the "painful surgery" `DUAL_VARIABLE_UOM_DESIGN.md` §"biggest design decision" explicitly warns against doing more than once. Per this repo's own rule, code is the source of truth; this register documents that code, it does not replace it.

## The two-axis model (unchanged, just documented)

| Axis | Values | Where it lives |
|------|--------|-----------------|
| **Direction** (`InventoryMovementType`) | `OPENING` \| `INWARD` \| `ISSUE` \| `ADJUSTMENT` | column on every `InventoryStockMovement` row |
| **Reason** (`InventoryReferenceType`) | 30 values (see below) | column on every `InventoryStockMovement` row |

Batch/serial/lot are **orthogonal tracking flags** on the same movement row (`batchId`, `serialId`, `batchNumberSnapshot`, `serialNumberSnapshot`), not separate transaction types — "Material Issue Against Size Wise / Lot Wise / Serial No" is the same `ISSUE_TO_WO`/`ISS` row with those columns populated, not a distinct type.

## Where it lives in code

- Registry: [`backend/src/modules/inventory/shared/inventory-reference-type.registry.ts`](../../backend/src/modules/inventory/shared/inventory-reference-type.registry.ts) — `INVENTORY_REFERENCE_TYPE_REGISTRY` (one entry per `InventoryReferenceType` value) and `listInventoryReferenceTypes()`.
- API: `GET /api/v1/t/:tenantSlug/inventory/setup/reference-types` (permission: `inventory.setup.manage` / `inventory.view` / `inventory.stock.view`) — [`backend/src/modules/inventory/setup/setup.routes.ts`](../../backend/src/modules/inventory/setup/setup.routes.ts), [`setup.controller.ts`](../../backend/src/modules/inventory/setup/setup.controller.ts).
- Drift guard: [`backend/tests/inventory-reference-type-registry.test.ts`](../../backend/tests/inventory-reference-type-registry.test.ts) — asserts completeness (every enum value has a registry entry) and cross-checks `ownerModule`/`postsToGl` against the real `isManufacturingOwnedReferenceType()` and `deriveInventoryAccountingEventType()` logic in `inventory-accounting-builder.service.ts`, so the register cannot silently diverge from the live posting/GL rules.

## Full catalogue (28 live + 2 reserved)

| Code | Label | Direction | Owner module | Posts to GL | Reversible |
|---|---|---|---|---|---|
| `OPN` | Opening Stock | Receipt | Inventory | No | No |
| `INW` | Generic Inward | Receipt | Inventory | No | No |
| `ISS` | Generic Issue | Issue | Inventory | No | No |
| `ADJ` | Generic Adjustment | Adjustment | Inventory | No | No |
| `GRN` | Purchase Receipt (GRN) | Receipt | Purchase | Yes | Yes |
| `ISSUE_TO_WO` | Material Issue Against Work Order | Issue | Manufacturing | No* | Yes |
| `RETURN_FROM_WO` | Material Return From Work Order | Receipt | Manufacturing | No* | Yes |
| `WIP_RECEIVE` | WIP Receive | Receipt | Manufacturing | No | No — **reserved** |
| `WIP_TRANSFER` | WIP Transfer | Adjustment | Manufacturing | No | Yes |
| `MOVE_TO_WIP` | Move To WIP | Issue | Manufacturing | No | No — **reserved** |
| `MOVE_FROM_WIP` | Move From WIP | Receipt | Manufacturing | No | No — **reserved** |
| `SA_RECEIPT` | Sub-Assembly Receipt | Receipt | Manufacturing | No | No |
| `FG_RECEIPT` | Finished Goods Receipt | Receipt | Manufacturing | No* | Yes |
| `DISPATCH` | Dispatch (Generic) | Issue | Dispatch | No | No — **reserved** |
| `FG_DISPATCH` | Finished Goods Dispatch (Sales Issue) | Issue | Dispatch | Yes | Yes |
| `SUBCON_OUT` | Job Work — Material Sent | Issue | Manufacturing | No | Yes |
| `SUBCON_IN` | Job Work — Material Received | Receipt | Manufacturing | No | Yes |
| `QUALITY_RELEASE` | Quality Release | Status transfer | Quality | No | No |
| `QUALITY_HOLD` | Quality Hold | Status transfer | Quality | No | Yes |
| `QUALITY_REJECT` | Quality Rejection | Status transfer | Quality | No | No |
| `TRANSFER_DISPATCH` | Warehouse Transfer — Dispatch | Issue | Inventory | No | Yes |
| `TRANSFER_RECEIPT` | Warehouse Transfer — Receipt | Receipt | Inventory | No | Yes |
| `TRANSFER_REVERSAL` | Warehouse Transfer Reversal | Adjustment | Inventory | No | No |
| `STOCK_COUNT` | Stock Count Variance | Adjustment | Inventory | Yes | Yes |
| `STOCK_COUNT_REVERSAL` | Stock Count Variance Reversal | Adjustment | Inventory | Yes | No |
| `CONTROLLED_ADJUSTMENT` | Controlled Adjustment | Adjustment | Inventory | Yes | Yes |
| `ADJUSTMENT_REVERSAL` | Controlled Adjustment Reversal | Adjustment | Inventory | Yes | No |
| `ISSUE_TO_MAINTENANCE` | Material Issue Against Maintenance Ticket | Issue | Maintenance | No | No |
| `SALES_RETURN` | Sales Return | Receipt | Dispatch | No | No — **reserved** |
| `REQUISITION_ISSUE` | Material Issue Against Requisition | Issue | Inventory | No | No — **reserved** |

\* `ISSUE_TO_WO`/`RETURN_FROM_WO`/`FG_RECEIPT` are owned by **Manufacturing Accounting**, not Inventory Accounting — `isManufacturingOwnedReferenceType()` explicitly excludes them from `deriveInventoryAccountingEventType()` so Inventory Accounting never double-posts what Manufacturing Accounting already posts (flag-gated, see `docs/manufacturing/MANUFACTURING_ACCOUNT_MAPPING.md`).

## The two reserved gaps closed by this pass

Two real business events had **no** `InventoryReferenceType` at all before this change:

1. **`SALES_RETURN`** — a customer physically returning goods into stock. Today the only related mechanism is Dispatch reversal, which negates a `FG_DISPATCH` posting — that reverses *our own* internal posting, it is not the same business event as a customer returning goods after the fact. No posting flow exists yet.
2. **`REQUISITION_ISSUE`** — a generic inter-department stock requisition, beyond the existing maintenance-specific `ISSUE_TO_MAINTENANCE`. No posting flow exists yet.

Both were added to the `InventoryReferenceType` enum (migration `20260811000000_inventory_reference_type_gaps`, additive only) and registered with `reserved: true` — exactly like the pre-existing unused `DISPATCH`/`WIP_RECEIVE`/`MOVE_TO_WIP`/`MOVE_FROM_WIP` values. No `postStockMovement()` caller uses them yet; wiring the real posting flow for either is separate, future work.

## Explicitly out of scope (this pass)

- No new frontend screen. A future "Inventory Transaction Types" read-only register page under Inventory Setup can render `GET /inventory/setup/reference-types` directly.
- No posting/business logic for `SALES_RETURN` or `REQUISITION_ISSUE`.
- **Bin Transfer** types do not exist and are not added here — bin-dimension work is a separate epic (`DUAL_VARIABLE_UOM_DESIGN.md` §12, Phase 2D), sequenced *after* Dual-Variable UOM, by design.
- No change to any existing `postStockMovement` caller, GL mapping switch-statement, or reversal-eligibility logic.
