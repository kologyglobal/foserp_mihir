# Phase 8A — Database / Migration Audit

**Date:** 2026-07-21  
**Scope:** Read-only summary of Prisma migrations, known schema issues, manufacturing/inventory/quality model presence, Decimal/`tenantId` spot-checks.  
**Related:** [`PHASE8A_BASELINE_RESULTS.md`](PHASE8A_BASELINE_RESULTS.md), [`PHASE8A_REPOSITORY_MAP.md`](PHASE8A_REPOSITORY_MAP.md).

---

## 1. Migrations folder

| Item | Evidence | Finding |
|------|----------|---------|
| Location | `backend/prisma/migrations/` | Active tree for deploy |
| Count (this audit) | `*/migration.sql` under that folder | **~80 unique folders** (glob ~88 hits with Windows path-separator duplicates). Baseline START reported **69** via `prisma migrate status` — tree has grown with finance/mfg/quality/dispatch/consent. |
| Lock file | `backend/prisma/migrations/migration_lock.toml` | Present (MySQL) |
| Deploy path | Project rule / `scripts/prisma-cli.ts` | Prefer `npx tsx scripts/prisma-cli.ts migrate deploy` — not interactive `db:migrate` |
| Host copies | `deploy/host-package/…`, `release/fos-erp-host/…` | Older subsets — **do not** treat as source of truth |

### Baseline migrate status (2026-07-21 START)

From `PHASE8A_BASELINE_RESULTS.md` (exit **1**):

- Last common: `20260721010000_finance_phase5d1_bank_connectors`
- Pending on disk (not applied to local DB at that time):  
  `20260721010000_manufacturing_phase6a1_demand_consolidation`,  
  `20260721020000_quality_phase7b`
- DB-only (not found locally under those names):  
  `20260720160000_manufacturing_phase2b_daily_ops`,  
  `20260720180000_purchase_phase3b_requisition`,  
  `20260720180000_finance_ar_sales_invoice_reversal`

**Classification:** history **drift** (renames/replacements + pending). Do **not** force-reset as part of Phase 8A docs.

### Recent finance migrations (20260718+)

Representative folders present on disk:

| Folder | Theme |
|--------|--------|
| `20260718090000_finance_phase3b3_receipt_draft_fields` | AR receipt drafts |
| `20260718110000_finance_phase3b5_receipt_allocations` | Receipt allocations |
| `20260718120000_customer_credit_notes` | Credit notes |
| `20260718130000_finance_phase3c5_credit_note_allocations` | CN allocations |
| `20260718140000_finance_ar_document_reversal` | AR reverse |
| `20260718150000_add_vendor_invoice_and_ap_open_item_foundation` | AP foundation |
| `20260718160000_finance_phase4a3_vendor_invoice_workflow` | VI workflow |
| `20260718170000_add_vendor_payment_and_ap_allocation_foundation` | Vendor payment |
| `20260718200000_add_vendor_payment_uniqueness_key` | Uniqueness |
| `20260719010000_finance_phase4c1_ap_reversal` | AP reverse |
| `20260719020000_finance_phase4c2_vendor_adjustment_foundation` | Vendor adjustments |
| `20260719210000_finance_phase4d2_ap_reconciliation` | AP recon |
| `20260720010000_finance_phase5a1_treasury_foundation` | Treasury |
| `20260720020000_finance_phase5a2_bank_statement_import` | Statement import |
| `20260720030000_finance_phase5a3_bank_reconciliation` | Bank recon |
| `20260720040000_*` / transfers / cheques / adjustments / liquidity | Bank & Cash 5B–5C |
| `20260720260000_*` / `20260720280000_*` / `20260720290000_*` / `20260721010000_finance_fixed_assets_*` | Fixed assets 1–3 |
| `20260721010000_finance_phase5d1_bank_connectors` | Connectors scaffold |
| `20260721120000_finance_phase5d3_bank_connector_consent` | Consent table |

**Timestamp collisions:** multiple folders share prefix `20260721010000_*` (bank connectors, FA disposal document, warehouse mapping, dispatch). Requires careful apply order / history hygiene.

---

## 2. Known schema issues

### BankConnectorConsent

| Checkpoint | Status |
|------------|--------|
| Baseline START (`prisma-cli validate`) | **Fail** — Tenant relation `bankConnectorConsents BankConnectorConsent[]` without model (`PHASE8A_BASELINE_RESULTS`) |
| Current schema | **`model BankConnectorConsent`** present at `backend/prisma/schema.prisma` ~10993–11016; enum `BankConnectorConsentStatus`; mapped to `bank_connector_consents` |
| Relation | `BankConnector.consents` + `Tenant` relation |
| Migration | `20260721120000_finance_phase5d3_bank_connector_consent/migration.sql` |

**Audit note:** START P0 (missing model) appears **mitigated in working tree**. Re-run `npx tsx scripts/prisma-cli.ts validate` before treating as closed. Consent is scaffold (no live token exchange) per schema comment.

### Duplicate / overlapping finance AR reverse migrations

Multiple folders touch sales-invoice reversal naming (`20260718140000`, `20260720060000`, `20260720170000`, `20260720180000_*`). Aligns with baseline **DB-only vs disk** drift — track under migration-drift defect, not silent rewrite.

---

## 3. Manufacturing / inventory / quality key models

Grep of `backend/prisma/schema.prisma` (`^model …`):

| Domain | Models found (selected) | Notes |
|--------|-------------------------|-------|
| Manufacturing masters | `ManufacturingProfile`, work-centre/machine/BOM/routing (phase 1 migs) | Present |
| Demand / WO | `ProductionDemand`, `ProductionOrder` | WO entity is **`ProductionOrder`**, not `WorkOrder` |
| Job work | `JobWorkOrder`, `JobWorkMaterialLine`, `JobWorkDispatch*`, `JobWorkReceipt` | Phase 4B |
| Inventory | `InventoryStockBalance`, `InventoryStockMovement`, `InventoryStockReservation` | Phase 3A |
| Fulfilment / dispatch | `SalesOrderLineFulfilment`, `OutboundDispatch`, `OutboundDispatchLine` | Phase 7C0 |
| Quality | `QualityInspectionPlan*`, `QualityInspection*`, parameter results | Phase 4A/4B |
| Purchase | `PurchaseRequisition*` | Phase 3B — **no GRN model** in audited set |
| CRM SO | `CrmSalesOrder` | Phase 1 |
| Finance treasury / FA | `BankStatement*`, `TreasuryTransfer`, `BankConnector`, `BankConnectorConsent`, `FixedAsset*` | Present |
| Budgeting | **Not found** as first-class budget models in this audit | Matches DEMO_ONLY FE |

---

## 4. Decimal / `tenantId` spot-checks

| Model | Path | `tenantId` | Decimal pattern |
|-------|------|------------|-----------------|
| `InventoryStockBalance` | ~8205 | Yes | `onHandQty` / `reservedQty` `@db.Decimal(18, 4)` |
| `InventoryStockMovement` | ~8225 | Yes | `quantity` / `balanceAfter` `Decimal(18,4)`; `rate`/`value` `Decimal(18,2)` |
| `ProductionOrder` | ~7524 | Yes | `plannedQuantity`, completed/rework/reject/scrap `@db.Decimal(18, 4)` |
| `SalesInvoice` | ~2940 | Yes | Amount fields `Decimal(18,4)` (AR pattern) |

**Verdict:** Spot-checked transactional qty/money fields follow **tenant-scoped + Decimal** conventions. No evidence in this sample of float money columns on these models.

---

## 5. Prisma CLI health (from baseline — not re-run in matrix step)

| Command | Exit | Note |
|---------|------|------|
| Raw `npx prisma validate` | 1 | Missing `DATABASE_URL` in shell (**environment**) |
| `npx tsx scripts/prisma-cli.ts validate` | 1 | Was `BankConnectorConsent` missing (**business**) — re-check after model add |
| `prisma-cli generate` | 0 | Client generated |
| `prisma-cli migrate status` | 1 | History drift |

---

## 6. Recommendations (docs only — no action taken)

1. Re-validate schema after consent model add; apply consent migration deliberately.  
2. Reconcile `_prisma_migrations` vs disk (renamed 2B/3B/AR reverse folders) with an explicit ops plan.  
3. Avoid collapsing timestamp-colliding `20260721010000_*` folders without history review.  
4. Keep budgeting out of pilot until schema + API exist.

*End of migration audit.*
