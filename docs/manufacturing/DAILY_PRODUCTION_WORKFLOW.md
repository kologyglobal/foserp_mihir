# Daily Production Workflow — Manufacturing Phase 2B

Supervisor workflow for multi-order shift reporting. Uses the same Stage Ledger as operator task completion.

## Access

- Route: `/manufacturing/daily-update`
- Permissions: `manufacturing.daily_production.view|create|submit` (+ `correct` for adjustments)

## Header

- Production Date  
- Shift (`shiftCode` / `shiftLabel` — soft reference until HR Shift master exists)  
- Plant / Work Centre (optional)  
- Supervisor (authenticated user)

## Draft grid

Columns: Work Order, Product, Stage, Operation (Detailed mode), Operator, Machine, Balance, Good, Rework, Reject, Scrap, Downtime, Remarks.

Actions: Add Row, Copy Previous, Remove Draft Row, Save Draft, Validate, Submit.

Conveniences: search WO, running-only filter, default current Stage / assigned operator / machine / balance, sticky Save/Submit bar, line-level errors.

Do **not** ask for BOM, Routing, UOM (when known), customer, SO, warehouse, or accounting fields.

## Submit rules

1. Batch must be `DRAFT`  
2. Entire batch is **atomic** — one failing line rolls back all progress posts  
3. Each line validates WO / Stage / quantities against **current** balances  
4. Each line posts via `recordProgress` (central Progress Service)  
5. Ledger id stored on the line; batch becomes `SUBMITTED` and immutable  
6. Duplicate submit is rejected  

After submit: show lines posted, totals, links to affected Work Orders. Resubmission blocked.

## Correction

Authorised users with `manufacturing.daily_production.correct`:

- Select submitted line  
- Enter corrected quantities + reason  
- System posts reversal + correction via Progress Service  
- Original line retained; batch may become `PARTIALLY_REVERSED`  

Operators cannot correct.

## Relationship to My Work

Operator complete and Daily Production lines both update Stage totals through the same ledger. Concurrent updates are protected by idempotency keys, status checks, and balance validation. Conflict messages should tell the user to refresh and review the latest balance.

## Assignment before update (optional)

Supervisors may assign operators/machines from Work Order detail (**Assign Work**) before or instead of individual My Work completion. Assignment history is preserved on reassignment (previous assignment cancelled/closed; new row with `reassignedFromId`).
