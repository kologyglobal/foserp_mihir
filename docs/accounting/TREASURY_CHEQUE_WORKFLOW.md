# Treasury Cheque Workflow (Phase 5B2)

## Statuses

`DRAFT` → `PENDING_APPROVAL` → `READY` → `ISSUED` | `DEPOSITED` → `CLEARED` | `BOUNCED`

Also: `REJECTED` (pre-ready), `CANCELLED` (pre-post), `STOPPED` (ISSUED-direction only), `REVERSED`.

## Actions (`allowedActions` from backend)

view · edit · validate · submit · markReady · approve · reject · revise · cancel · issue (ISSUED only) · deposit (RECEIVED only) · clear · bounce · stop (ISSUED only) · reverse · viewApproval · viewAccountingPreview · viewAccounting

## ISSUED-direction path

```text
DRAFT → [submit→approve | mark-ready] → READY → issue → ISSUED → clear → CLEARED
                                                        ↳ bounce → BOUNCED
                                          DRAFT/READY/ISSUED → stop → STOPPED
```

## RECEIVED-direction path

```text
DRAFT → [submit→approve | mark-ready] → READY → deposit → DEPOSITED → clear → CLEARED
                                                           ↳ bounce → BOUNCED
```

## Approvals

Reuses `FinanceApprovalRequest` with `documentType = TREASURY_CHEQUE`. `FinanceSettings.treasuryChequeApprovalLimit` (base amount) determines whether a draft requires submit→approve or can go straight to `mark-ready`. `treasuryChequePreventSelfApprove` (default `true`) blocks the submitter from approving their own cheque.

## Cancellation vs. stop vs. reversal

- **Cancel**: only before any posting (`DRAFT` / `REJECTED` / `READY` / `PENDING_APPROVAL`). Frees the uniqueness key.
- **Stop payment**: ISSUED-direction only. If not yet issued (`DRAFT`/`READY`), status-only. If already `ISSUED`, reverses the posted voucher (if any) and moves to `STOPPED`.
- **Bounce**: `ISSUED`/`DEPOSITED` only. Reverses the posted voucher (if any, i.e. `POST_ON_LIFECYCLE`) and moves to `BOUNCED`. `TRACK_ONLY` cheques bounce with a status-only update.
- **Reverse**: full accounting reversal for `ISSUED`/`DEPOSITED`/`CLEARED` (`POST_ON_LIFECYCLE` only — `TRACK_ONLY` cheques must be reversed via their linked receipt/payment instead). Frees the uniqueness key. Idempotent via `idempotencyKey` + `expectedUpdatedAt`.

## TRACK_ONLY cheques

Cheques linked to an already-posted `customerReceiptId` (RECEIVED) or `vendorPaymentId` (ISSUED), or explicitly created with `accountingMode: 'TRACK_ONLY'`, skip all GL posting. `issue`/`deposit` still reserve the `CHQ/` register number and advance status, but never create a voucher; `bounce`/`stop` are status-only for these cheques.
