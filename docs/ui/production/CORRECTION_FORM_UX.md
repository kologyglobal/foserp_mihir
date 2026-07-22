# Correction Request Form UX (FORM 15)

Components: `frontend/src/modules/manufacturing/corrections/CorrectionDrawer.tsx`,
`CorrectionsRegisterPage.tsx` (`/manufacturing/corrections`).

## Principle

Posted production transactions are immutable. Corrections create **compensating entries**
(Original → Reversal → Corrected Result). There is no "Delete Transaction" anywhere in
the Manufacturing UI.

## Flow

1. Select the original transaction (type, document, work order, quantity, dependencies).
2. Enter correction type, corrected quantity/value, mandatory reason, effective date.
3. Server preview of the compensating impact (work order, inventory, WIP, downstream).
4. Submit → approval (permission-gated) → apply.

## Register

`/manufacturing/corrections` — filterable register (deep-linkable via
`?workOrderId=`), status chips, drawer for detail/lifecycle. Work Order detail links to
its corrections from the header chip.

## Permissions

`manufacturing.correction.view/request/approve/apply` (+ `.admin` override), enforced in
UI and backend.
