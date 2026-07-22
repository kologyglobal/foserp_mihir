# Treasury Transfer Workflow (Phase 5B1)

## Statuses

`DRAFT` → `PENDING_APPROVAL` → `READY_TO_POST` → (`IN_TRANSIT` →) `COMPLETED`

Also: `REJECTED`, `CANCELLED` (pre-post), `REVERSED`.

Do not use `POSTED` as transfer status (in-transit has two posting stages).

## Actions (`allowedActions` from backend)

view · edit · validate · submit · approve · reject · revise · markReady · cancel · postDirect · dispatch · receive · reverse · viewSourceVoucher · viewDestinationVoucher · viewLedger · viewReconciliation

## Direct path

```text
DRAFT → [submit→approve | mark-ready] → READY_TO_POST → post → COMPLETED
```

## In-transit path

```text
DRAFT → … → READY_TO_POST → dispatch → IN_TRANSIT → receive → COMPLETED
```

## Approvals

Reuses `FinanceApprovalRequest` with `documentType = TREASURY_TRANSFER`. Maker-checker settings: prevent self-approve; prevent dispatcher from confirming receipt.

## Cancellation vs reversal

- Cancel only before financial posting (`DRAFT` / `REJECTED` / `READY_TO_POST`)
- Reverse for `IN_TRANSIT` or `COMPLETED` (full only; blocked if active bank reconciliation exists)
