# Dispatch Reversal (Phase 7C5)

## Canonical service

`DispatchReversalService` (`dispatch-reversal.service.ts`).

Compat entry: `POST /dispatch/outbound/:id/reverse` → `reverseOutboundDispatchCanonical`.

Workflow endpoints (ledger):

| Method | Path | Action |
|--------|------|--------|
| GET | `/outbound/:id/reversals` | List |
| POST | `/outbound/:id/reversals` | Create `DRAFT_REQUEST` (partial or full remaining) |
| POST | `/reversals/:id/submit` | → `SUBMITTED` |
| POST | `/reversals/:id/approve` | → `APPROVED` |
| POST | `/reversals/:id/reject` | → `REJECTED` |
| POST | `/reversals/:id/cancel` | → `CANCELLED` |
| POST | `/reversals/:id/apply` | Compensating stock + fulfilment |

## Lifecycle

`DRAFT_REQUEST` → `SUBMITTED` → `APPROVED` → `APPLIED`  
(reject / cancel are terminal).

Policy `reversalApprovalRequired` (default **true**):

- Segregated roles: `/reverse` with `requestOnly: true` (or default when caller lacks approve+apply) returns `{ awaitingApproval: true }`.
- Power users with approve+apply (or `skipApproval` + `dispatch.override`) may complete in one shot.

## Partial line reverse

- Body `lines: [{ outboundDispatchLineId | postingLineId, quantity }]`.
- Remaining = posting line `quantity − reversedQuantity`.
- Over-reversal → **409**.
- Posting status → `PARTIALLY_REVERSED` until remaining is zero, then `REVERSED`.
- Outbound header → `REVERSED` only when fully reversed.

## Behaviour on apply

- Original CONFIRMED posting / ISSUE movements stay **immutable**.
- Compensating `INWARD` + `FG_DISPATCH` per reversal line.
- Derived SO fulfilment nets `reversedQuantity`.

## Reservation on reverse

**Policy:** `RESTORE_FREE_STOCK_ONLY`  
Do not auto-recreate soft reservation. Operator re-reserves if demand remains.

## Downstream blockers

Hard blocks are **shipped** (not deferred). Auto Sales Invoice from Dispatch remains out of scope.

See `docs/dispatch/DISPATCH_REVERSAL_DEPENDENCIES.md`.

- `SALES_INVOICE_POSTED` / `SALES_INVOICE_OPEN` — ACTIVE source links or header `OUTBOUND_DISPATCH`
- `COGS_OR_INV_ACCT_POSTED` — posted inventory accounting events
- `force: true` requires `dispatch.override`
- `GET …/outbound/:id/reversal-dependencies` lists deps; FE preflights before reverse prompt

## Permissions

- `dispatch.reverse.request` — create / submit / cancel
- `dispatch.reverse.approve` — approve / reject
- `dispatch.reverse.apply` — apply stock move
- `dispatch.override` — skip approval / force deps

## Related

- Ledger models: `docs/dispatch/DISPATCH_POSTING_LEDGER.md`
