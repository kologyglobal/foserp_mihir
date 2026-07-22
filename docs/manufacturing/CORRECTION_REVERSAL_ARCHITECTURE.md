# Correction / Reversal Architecture (Phase 5C)

## Pattern (aligned with Finance document reverse, not Finance engines)

1. Gate eligibility (tenant, permission, posted, reversible qty, deps, period/status)
2. Preview with server-calculated impact + `previewToken` / `sourceVersion`
3. Draft → submit → (approve if required) → apply
4. Append compensating domain records inside one DB transaction
5. Write `ManufacturingTransactionReversalLink`
6. Mark correction `APPLIED` (immutable thereafter)
7. Activity: `CORRECTION_*` / `TRANSACTION_REVERSED`

## Models

- `ManufacturingTransactionCorrection` (`MC-` series)
- `ManufacturingTransactionReversalLink`

## Handler registry

Domain handlers under `backend/src/modules/manufacturing/corrections/handlers/` own preview + apply. Controllers stay thin.

## Approval

Manufacturing-local on the correction document (`approvalRequired` from risk). Does not create `FinanceApprovalRequest` (ADR-035).
