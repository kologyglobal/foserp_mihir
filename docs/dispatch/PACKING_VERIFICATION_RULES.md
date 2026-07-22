# Packing Verification Rules (Phase 7C3)

## Package verification

Validates: active package with ≥1 active line; qty + tracking reconcile; serials unique; weight/dimensions/seal when required; no unresolved shortage; Pick qty still valid; Dispatch active; source version current.

Records verifiedBy / verifiedAt. Verified package becomes read-only.

## Session verification

Confirms all required packages verified (pilot) and session reconciliation is clean. Status → `VERIFIED`.

## Reopen

Requires `dispatch.package.reopen` / `dispatch.packing.reopen`, reason, and no Delivery Challan / posted Dispatch dependency. Creates append-only `PACKAGE_REOPENED` / session reopen event.

## Pilot note

Verification recommended before Phase 7C4 challan preparation. Not a statutory document step.
