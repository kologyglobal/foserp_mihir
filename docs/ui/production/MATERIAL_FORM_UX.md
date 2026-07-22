# Material Form UX (Reservation, Issue, Return, Shortage-to-PR, Transfers)

All material actions run from the Work Order detail **Materials** tab
(`ApiWorkOrderDetailPage.tsx`) and the Store Workbench queues. Backend is the source of
truth via `getWorkOrderMaterialsReadiness`.

## Material position table

Columns: Item, Required, Reserved, Issued, Shortage, Free, Status (human labels via
`materialLineMeta`), Actions. Statuses: Open / Reserved / Partially issued / Issued /
Short / Closed / Cancelled.

## Reservation (FORM 8)

- **Reserve** per line or **Reserve all** — server allocates against unrestricted stock;
  no physical stock change. Result reflected in Reserved column and reservation link.
- Shortage remains visible per line (`shortageQty`), driving **Shortage PR**.

## Material Issue (FORM 9) — `MaterialIssueDrawer`

Posting-preview drawer:

- Position strip: Required / Reserved / Issued / Remaining / Available.
- Issue Quantity (defaults to remaining, large tap-friendly input) with field-level
  validation: cannot exceed remaining requirement; warning when above available stock
  (server remains the enforcer).
- Source warehouse shown as hint.
- `PostingImpactPanel`: Inventory decrease, issued-after-posting, remaining requirement.
- Immutability warning + idempotency key + duplicate-click protection.
- Primary: **Post Material Issue**.

## Material Return (FORM 10) — `MaterialReturnDrawer`

- Position strip: Issued / Already returned / Returnable.
- Return Quantity validated against returnable balance.
- **Reason is required** (audit trail).
- Impact: Inventory increase, WO responsibility decrease.
- Primary: **Post Material Return**.

## Shortage to Purchase Requisition (FORM 11)

- **Shortage PR** action creates a requisition from all short lines
  (`createWorkOrderShortageRequisition`); PR link appears on the material line.

## WIP / Material Transfer (FORM 12/13) — `WipTransferDrawer` (pre-existing)

- Movement types: LOCATION_WIP (logical), MATERIAL_RELOCATE, WO_TO_WO transfer.
- Labels distinguish logical vs stocked movement; posted movements appear in the
  Job Work / Transfers tab with physical/logical flag.

## Rules

- No mock fallback in API mode; failures show toast + retry.
- All posts carry `idempotencyKey`.
- Posted transactions are immutable — corrections go through `CorrectionDrawer`
  (compensating entries).
