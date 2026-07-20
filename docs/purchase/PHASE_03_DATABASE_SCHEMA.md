# Phase 03 — Purchase Database Schema

**Date:** 2026-07-20  
**Prerequisite:** [`PHASE_01_PURCHASE_AUDIT.md`](./PHASE_01_PURCHASE_AUDIT.md), [`PHASE_02_PURCHASE_BUSINESS_RULES.md`](./PHASE_02_PURCHASE_BUSINESS_RULES.md)  
**Scope:** Prisma + MySQL 8 foundation for Purchase transactional documents  
**Status:** Schema + migration applied on local `fos_erp` (additive)

---

## Summary

| Item | Detail |
|------|--------|
| Migration name | `20260720120000_add_purchase_requisition_planning_rfq` |
| Migration path | `backend/prisma/migrations/20260720120000_add_purchase_requisition_planning_rfq/migration.sql` |
| Schema file | `backend/prisma/schema.prisma` |
| Destructive ops | **None** (no DROP / RESET) |
| Cascade on purchase docs | **None** — parent/child FKs use `ON DELETE RESTRICT`; optional FKs use `ON DELETE SET NULL` |
| Money / qty | `Decimal(18,4)` qty, `Decimal(18,2)` rates/amounts |
| Soft delete | Headers: `deletedAt`; planning rows: `deletedAt`; lines generally hard-retained with parent soft-delete |

---

## Models created (14)

| Prisma model | MySQL table |
|--------------|-------------|
| `PurchaseRequisition` | `purchase_requisitions` |
| `PurchaseRequisitionLine` | `purchase_requisition_lines` |
| `PurchasePlanningRow` | `purchase_planning_rows` |
| `RequestForQuotation` | `request_for_quotations` |
| `RequestForQuotationLine` | `request_for_quotation_lines` |
| `RfqVendor` | `rfq_vendors` |
| `VendorQuotation` | `vendor_quotations` |
| `VendorQuotationLine` | `vendor_quotation_lines` |
| `VendorComparison` | `vendor_comparisons` |
| `VendorComparisonLine` | `vendor_comparison_lines` |
| `PurchaseOrder` | `purchase_orders` |
| `PurchaseOrderLine` | `purchase_order_lines` |
| `PurchaseApproval` | `purchase_approvals` |
| `PurchaseStatusHistory` | `purchase_status_histories` |

> Prisma model name is `RfqVendor` (maps to table `rfq_vendors`) for the RFQ vendor invite entity requested as RFQVendor.

---

## Models updated (relations only)

| Model | Change |
|-------|--------|
| `Tenant` | Added reverse relations to all 14 purchase models |
| `MasterItem` | Reverse relations for PR/PPS/RFQ/VQ/PO lines |
| `MasterUom` | Reverse relations for line UOMs |
| `MasterWarehouse` | Reverse relations for PR header/lines |
| `MasterVendor` | Reverse relations for preferred/selected/last vendors, RFQ invites, VQ, comparison award, PO |

No existing columns were altered or dropped on those models.

---

## Enums created

Aligned with Phase 02 official statuses (UPPER_SNAKE in DB):

- `PurchaseRequisitionStatus`, `PurchaseRequisitionLineStatus`
- `PurchasePlanningStatus`, `PurchasePlanningPurchaseType`, `PurchasePriority`
- `RequestForQuotationStatus`, `RfqVendorInviteStatus`
- `VendorQuotationStatus`, `VendorComparisonStatus`
- `PurchaseOrderStatus`, `PurchaseOrderOrigin`
- `PurchaseApprovalDocumentType`, `PurchaseApprovalStatus`
- `PurchaseStatusHistoryDocumentType`

---

## Tables created

Same 14 tables listed above under Models created.

---

## Unique constraints created

| Table | Constraint |
|-------|------------|
| `purchase_requisitions` | `(tenantId, requisitionNumber)` |
| `purchase_requisition_lines` | `(tenantId, purchaseRequisitionId, lineNumber)` |
| `purchase_planning_rows` | **`(tenantId, purchaseRequisitionLineId)`** (mandatory business key) |
| `purchase_planning_rows` | `(purchaseRequisitionLineId)` alone (Prisma 1:1) |
| `purchase_planning_rows` | `(tenantId, planningNumber)` |
| `request_for_quotations` | `(tenantId, rfqNumber)` |
| `request_for_quotation_lines` | `(tenantId, requestForQuotationId, lineNumber)` |
| `rfq_vendors` | `(tenantId, requestForQuotationId, vendorId)` |
| `vendor_quotations` | `(tenantId, quotationNumber)` |
| `vendor_quotation_lines` | `(tenantId, vendorQuotationId, lineNumber)` |
| `vendor_comparisons` | `(tenantId, comparisonNumber)` |
| `vendor_comparison_lines` | `(tenantId, vendorComparisonId, lineNumber)` |
| `purchase_orders` | `(tenantId, orderNumber)` |
| `purchase_order_lines` | `(tenantId, purchaseOrderId, lineNumber)` |

---

## Indexes created (highlights)

### `purchase_planning_rows` (as required)

- `tenantId`
- `(tenantId, status)`
- `(tenantId, purchaseRequisitionId)`
- `(tenantId, purchaseRequisitionLineId)`
- `(tenantId, selectedVendorId)`
- `(tenantId, buyerId)`
- `(tenantId, requiredDate)`
- `(tenantId, purchaseOrderId)`
- plus `deletedAt`, `actionMessage`

### Other documents

Composite `(tenantId, status)`, `(tenantId, deletedAt)`, document FKs, vendor/item indexes on each transactional table as defined in schema.

---

## Key field notes

### `PurchaseRequisition`

Includes `rfqRequired`, lifecycle timestamps (`submittedAt` / `approvedAt` / `rejectedAt`), `createdById` / `updatedById` (UUID strings, no User FK — matches project audit-actor pattern), `warehouseId` → `MasterWarehouse`.

`departmentId` / `requestedById` stored as string IDs without FK (no department master / avoids User relation sprawl).

### `PurchaseRequisitionLine`

`lineNumber`, snapshots, `Decimal` qty/rate/amount, optional `itemId` / `uomId` / `warehouseId` / `preferredVendorId`, `binId` as string (BIN master table not yet in Prisma).

### `PurchasePlanningRow`

Mandatory unique `(tenantId, purchaseRequisitionLineId)`; netting fields as `Decimal`; links to PR, PR line, optional PO.

### PO lines

Optional `purchaseRequisitionLineId` + `purchasePlanningRowId` for Phase 02 linkage rules.

---

## Commands run

```text
npx tsx scripts/prisma-cli.ts format
npx tsx scripts/prisma-cli.ts validate
npx tsx scripts/prisma-cli.ts migrate deploy   # applied purchase migration (+ caught-up prior finance migrations that were pending locally)
npx tsx scripts/prisma-cli.ts generate
npm run typecheck                              # pass
```

**Local note:** `migrate deploy` also applied previously pending finance/CRM migrations that were already in the repo but not yet on this MySQL instance. The purchase migration itself is additive-only CREATE TABLE + FK.

Shadow-database `migrate dev` was unavailable (DB user cannot create shadow DB); migration SQL was produced via `migrate diff` against the live schema then trimmed to purchase objects only.

---

## Files changed

| File | Action |
|------|--------|
| `backend/prisma/schema.prisma` | Added purchase enums + 14 models; Tenant/master reverse relations |
| `backend/prisma/migrations/20260720120000_add_purchase_requisition_planning_rfq/migration.sql` | **Created** |
| `docs/purchase/PHASE_03_DATABASE_SCHEMA.md` | **Created** (this file) |

---

## Out of scope (next phases)

- Purchase API routes / services / validators  
- FE dual-mode hydration  
- GRN / QI / Invoice / Payment tables  
- `CodeSeriesEntity` expansion for PR/PO/RFQ numbers  
- Master BIN table (binId is opaque string for now)

---

## Verification checklist

- [x] prisma format  
- [x] prisma validate  
- [x] prisma generate  
- [x] migration applied (`add_purchase_requisition_planning_rfq`)  
- [x] TypeScript `tsc --noEmit`  
- [x] No cascade delete between purchase documents  
- [x] Unique `(tenantId, purchaseRequisitionLineId)` on planning  
