# Work Order Split Rules

**Status:** Implemented in Wave 5. A released work order is represented by `READY` in the current database enum.

## Eligibility

- Only `READY` (released) and `IN_PROGRESS` work orders can be split. `DRAFT`, `ON_HOLD`, `COMPLETED`, `CLOSED`, and `CANCELLED` are ineligible.
- Split quantity must be greater than zero and strictly less than the remaining open quantity:
  `plannedQuantity - completedGoodQuantity`.
- A split is blocked while the parent has:
  - an open Job Work order;
  - an open quality inspection whose held quantity covers the whole remaining open quantity; or
  - an unapplied manufacturing correction (`DRAFT`, `PENDING_APPROVAL`, `APPROVED`, or `APPLYING`).

## Result

- The child inherits the item, manufacturing profile, plant, source references, dates, priority, managers, output tracking, BOM/routing version references, and warehouse-bearing material lines.
- The released BOM and routing snapshots are cloned. Snapshot rows are new records; the child never shares mutable stage, operation, dependency, or material rows with the parent.
- Parent planned quantity is reduced by the split quantity. The child planned quantity equals the split quantity.
- Parent stage and operation planned quantities are reduced and corresponding child rows start clean.
- BOM/material required quantities are divided proportionally. Existing issue, return, progress, ledger, WIP, quality, Job Work, FG, and assignment history remains on the parent.
- Active stock reservations are divided by the same material ratio. The transferred portion receives its own child reservation and remains in the same warehouse.
- The child starts `READY`, with no progress or transactional history. WIP custody is not moved by the split itself; use the existing controlled WO-to-WO WIP movement after splitting when custody must move.
- Every split creates `ProductionOrderSplit`, parent/child `ProductionActivity` entries, and an applied `WORK_ORDER_SPLIT` manufacturing transaction record for traceability.

## Reversal

Reverse through Phase 5C using transaction type `WORK_ORDER_SPLIT` and the `ProductionOrderSplit.id` as the source entity.

Reversal is allowed only while the child has no:

- production progress or daily-production lines;
- material issues/returns or WIP movements;
- quality inspections or NCRs;
- Job Work orders;
- finished-goods receipts;
- assignments; or
- child splits of its own.

When eligible, reversal restores parent header, stage, operation, BOM, material, and active-reservation quantities; cancels and soft-deletes the child; and preserves the split and correction audit trail. Work-order merge remains outside this feature.
