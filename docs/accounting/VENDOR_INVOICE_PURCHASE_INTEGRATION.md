# Vendor Invoice ↔ Purchase Integration

## Dual-document rule (critical)

**Purchase `PurchaseInvoice` ≠ Accounting `VendorInvoice`.**

| Document | Owner module | Role |
|----------|--------------|------|
| `PurchaseInvoice` | Purchase | Operational purchase bill / 3-way match artifact |
| `VendorInvoice` | Accounting (AP) | Financial SoT for AP subledger, GL posting, allocations, reversals |

- Accounting **VendorInvoice remains the financial owner**.
- Purchase PO / GRN / PurchaseInvoice are **sources only**.
- This program does **not** merge PurchaseInvoice into VendorInvoice.
- Soft links only — no Prisma FKs from VendorInvoice to PO/GRN.

## Party

- `VendorInvoice.vendorId` soft-links to `MasterVendor`.
- Resolved via `accounting-vendor-resolver` (ACTIVE, not blocked).
- DRAFT-only Refresh from Master preview + apply for vendor snapshots.

## Source modes

Request field `sourceMode` (validated; also derivable from `sourceLinks`):

| Mode | Required source links |
|------|------------------------|
| `DIRECT` | None (and none allowed) |
| `PURCHASE_ORDER` | ≥1 `PURCHASE_ORDER` |
| `GRN` | ≥1 `GOODS_RECEIPT` (alias type `PURCHASE_RECEIPT` accepted) |
| `PURCHASE_ORDER_AND_GRN` | ≥1 PO and ≥1 GRN |

PO/GRN validation:

- Document exists for tenant, not soft-deleted
- `vendorId` matches invoice vendor
- Status not cancelled/reversed (and not draft for GRN where applicable)
- Fabricated UUIDs are rejected

## Purchase Setup policy bridge

Applied on AP draft create/update/validate/post **only when Purchase Setup is configured** for the tenant (`isConfigured=true`). Unconfigured tenants keep historical AP behavior (DIRECT allowed). Does not auto-post PurchaseInvoice into VendorInvoice.

| Flag | Effect on VendorInvoice drafts |
|------|--------------------------------|
| `allowDirectInvoice` | When `false`, reject `sourceMode=DIRECT` |
| `requirePoMatch` | When `true`, require at least one PO source link |
| `requireGrnMatch` | When `true`, require at least one GRN source link |

## Lookups

- `GET …/accounting/lookups/vendors`
- `GET …/accounting/lookups/vendors/:id`
- `GET …/accounting/lookups/purchase-orders`
- `GET …/accounting/lookups/purchase-orders/:id/invoice-eligibility`
- `GET …/accounting/lookups/grns`
- `GET …/accounting/lookups/grns/:id/invoice-eligibility`

## Frontend + tests (Wave 6)

- VI form: vendor picker uses `VendorMasterSelect source="accounting"`; PO/GRN pickers use `listPurchaseOrderLookups` / `listGrnLookups` (`eligibleOnly`) in API mode — direct purchase list APIs removed. `MasterRefreshModal` uses server preview/apply.
- Coverage: `backend/tests/finance/finance-ap-vendor-invoice-master-reuse.test.ts` (13 tests).

## Guardrails

- Do **not** create `FinanceVendor`.
- Do **not** change posting/approval/allocation/reversal formulas beyond soft-link revalidation hooks.
