# Dispatch Policy Settings (Phase 7C5 + commercial O2C)

Sources:

- Operational gates: `backend/src/modules/dispatch/posting/dispatch-policy.ts`
- Tenant commercial flags: `DispatchSettings` (`dispatch_settings`) + `GET/PUT /api/v1/t/:tenantSlug/dispatch/settings`
- UI: `/dispatch/settings` (`DispatchSettingsPage`)

## Pilot operational defaults (hardened)

| Field | Default |
|-------|---------|
| requireReservationBeforePosting | true |
| requirePickBeforePosting | true |
| requirePackBeforePosting | true |
| requireIssuedChallanBeforePosting | true |
| requireQualityClearance | true |
| allowPartialDispatch | true |
| allowMultipleDispatches | true |
| allowOverDispatch | false |
| allowNegativeStock | false |
| requireSerialAllocation | false |
| requireLotAllocation | false |
| requireSupervisorApprovalForOverride | true |
| allowDirectEmergencyDispatch | false |
| reversalApprovalRequired | true |
| blockReversalWhenInvoiced | true |
| blockReversalWhenCogsPosted | true |
| requirePodBeforeInvoice | false (tenant setting **or** env `REQUIRE_POD_BEFORE_INVOICE`) |
| invoiceMode | `ONE_PER_DISPATCH` |

## Tenant commercial policy (UI)

| Setting | Behaviour |
|---------|-----------|
| **Allow partial dispatch** | Off → draft qty must equal remaining-to-dispatch |
| **Allow multiple dispatches** | Off → second open outbound (DRAFT/CONFIRMED) for the same SO line is blocked |
| **Invoice mode — One per dispatch** | Auto DRAFT SI on post when `ENABLE_AUTO_SALES_INVOICE_FROM_DISPATCH`; manual Invoice Ready must not span multiple outbounds |
| **Invoice mode — Consolidated** | Auto SI off; manual Invoice Ready may combine lines across dispatches |
| **Invoice mode — Manual only** | Auto SI off; invoices only via Money In / Invoice Ready |
| **Require POD before invoice** | Auto + manual invoice wait until POD is `DELIVERED` or `PARTIALLY_DELIVERED` |

Env overrides that still apply:

- `DISPATCH_HARDENED_POSTING_ENABLED`
- `REQUIRE_POD_BEFORE_INVOICE` (forces POD gate on even if tenant toggle is off)
- `ENABLE_AUTO_SALES_INVOICE_FROM_DISPATCH` (must be on **and** `invoiceMode=ONE_PER_DISPATCH` for auto SI)

Permissions: `dispatch.settings.view` / `dispatch.settings.manage` (also `finance.settings.manage` / `tenant.manage` for manage).

## Legacy soft policy

Used for `BASIC_7C0` and when hardened flag is off for workbench confirm: reservation/pick/pack/challan **not** required.

## Out of scope until base O2C sign-off

- Live e-Way bill integration
- Carrier / tracking provider APIs beyond current challan fields

## Proof tests

- Base flow: `tests/dispatch-phase7c5.test.ts`, `tests/dispatch-o2c-invoice-allocate.test.ts`
- Policy matrix: `tests/dispatch-commercial-policy.test.ts`
