# Runtime Change Immutability Rules

Phase 5A apply **must not** rewrite history. Allowed updates are forward-looking targets and operational flags only.

## Never rewrite

- Production stage ledger entries (progress / corrections)
- Already recorded good / rework / reject / scrap quantities on completed work
- Quality inspections / NCRs / blockers already created
- Job Work dispatches, receipts, inventory `SUBCON_*` / issue / inward postings
- Sales order commercial lines (price, terms) — demand peg qty only when linked

## Allowed mutations

- WO header: planned quantity (not below completed good), due date, priority, hold/resume status
- Incomplete stages/operations: planned quantity scale, machine/WC, supervisor/operator assignment, skip/add/repeat flags
- Linked `ProductionDemand` converted/remaining quantities (same transaction as qty change)
- New Job Work **draft** from convert-to-JW (no stock movement)
- Activity log entries (`RUNTIME_CHANGE_*`)

## Stale-order guard

Apply compares `ProductionOrder.updatedAt` to the timestamp captured at draft/request time. Concurrent edits force re-preview / new change.

## Idempotency

- Create: optional `idempotencyKey` returns existing change for same WO
- Apply: second apply on `APPLIED` → already-applied error
