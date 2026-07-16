# Duplicate UI Components — Phase 11 Audit

**Date:** 2026-07-11  
**Status:** Documented — not deleted (intentional domain barrels / shared shells)

---

## Removed in Phase 11 (were compat re-exports only)

| Old path | Canonical path |
|----------|----------------|
| `components/crm/Quotation*.tsx` (20 files) | `components/quotations/` |
| `modules/crm/QuotationCrmPages.tsx` | `modules/quotations/QuotationCrmPages.tsx` |
| `modules/crm/CrmCardFormShell.tsx` | `components/crm/CrmCardFormShell.tsx` |
| `modules/crm/Lead360Workspace.tsx` | `components/crm/Lead360Workspace.tsx` |
| `modules/purchase/PurchaseCardFormShell.tsx` | `components/purchase/PurchaseCardFormShell.tsx` |
| `modules/inventory/InventoryDashboard.tsx` | `components/inventory/InventoryDashboard.tsx` |

These were thin re-export shims with zero unique UI logic — safe to delete after importer migration.

---

## Retained duplicates (proven in use / different roles)

| Component A | Component B | Reason kept |
|-------------|-------------|-------------|
| `components/crm/index.ts` barrel | `components/quotations/index.ts` | CRM barrel re-exports quotations for CRM pages; quotations module owns implementation |
| `components/masters/MasterListShell.tsx` | `modules/masters/shared/EnterpriseMasterShell.tsx` | Different layout contracts — list vs enterprise 360 shell |
| `components/erp/card-form/ErpCardFormEssentials.tsx` | `components/crm/CrmCardFormShell.tsx` | Generic ERP card form vs CRM-specific enterprise shell |
| `components/purchase/purchaseCardFormShared.tsx` | `components/purchase/PurchaseCardFormShell.tsx` | Shared field helpers vs page shell wrapper |
| `design-system/DataGrid.tsx` | `components/design-system/DataGrid.tsx` | Legacy alias — both referenced; consolidate in future pass |
| `modules/sales/SalesPages.tsx` quotation list | `modules/quotations/QuotationCrmPages.tsx` | Sales route embeds quotation list; quotations module owns CRUD/360 |

---

## Type barrel re-exports (intentionally kept)

`types/crm.ts` and `types/sales.ts` re-export quotation types from `types/quotation.ts` for domain ergonomics. These are **not** standalone shim files — they contain primary CRM/sales domain types. Importers may use either path; canonical quotation-only imports should prefer `types/quotation.ts` for new code.

---

## Verification

- No route URLs changed
- `npm run test:folder-structure` verifies shim removal
- `npm run test:route-integrity` verifies 438 path baseline
