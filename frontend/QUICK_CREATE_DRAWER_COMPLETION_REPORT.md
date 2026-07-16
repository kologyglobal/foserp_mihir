# Quick-Create Drawer Wiring — Completion Report

**Sprint:** P0 Quick-Create Drawer Wiring  
**Date:** 2026-06-23  
**Status:** Complete (P0 scope)

## Summary

Inline master/reference creation is now wired into transactional forms using the existing `RightDrawer` shell and a hardened `useQuickCreate` hook. New records are saved through `masterStore` / `qualityStore` (no duplicate stores), permissions are enforced before drawer open and on save, and parent form state is preserved because quick-create runs in a side drawer without navigation.

## Framework

| Component | Path | Role |
|-----------|------|------|
| `useQuickCreate` | `src/hooks/useQuickCreate.ts` | `openDrawer`, `closeDrawer`, `saveEntity`, `autoSelectCreatedRecord`, permission helpers |
| `saveQuickCreateEntity` | `src/utils/quickCreateService.ts` | Duplicate validation, role-aware draft/pending flags, store persistence |
| `canQuickCreateEntity` | `src/utils/quickCreatePermissions.ts` | Entity-level permission matrix |
| `QuickCreateSelect` | `src/components/quick-create/QuickCreateSelect.tsx` | Search + dropdown + Add New + empty state |
| `QuickCreateDrawerForm` | `src/components/quick-create/QuickCreateDrawerForm.tsx` | Inline entity forms inside drawer |
| `QcPlanMissingBlocker` | `src/components/quick-create/QcPlanMissingBlocker.tsx` | QC plan missing UX with quick-create CTA |
| `RightDrawer` | `src/components/design-system/RightDrawer.tsx` | Renders inline forms (legacy PO/WO links retained) |
| `uiStore` drawer context | `src/store/uiStore.ts` | `defaultValues`, typed `QuickCreateContext` |

### Behaviour guarantees

- Parent form does not reset when drawer opens/closes (no route change).
- `onCreated` callback auto-selects newly created record in parent field.
- Cancel closes drawer without calling `saveEntity`.
- Validation errors render inside drawer form.
- Unauthorized users see disabled **Add New** with denial reason tooltip/text.

## Forms Wired

| Screen | Entities | File |
|--------|----------|------|
| Inquiry Create/Edit | Customer, Contact, Product | `src/modules/sales/SalesForms.tsx` |
| Lead Create/Edit | Customer | `src/modules/sales/SalesForms.tsx` |
| Inquiry Detail / Quotation Detail | Payment terms (quotation draft) | `src/modules/sales/SalesPages.tsx` |
| Manual PR | Item (line level) | `src/modules/purchase/ManualPrFormPage.tsx` |
| PR Detail — Direct PO | Vendor | `src/modules/purchase/PurchasePages.tsx` |
| Job Work — Send Material | Vendor | `src/modules/execution-layer/JobWorkSendReceiveForms.tsx` |
| Dispatch — Transport tab | Transporter | `src/modules/dispatch/DispatchPages.tsx` |
| Customer 360 | Contact | `src/modules/entity360/Customer360Page.tsx` |
| Final / In-Process QC | Inspection plan blocker | `src/modules/quality/QualityPages.tsx` |

## Entity Drawers Created

| Entity | Drawer title | Store |
|--------|--------------|-------|
| Customer | Add New Customer | `masterStore.addCustomer` |
| Contact | Add New Contact | `masterStore.addCustomerContact` + sync primary on customer |
| Vendor | Add New Vendor | `masterStore.addVendor` |
| Item | Add New Item | `masterStore.addItem` (+ optional vendor map) |
| Product | Add New Product | `masterStore.addProduct` (Draft status) |
| Payment Terms | Add New Payment Terms | `masterStore.addCommercialTerm` |
| Tax Category | Add New Tax Category | `masterStore.addCommercialTerm` |
| Delivery Terms | Add New Delivery Terms | `masterStore.addCommercialTerm` |
| Transporter | Add New Transporter | `masterStore.addTransporter` |
| Inspection Plan | Add New Inspection Plan | `qualityStore.addInspectionPlan` |

### Master extensions (same store, not duplicated)

- `customerContacts[]`, `transporters[]`, `commercialTerms[]` in `masterStore`
- Seeds in `src/data/masters/referenceSeed.ts`
- Persist merge updated in `src/utils/persistMigration.ts`

## Permissions Applied

| Entity | Who can quick-create |
|--------|---------------------|
| Customer / Contact / Product | `sales.create` or `masters.create` |
| Vendor | `purchase.create` or `masters.create` (draft/inactive if purchase user only) |
| Item | `masters.create`, `purchase.create`, or `engineering.create` (draft if no release rights) |
| Payment / Tax / Delivery terms | `masters.create`, `accounts.create`, `purchase.approve`, or `sales.approve` |
| Transporter | `dispatch.create` or `masters.create` |
| Inspection Plan | `quality.create` or `quality.approve` |

**Blocked roles (examples):** `shop_floor` cannot create customers; denial reason shown on disabled buttons.

## Tests Added

`npm run test:cross-module-creation` — **25 checks** (14 quick-create acceptance + store-chain regression):

1. QC-1 / QC-1b — Inquiry customer quick-create wiring + store auto-select
2. QC-2 / QC-2b — Contact quick-create wiring + customer link
3. QC-3 — Quotation payment terms quick-create wiring
4. QC-4 — Sales customer quick-create for SO path
5. QC-5 — Manual PR item quick-create
6. QC-6 / QC-6b — PO vendor quick-create wiring + auto-select id
7. QC-7 — Job Work vendor quick-create
8. QC-8 / QC-8b — Dispatch transporter wiring + save
9. QC-9 / QC-9b — QC plan blocker + plan save
10. QC-10 — Unauthorized role blocked
11. QC-11a–c — Duplicate customer/vendor/item blocked
12. QC-12 — Parent data preserved (drawer open/close, no master mutation)
13. QC-13 — New master in store immediately
14. QC-14 — Cancel drawer does not create record

Included in `npm run test:ci` via existing `test:cross-module-creation` entry.

## Remaining / Unsupported Quick-Create Areas

| Area | Notes |
|------|-------|
| Quotation / SO standalone create forms | SO only from approved quotation; no direct SO form yet |
| RFQ vendor invite checkboxes | Vendor quick-create on PR Direct PO + Job Work; RFQ still uses checkbox list (vendors appear after create) |
| PO line item entry | Item quick-create on Manual PR; PO amend lines not wired |
| BOM line entry | Not wired (engineering role gate documented in sprint spec) |
| Inventory adjustment | Not wired |
| Invoice tax/delivery terms UI | Commercial terms store ready; invoice form fields not yet using `QuickCreateSelect` |
| Subcontract Send (separate from Job Work send) | Uses same vendor pattern where applicable |
| Sales Order edit customer | SO is read-only from quotation chain |
| Full master parity | Drawer forms are condensed; **Open full master form →** link provided |

## Build & CI

- `npm run build` — pass
- `npm run test:cross-module-creation` — **25/25 pass**
