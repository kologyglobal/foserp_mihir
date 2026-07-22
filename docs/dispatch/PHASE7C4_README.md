# Dispatch Phase 7C4 — Delivery Challan & Documentation

> Status: **shipped (core)** — migration `20260721210000_dispatch_phase7c4_delivery_challan`; semantics `DELIVERY_CHALLAN_AS_DOCUMENT_ONLY`.  
> Scope lock: **no** FG_DISPATCH, reservation consumption, SO fulfilment posting, invoice/GST/COGS, e-Way API.

## Chain (stops at ISSUED / Ready for Dispatch)

```
… → Packing → Verified Packages → Delivery Challan Draft → Review → ISSUED → Ready for Dispatch Posting (7C5)
```

## SHIPPED

- Delivery Challan Draft / lifecycle (DRAFT → READY_FOR_REVIEW → APPROVED → ISSUED)
- NUMBER_ON_ISSUE (`DELIVERY_CHALLAN` → `DC-######`)
- Customer / ship-to / legal-entity (tenant) snapshots
- Lines from packed package lines; package + soft tracking links
- Transport / vehicle / LR/GR / manual e-Way Bill reference
- Printable HTML document (Draft watermark; issued immutable HTML)
- Packing-to-challan reconciliation + 7C0 confirm gate when challan exists
- Workbench Ready for Challan / Drafts / Review / Issued / Ready for Dispatch
- Permissions `dispatch.challan.*`

## STILL PENDING (7C5)

- Final Dispatch posting / FG_DISPATCH hardening / fulfilment / reverse
- Sales Invoice / e-Invoice / e-Way API / COGS / revenue

## API base `/api/v1/t/:tenantSlug/dispatch`

| Area | Routes |
|------|--------|
| Create/list | `POST …/orders/:id/delivery-challans`, `GET …/delivery-challans` |
| Lifecycle | ready-for-review, send-back, approve, issue, cancel, supersede |
| Documents | preview, pdf (HTML), generate-draft-preview |
| Workbench | challan-drafts, challan-review, challans-issued, ready-for-dispatch |

## Tests

```bash
cd backend && npx vitest run tests/dispatch-phase7c0.test.ts tests/dispatch-phase7c1.test.ts tests/dispatch-phase7c2.test.ts tests/dispatch-phase7c3.test.ts tests/dispatch-phase7c4.test.ts
cd frontend && npm run test:dispatch-phase7c4
```

## Rule pack

| Doc | Topic |
|-----|-------|
| [DELIVERY_CHALLAN_SEMANTICS.md](./DELIVERY_CHALLAN_SEMANTICS.md) | Document-only invariant |
| [DELIVERY_CHALLAN_LIFECYCLE.md](./DELIVERY_CHALLAN_LIFECYCLE.md) | Status transitions |
| [DELIVERY_CHALLAN_NUMBERING.md](./DELIVERY_CHALLAN_NUMBERING.md) | NUMBER_ON_ISSUE |
| [DELIVERY_CHALLAN_SNAPSHOT_RULES.md](./DELIVERY_CHALLAN_SNAPSHOT_RULES.md) | Customer / LE / item snapshots |
| [DELIVERY_CHALLAN_LINE_RULES.md](./DELIVERY_CHALLAN_LINE_RULES.md) | Lines & qty |
| [DELIVERY_CHALLAN_PACKAGE_RULES.md](./DELIVERY_CHALLAN_PACKAGE_RULES.md) | Package links |
| [DELIVERY_CHALLAN_TRACKING_RULES.md](./DELIVERY_CHALLAN_TRACKING_RULES.md) | Soft tracking |
| [PACKING_TO_CHALLAN_RECONCILIATION.md](./PACKING_TO_CHALLAN_RECONCILIATION.md) | Reconciliation |
| [DELIVERY_CHALLAN_PDF_RULES.md](./DELIVERY_CHALLAN_PDF_RULES.md) | HTML document / print |
| [DELIVERY_CHALLAN_VERSIONING.md](./DELIVERY_CHALLAN_VERSIONING.md) | Supersession |
| [DELIVERY_CHALLAN_CANCELLATION.md](./DELIVERY_CHALLAN_CANCELLATION.md) | Cancel pre-post |
| [PHASE7C4_PERMISSION_MATRIX.md](./PHASE7C4_PERMISSION_MATRIX.md) | Permissions |
| [PHASE7C4_7C0_COMPATIBILITY.md](./PHASE7C4_7C0_COMPATIBILITY.md) | Basic confirm gate |
| [PHASE7C4_TEST_RESULTS.md](./PHASE7C4_TEST_RESULTS.md) | Evidence |

## Phase 7C5 readiness

**READY WITH CONDITIONS** — soft tracking; HTML document (browser print for PDF); one active challan per dispatch pilot.
