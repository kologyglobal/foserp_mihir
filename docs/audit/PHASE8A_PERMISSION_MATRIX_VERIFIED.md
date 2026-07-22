# Phase 8A — Permission Matrix Verified (spot audit)

**Date:** 2026-07-21  
**Backend catalog:** `backend/src/constants/permissions.ts` (`PERMISSIONS` const)  
**FE hooks:** `frontend/src/utils/permissions/*.ts`  
**Scope:** Sample verified permissions for `manufacturing.*`, `finance.*`, `quality.*`, `dispatch.*`, `inventory.*`; FE-only `accounting.*` namespaces; tenant-isolation test evidence list.

---

## Out of scope (spot-check)

Full negative permission matrices (every role × every action) and dedicated cross-tenant live runs are **OUT OF SCOPE** unless already present in existing test files. This doc samples catalog alignment and lists tests that **claim** tenant isolation — it does not re-execute them.

---

## How FE gating works (spot)

| Layer | Behaviour |
|-------|-----------|
| `ProtectedOutlet` / `canRoute` | CRM / purchase / manufacturing special cases; else `ROUTE_PERMISSION_MAP` coarse keys (`quality.view`, `dispatch.view`, `production.view`, …). **`/accounting/*` has no matrix prefix.** |
| Page hooks | Fine-grained `use*Permissions()` — may read JWT `finance.*` / `manufacturing.*` / `inventory.*` in API mode, or demo role packs |
| Security SoT | Backend middleware + `PERMISSIONS` catalog — UI gates are soft |

---

## 1. Backend sample — `manufacturing.*`

Verified present in backend catalog (representative sample; catalog is larger):

| Permission | In BE catalog | FE hook |
|------------|---------------|---------|
| `manufacturing.view` | Yes | `manufacturing.ts` — `useManufacturingPermissions`, route map |
| `manufacturing.dashboard.view` | Yes | Yes |
| `manufacturing.bom.view` / `.create` / `.edit` / `.activate` / `.deactivate` / `.view_cost` | Yes | Yes |
| `manufacturing.production_plan.view` / `.create` / `.edit` / `.release` / `.close` / `.create_work_order` | Yes | Yes |
| `manufacturing.work_orders.view` / `.create` / `.edit` / lifecycle (`.start`/`.hold`/`.release`/`.assign`/…) | Yes | Yes (`useManufacturingWorkOrderPermissions`) |
| `manufacturing.demand.*`, `manufacturing.stage.*`, `manufacturing.progress.*` | Yes | Yes (Phase 2A) |
| `manufacturing.daily_production.*`, `manufacturing.assignment.*`, `manufacturing.operator.*`, `manufacturing.issue.*` | Yes | Yes (Phase 2B) |
| `manufacturing.materials.*`, `manufacturing.wip.move`, `manufacturing.job_work.*` | Yes | Yes |
| `manufacturing.runtime_change.*` | Yes | Yes |
| `manufacturing.setup.view`, `profile.*`, `work_centre.*`, `machine.*`, `routes.*` | Yes | `useManufacturingSetupPermissions` |
| `manufacturing.fg_receipt.*`, `manufacturing.wip_stock.view`, `manufacturing.material_position.view`, … | Yes | Partial in FE list (setup/ops pages may check subset) |

### FE-only / FE-ahead manufacturing keys (not in BE catalog)

| FE key(s) | Notes |
|-----------|--------|
| `manufacturing.production_plan.calculate` / `.review` / `.clone` / `.suggestion_review` | Phase 6A1 planning workbench — FE-only |
| `manufacturing.unplanned_demand.view` | FE planning |
| `manufacturing.planning_exception.view` / `.acknowledge` | FE planning |
| `manufacturing.correction.*` (view/request/apply/approve/reject/admin/reverse.*) | FE Phase 5C corrections — **not** in BE `PERMISSIONS` |

**FE module:** `frontend/src/utils/permissions/manufacturing.ts` (+ re-exports in `index.ts`).

---

## 2. Backend sample — `finance.*`

Backend uses the `finance.*` namespace (not `accounting.*`). Sample verified groups:

### Setup / journals / GL

| Permission sample | In BE | FE hook file |
|-------------------|-------|--------------|
| `finance.view`, `finance.settings.view` / `.manage` | Yes | `finance.ts` |
| `finance.legal_entity.*`, `finance.branch.*`, `finance.financial_year.*`, `finance.period.*` | Yes | `finance.ts` |
| `finance.coa.*`, `finance.default_mapping.*`, `finance.number_series.*`, `finance.cost_centre.*`, `finance.approval_rule.*` | Yes | `finance.ts` |
| `finance.activate`, `finance.audit.view` | Yes | `finance.ts` |
| `finance.voucher.*` (view/create/edit/submit/approve/post/reverse/cancel) | Yes | `finance.ts` (+ legacy `vouchers.ts` uses **FE-only** `accounting.voucher.*`) |
| `finance.gl.view`, `finance.posting_event.view`, `finance.posting_rule.*` | Yes | Partial (`finance.ts` has `gl.view`; posting_rule less wired in setup FE) |

### AR (`finance.ar.*`)

| Sample | In BE | FE hook |
|--------|-------|---------|
| `finance.ar.view`, `finance.ar.invoice.*`, `finance.ar.receipt.*`, `finance.ar.credit_note.*`, `finance.ar.allocation.*`, `finance.ar.reconcile.view` | Yes | `moneyIn.ts` — `useMoneyInPermissions` |

Legacy parallel UI uses **FE-only** `accounting.receivables.*` (`receivables.ts`) — not in BE catalog.

### AP (`finance.ap.*`)

| Sample | In BE | FE hook |
|--------|-------|---------|
| `finance.ap.view`, `finance.ap.vendor_invoice.*`, `finance.ap.open_item.view` | Yes | `moneyOut.ts` |
| `finance.ap.payment.*`, `finance.ap.allocation.*`, `finance.ap.advance.view` | Yes | `moneyOut.ts` |
| `finance.ap.adjustment.*`, `finance.ap.corrections.view` | Yes | `moneyOut.ts` |
| `finance.ap.reconciliation.*`, `finance.ap.close_gate.*` | Yes | `moneyOut.ts` |

Legacy parallel UI: **FE-only** `accounting.payables.*` (`payables.ts`).

### Treasury / bank recon / FA

| Sample | In BE | FE hook |
|--------|-------|---------|
| `finance.treasury.account.*`, `finance.treasury.statement.*`, `finance.treasury.transfer.*`, `finance.treasury.cheque.*`, `finance.treasury.adjustment.*`, `finance.treasury.standing_instruction.*`, `finance.treasury.book.view`, `finance.treasury.liquidity.view`, … | Yes | `treasuryTransfer.ts`, `treasuryStatement.ts`, `treasuryCheque.ts`, `treasuryAdjustment.ts`, `treasuryBook.ts`, `standingInstruction.ts`, … |
| `finance.bank.reconciliation.*` | Yes | `bankReconciliation.ts` |
| `finance.bank_connector.*` | Yes | `treasuryConnector.ts` |
| `finance.fa.view` / `.create` / `.edit` / `.capitalize` / `.depreciate` / `.dispose` / `.transfer` | Yes | `fixedAssets.ts` (`FIXED_ASSETS_API_PERMISSIONS`) |

Note: `bankCash.ts` still gates primarily on **FE-only** `accounting.bank_cash.*` (demo role packs); live treasury submodules map JWT `finance.treasury.*` → those UI flags.

---

## 3. Backend sample — `quality.*` / `dispatch.*`

Backend catalog (coarse ERP-style actions only):

```text
quality.view | create | edit | submit | approve | release | post | cancel | close | print | export | override
dispatch.view | create | edit | submit | approve | release | post | cancel | close | print | export | override
```

| Namespace | In BE | Dedicated FE hook module? | Shell / matrix |
|-----------|-------|---------------------------|----------------|
| `quality.*` | Yes (coarse) | **No** dedicated `quality.ts` under `utils/permissions/` | `ROUTE_PERMISSION_MAP` → `quality.view`; demo `ROLE_PERMISSION_MATRIX` + `canPermission('quality', …)` |
| `dispatch.*` | Yes (coarse) | **No** dedicated `dispatch.ts` | `ROUTE_PERMISSION_MAP` → `dispatch.view`; same legacy matrix |

Related (not `quality.*` / `dispatch.*` roots):

| Permission | In BE | FE |
|------------|-------|-----|
| `purchase.quality.view` / `.inspect` | Yes | `purchase.ts` |
| `inventory.quality.*` | Yes | `inventory.ts` |
| `manufacturing.quality.*` | Yes | `manufacturing.ts` |

Fine-grained QC inspection/NCR/plan permissions beyond the coarse `quality.*` list are **not** in the BE catalog as a separate tree (API routes typically reuse `quality.*` or manufacturing/inventory quality keys).

---

## 4. Backend sample — `inventory.*`

| Sample | In BE | FE hook |
|--------|-------|---------|
| `inventory.view`, `inventory.create` / `.edit` / `.submit` / `.approve` / `.release` / `.post` / … | Yes | `inventory.ts` (coarse + fine) |
| `inventory.items.*`, `inventory.stock.view`, `inventory.view_cost`, `inventory.view_audit` | Yes | Yes |
| `inventory.receipts.*`, `inventory.issues.*`, `inventory.transfers.*`, `inventory.adjustments.*`, `inventory.returns.*` | Yes | Yes |
| `inventory.quality.*` | Yes | Yes |
| `inventory.batch.view`, `inventory.serial.view`, `inventory.reservations.*` | Yes | Yes |
| `inventory.stock_count.*`, `inventory.reports.view`, `inventory.setup.manage`, … | Yes | Yes (forward-compatible keys in FE list) |

**FE module:** `frontend/src/utils/permissions/inventory.ts` — `useInventoryPermissions`, `canAccessInventoryShell`, route/nav helpers.

---

## 5. FE-only permission namespaces (NOT in backend catalog)

These appear in `frontend/src/utils/permissions/` (and page gates) but **zero** `accounting.*` strings exist in `backend/src/constants/permissions.ts`.

| FE namespace | Hook file | Backend equivalent (if any) |
|------------|-----------|------------------------------|
| `accounting.fixed_assets.*` | `fixedAssets.ts` | Partial: `finance.fa.*` (API subset) |
| `accounting.budgeting.*` | `budgeting.ts` | **None** |
| `accounting.period_close.*` | `periodClose.ts` | Partial soft-map to `finance.period.*` in API mode |
| `accounting.tax.*` | `taxCompliance.ts` | **None** (tax/GST returns deferred) |
| `accounting.mfg_costing.*` | `manufacturingAccounting.ts` | **None** (production GL/costing deferred) |
| `accounting.receivables.*` | `receivables.ts` | Live SoT: `finance.ar.*` via Money In |
| `accounting.payables.*` | `payables.ts` | Live SoT: `finance.ap.*` via Money Out |
| `accounting.bank_cash.*` | `bankCash.ts` | Live SoT: `finance.treasury.*` / `finance.bank.reconciliation.*` |
| `accounting.reports.*` | `financialReports.ts` | **None** (reports workspace demo) |
| `accounting.ledger.*` | `ledgerEntries.ts` | Partial: `finance.gl.view` / voucher ledger reads |
| `accounting.voucher.*` | `vouchers.ts` | Live SoT: `finance.voucher.*` |
| `accounting.coa.*` | `chartOfAccounts.ts` | Live SoT: `finance.coa.*` (settings) |

Also FE-ahead (manufacturing): `manufacturing.correction.*`, planning Phase 6A1 keys listed in §1.

---

## 6. FE hooks inventory (by namespace)

| File | Primary keys | Aligns with BE? |
|------|--------------|-----------------|
| `manufacturing.ts` | `manufacturing.*` | Mostly yes; correction/planning extras FE-only |
| `finance.ts` | `finance.*` (setup + voucher + gl) | Yes |
| `moneyIn.ts` | `finance.ar.*` | Yes |
| `moneyOut.ts` | `finance.ap.*` | Yes |
| `treasury*.ts`, `bankReconciliation.ts`, `standingInstruction.ts` | `finance.treasury.*` / `finance.bank.*` / connectors | Yes |
| `fixedAssets.ts` | `accounting.fixed_assets.*` + `finance.fa.*` | Hybrid |
| `inventory.ts` | `inventory.*` | Yes |
| `purchase.ts` | `purchase.*` | Yes (out of primary sample) |
| `crm.ts` | `crm.*` | Yes (out of primary sample) |
| `budgeting.ts`, `periodClose.ts`, `taxCompliance.ts`, `manufacturingAccounting.ts`, `receivables.ts`, `payables.ts`, `bankCash.ts`, `financialReports.ts`, `ledgerEntries.ts`, `vouchers.ts`, `chartOfAccounts.ts` | `accounting.*` | **FE-only** (or hybrid soft-map) |
| *(none)* | `quality.*` / `dispatch.*` fine hooks | Coarse only via matrix / `canPermission` |

---

## Tenant-isolation evidence (existing tests)

Spot-check does **not** re-run these. Filenames that claim or include tenant isolation / cross-tenant asserts:

### Dedicated `*tenant-isolation*` files

| File |
|------|
| `backend/tests/crm-tenant-isolation.test.ts` |
| `backend/tests/master-tenant-isolation.test.ts` |
| `backend/tests/finance/finance-ap-payment-allocation-tenant-isolation.test.ts` |
| `backend/tests/finance/finance-treasury-transfer-tenant-isolation.test.ts` |
| `backend/tests/finance/finance-treasury-adjustment-tenant-isolation.test.ts` |
| `backend/tests/finance/finance-bank-reconciliation-tenant-isolation.test.ts` |

### Finance / CRM / MFG / quality / inventory suites with isolation cases (in-file)

| File | Domain |
|------|--------|
| `backend/tests/finance/finance-journals.test.ts` | Finance journals |
| `backend/tests/finance/finance-ap-vendor-adjustment-foundation.test.ts` | AP adjustments |
| `backend/tests/finance/finance-ap-gl-reconciliation.test.ts` | AP↔GL recon |
| `backend/tests/finance/finance-ap-reporting.test.ts` | AP reporting |
| `backend/tests/finance/finance-ar-reporting.test.ts` | AR reporting |
| `backend/tests/finance/finance-fixed-assets.test.ts` | Fixed assets |
| `backend/tests/finance/finance-treasury-cheque-posting.test.ts` | Treasury cheques |
| `backend/tests/finance/finance-bank-connector-scaffold.test.ts` | Bank connectors |
| `backend/tests/finance/finance-treasury-foundation.test.ts` | Treasury foundation (section “Tenant isolation”) |
| `backend/tests/manufacturing-phase1.test.ts` | Manufacturing |
| `backend/tests/manufacturing-phase2a.test.ts` | Manufacturing |
| `backend/tests/manufacturing-phase2b.test.ts` | Manufacturing |
| `backend/tests/manufacturing-phase3c.test.ts` | Manufacturing materials |
| `backend/tests/manufacturing-phase6a.test.ts` | Manufacturing planning |
| `backend/tests/quality-phase4a.test.ts` | Quality |
| `backend/tests/inventory-phase3a.test.ts` | Inventory |
| `backend/tests/purchase-phase3b.test.ts` | Purchase (adjacent) |

CRM live runner historically: `npm run test:crm-live` → `crm-e2e` + `crm-tenant-isolation`.

---

## Spot findings (permissions)

1. **Live finance** FE correctly tracks `finance.*` for Money In/Out, journals setup, and treasury submodules.  
2. **Large demo accounting surfaces** still invent `accounting.*` keys that the API will never grant — JWT admin may still pass page hooks only via demo role packs or soft-maps.  
3. **Quality / dispatch** remain coarse (`quality.view` / `dispatch.view`) with no fine FE modules.  
4. **Manufacturing** FE is the most complete BE-aligned set, with known FE-only correction + planning keys.  
5. **Shell gap:** `/accounting/*` not in `ROUTE_PERMISSION_MAP` — deep links are not denied by `ProtectedOutlet`.

---

## Related

- [`PHASE8A_FRONTEND_ROUTE_MATRIX.md`](./PHASE8A_FRONTEND_ROUTE_MATRIX.md)  
- [`PHASE8A_MOCK_DEMO_AUDIT.md`](./PHASE8A_MOCK_DEMO_AUDIT.md)  
