# NCR Disposition Workflow (Phase 7B)

## Foundation

Extends Phase 4A `QualityNcr`. Rejection of an inspection still creates an OPEN NCR.

## Additive fields

- `disposition`, `dispositionQuantity`, `dispositionNotes`
- `containmentAction`, `rootCause`, `correctiveAction`, `preventiveAction`
- `ownerId`, `targetDate`, `effectivenessReview`
- `jobWorkOrderId`, `supplierId` (optional links)

## Status path (practical)

`OPEN` → `DISPOSITION_PENDING` → `ACTION_IN_PROGRESS` → `VERIFICATION_PENDING` → `CLOSED`

Legacy statuses (`INVESTIGATING`, `CORRECTIVE_ACTION`, `APPROVED`) remain valid.

## Dispositions

| Disposition | Effect in 7B |
|-------------|--------------|
| REWORK | Decision recorded; Production/Job Work rework routing remains separate |
| RETURN_TO_SUPPLIER | Quality decision only — Purchase return/debit note deferred |
| SCRAP | Disposition recorded; Inventory scrap posting where physical stock exists is coordinated separately |
| USE_AS_IS | Requires `quality.approve` / `quality.override` |
| DEVIATION / SORT_AND_ACCEPT / REINSPECT / HOLD | Traceable decision; reinspect creates a new linked inspection (do not overwrite original) |

## APIs

- `POST /quality/ncrs/:id/disposition`
- `POST /quality/ncrs/:id/submit-action`
- `POST /quality/ncrs/:id/verify`
- `POST /quality/ncrs/:id/close` (existing)

## Not in 7B

Full enterprise CAPA product, automatic GL, automatic vendor rating deductions.
