# Dispatch Policy Settings (Phase 7C5)

Source: `backend/src/modules/dispatch/posting/dispatch-policy.ts`

## Pilot defaults (hardened)

| Field | Default |
|-------|---------|
| requireReservationBeforePosting | true |
| requirePickBeforePosting | true |
| requirePackBeforePosting | true |
| requireIssuedChallanBeforePosting | true |
| requireQualityClearance | true |
| allowPartialDispatch | true |
| allowOverDispatch | false |
| allowNegativeStock | false |
| requireSerialAllocation | false (matrix tested when enabled) |
| requireLotAllocation | false (matrix tested when enabled) |
| requireSupervisorApprovalForOverride | true |
| allowDirectEmergencyDispatch | false (supervisor `emergency:true` + `dispatch.override` still allowed) |
| reversalApprovalRequired | true |
| blockReversalWhenInvoiced | true |
| blockReversalWhenCogsPosted | true |
| requirePodBeforeInvoice | false (env `REQUIRE_POD_BEFORE_INVOICE`) |

## Legacy soft policy

Used for `BASIC_7C0` and when hardened flag is off for workbench confirm: reservation/pick/pack/challan **not** required (existing documents still enforced if present).

Tenant DB settings table deferred — policy is code defaults + env flag today.
