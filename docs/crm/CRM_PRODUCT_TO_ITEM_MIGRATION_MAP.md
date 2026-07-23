# CRM / Sales: Product Master → Item Master Migration Map

**Status:** Phase 1 — Audit complete (no code cut-over yet)  
**Date:** 2026-07-23  
**Rule:** Sell / buy / make / stock / issue / receive / dispatch / cost the **Item**.  
**Constraint:** Do **not** drop `master_products` or remove `productId` until Phase 9–10 sign-off.

---

## 1. Target architecture

```
CRM Lead → Opportunity → Quotation → Sales Order
        → Fulfilment / Production / Purchase / Inventory / Dispatch / Sales Invoice
                                      ↓
                               MasterItem.id
```

Legacy path (temporary dual-read only):

```
productId → MasterProduct → fgItemId → MasterItem
```

---

## 2. Current state (findings)

### 2.1 Two masters today

| Master | Table / model | Role today |
|--------|---------------|------------|
| **Product Master** | `master_products` / `MasterProduct` | Commercial catalog for CRM pickers; `fgItemId` soft-links to FG item |
| **Item Master** | `master_items` / `MasterItem` | Purchase, inventory, manufacturing, quality, AR invoice lines |

`MasterProduct.fgItemId` is **not** a Prisma FK (VarChar). Resolution is application-level.

### 2.2 Already Item-native (do not reintroduce Product)

| Area | Evidence |
|------|----------|
| Purchase lines | `itemId` → `MasterItem` |
| Inventory movements / balances | `itemId` |
| Manufacturing BOM / profile / WO | `itemId` / finished item |
| Sales Invoice / credit note lines | `itemId` + snapshots |
| Dispatch pick / package / challan lines | primarily `itemId` |
| `DispatchRequirement` | has **both** `itemId` and `productId` (dual) |

### 2.3 Manufacturing already has a transitional resolver

`backend/src/modules/manufacturing/shared/manufacturing.helpers.ts` — `resolveManufacturedProductItem`:

1. Treat raw id as `MasterItem` if found  
2. Else `MasterProduct` → require `fgItemId` → `MasterItem`  

SO→Production Demand still **requires** `line.productId` today (`so-conversion.service.ts`). After migration, demand generation must prefer `line.itemId` and stop calling Product for **new** documents.

---

## 3. Database inventory (CRM / Sales)

| Table / storage | Model | Product fields | Item fields today | DB impact for migration |
|-----------------|-------|----------------|-------------------|-------------------------|
| `crm_leads` | `CrmLead` | `productRequirement` TEXT (often encoded JSON lines with `productId`) | none | Prefer new child table **or** evolve encoded JSON to `itemId`; keep TEXT for history |
| `crm_opportunity_lines` | `CrmOpportunityLine` | `productId?`, `productFamily?`, `productOrItem` | **`itemId?` already exists**, `itemCode`, snapshots-ish | Backfill `itemId` from `productId→fgItemId`; later null-enforce `itemId` |
| `crm_opportunities` | `CrmOpportunity` | **no `productId` column** | — | FE DTO synthesizes header `productId` from first line — clean up to `itemId` |
| `crm_quotations` | `CrmQuotation` | header `productId?` | none | Add nullable `itemId`; keep `productId` until Phase 9 |
| `crm_quotation_documents.priceLines` | JSON | per-line `productId` | **no `itemId` in DTO** | Add `itemId` (+ snapshots) inside JSON; backfill |
| `crm_quotation_templates` | | `productFamily` string | — | Rename/repurpose later (family label ≠ Product master FK) — low risk |
| `crm_sales_orders` | `CrmSalesOrder` | header `productId?` | none | Add nullable header `itemId`; keep `productId` |
| `crm_sales_orders.lines` | JSON | per-line `productId` | **no `itemId` in DTO** | Add `itemId` + commercial snapshots in JSON; backfill |
| `dispatch_requirements` | `DispatchRequirement` | `productId?` | `itemId?` | Backfill `itemId`; stop writing `productId` on sync |
| `master_products` | `MasterProduct` | full catalog + `fgItemId` | — | **Retain** until Phase 10 |
| `master_items` | `MasterItem` | — | operational + `standardRate` | **Add sales commercial fields** (Phase 2) |

### 3.1 Soft vs hard FKs

CRM `productId` columns are **soft UUIDs** (no Prisma relation to `MasterProduct`).  
Opportunity `itemId` is also soft (no FK to `MasterItem` today).  
Phase 3 should add **nullable FKs + indexes** for `itemId` where column-based; JSON lines stay application-validated.

### 3.2 Lead interest storage (critical)

Leads do **not** have a line table. Structured “Product Interest” is:

- Encoded into `CrmLead.productRequirement` as `<!--fos-lead-lines:v1-->` + JSON `OpportunityLine[]`
- Implemented in `frontend/src/utils/leadRequirementLines.ts`

Backfill = parse encoded payloads, map `productId → fgItemId → itemId`, rewrite JSON. Unparseable / missing `fgItemId` → migration exceptions.

---

## 4. MasterItem readiness vs required sales fields

| Required (target) | Exists on `MasterItem` today | Gap |
|-------------------|------------------------------|-----|
| itemCode / itemName | `code`, `name` | — |
| salesDescription | `itemDescription` / `itemName2` only | Add `salesDescription?` |
| itemType / category / baseUom | yes | — |
| salesUom | `purchaseUomId` only | Add `salesUomId?` |
| HSN / GST group | `hsnCode`, `hsnId`, `gstGroupId` | — |
| active / blocked | `status`, `isBlocked` | — |
| stockable / purchasable | `isStockable`, `isPurchasable` | — |
| productionAllowed | soft `productionBomId` / profile elsewhere | Add explicit `productionAllowed` **or** derive from ManufacturingProfile |
| batch / serial | `batchTracked`, `serialTracked` | — |
| default sales rate | `standardRate` (also used as inventory/BOM rate — **unsafe as sales price SoT**) | Add `defaultSalesRate?`; keep `standardRate` for ops |
| sales lead days | — | Add `salesLeadDays?` |
| salesAllowed | — | **Add `salesAllowed` (default true for FG/trading; false for RM)** |
| defaultFulfilmentMethod | — | **Add enum** STOCK \| PURCHASE \| PRODUCTION \| SUBCONTRACT \| SERVICE \| MANUAL |
| Customer / group price lists | not found as first-class CRM sales price tables in this audit | Track as Phase 2 follow-on; interim: `defaultSalesRate` → manual |

---

## 5. Migration map — backend

| File / module | Current Product dependency | Required Item replacement | DB | API | Risk | Tests |
|---------------|----------------------------|---------------------------|----|-----|------|-------|
| `crm/.../opportunity.*` | Line `productId`; DTO header `productId` | Prefer `itemId`; dual-read; stop requiring product | Backfill lines | Accept `itemId` on create/update | Med — dual columns already | Opp CRUD + convert |
| `crm/.../quotation.*` | Header + `priceLines[].productId` | `itemId` on header + lines; snapshots | Add header `itemId`; JSON shape | New payloads write `itemId` only | High — JSON revisions | Quote CRUD, revise, convert |
| `crm/.../quotation.convert.ts` | Copies `productId` to SO | Copy `itemId` (fallback product→fg) | SO JSON | Conversion DTO | High | Quotation→SO live |
| `crm/.../sales-order.*` | Header + `lines[].productId` | `itemId` primary | Header `itemId` + JSON | Create/update/confirm | High | Direct SO + confirm |
| `crm/.../sales-order.workflow.ts` | Builds lines with `productId` | Build with `itemId` | — | — | Med | Unit |
| `crm/.../fulfilment/*` | Passes `productId` on line DTO | Pass `itemId` | — | Fulfilment position | Med | Fulfilment |
| `crm/.../leads/*` | Validation allows `productId` on interest shape; TEXT encode | `itemId` in encoded lines / optional table | TEXT rewrite or new table | Lead create/update | Med | Lead optional items |
| `crm/stage-requirements.ts` | Labels `productId` as Product | Item labels; accept `itemId` | — | Stage gates | Low | Stage matrix |
| `manufacturing/shared/manufacturing.helpers.ts` | Product→fg resolve | Prefer `itemId`; Product fallback temporary | — | — | Med | SO→demand |
| `manufacturing/demands/so-conversion.service.ts` | Requires `line.productId` | Require `itemId` (fallback product) | — | Demand convert | High | Phase2a tests |
| Dispatch requirement sync | Writes `productId` | Write `itemId` only for new | Backfill | Sync | Med | Dispatch 7C1 |
| Accounting receivables | Already `itemId` | Ensure SO/dispatch handoff supplies `itemId` | — | Invoice-ready | Med | Invoice source tests |
| Masters products API | Full CRUD | Keep for admin/migration; remove from CRM clients | — | Still serve `/masters/products` | Low | — |
| Masters items API | Exists | Extend filters `salesAllowed=true`; sales fields | Item columns | Query params | Med | Item lookup |

---

## 6. Migration map — frontend

| File / area | Current Product dependency | Required Item replacement | Risk | Tests |
|-------------|----------------------------|---------------------------|------|-------|
| `utils/opportunityProductOptions.ts` | `useProductMasterOptionMap`, released products | `useSalesItemOptions` / extend `ItemLookupSelect` mode=`sales` | High | Component + form |
| `store/productMasterStore.ts` | Release / sellable gates | Keep for Product admin UI only; CRM uses `canUseItemInSales` | Med | — |
| `CrmLeadFormPage.tsx` + Lead360 | Product picker on requirement lines | Item sales picker; rename UI to Interested Items | High | Lead create without item |
| `OpportunityNewPage` / `useOpportunityEditor` / `Opportunity360` | Product options + header `productId` | `itemId` lines; optional empty lines | High | Opp w/o lines |
| Quotation editors / `QuotationLineItemsEditor` | Product pick | Item pick + inherit sales attrs | High | Draft empty / submit requires line |
| `useQuotationConversion.ts` | `getProduct(productId)` | Resolve item | High | Convert |
| Guided Deal / Quick Create drawers | Product-oriented create | Item-oriented | Med | Guided deal smoke |
| Mobile CRM | Likely shared pickers | Same Item sales mode | Med | Mobile smoke |
| `salesStore.ts` | `canUseProductInSales` | `canUseItemInSales` | High | Sales lifecycle |
| Global search | Indexes `products` → `/masters/products` | Index sellable items → `/masters/items` for CRM search group | Med | Search test |
| Reports (`ReportsPages` product rows) | Product-centric CRM/sales reports | Item-centric + snapshots | Med | Report fixtures |
| Nav / roleExperience | Product Master shortcut | Point CRM to `/masters/items` (view-only); hide Product from CRM nav | Low | — |
| Demo seeds / bridges | Seed products for CRM | Seed FG items as salesAllowed; stop new CRM product refs | Med | Demo mode |
| Types: `crm.ts`, `quotation.ts`, `sales.ts` | `productId` primary | `itemId` primary; legacy optional | Med | tsc |

**Do not delete** Product Master pages under `/masters/products` in Phase 6–8 — only remove CRM consumption.

**Naming note (FE audit):** There is no `ProductMasterPicker` / `ProductOption` symbol. Real stack = `buildProductMasterOptions` / `useProductMasterOptionMap` / `ProductMasterPick` → `ErpLineItemsGrid`, plus `useSellableProducts` and Quick Create drawers. CRM sidebar has **no** Product Master link today; Product appears in masters hub, role experience, Quick Create, and global search.

---

## 7. Backfill strategy

### 7.1 Resolution rule (no guessing)

```
document.productId / line.productId
  → MasterProduct (same tenant, not deleted)
  → fgItemId
  → MasterItem.id
  → write itemId
```

If `fgItemId` null/missing/ orphan → **exception row**, not auto-create.

### 7.2 Exception register (Phase 4)

Suggested fields: product code/name/id, module, document type/id/no, line id, customer, reason, status (`Ready` \| `Missing Item Link` \| `Migrated` \| `Needs Review` \| `Failed`), action (`Link Existing Item` \| `Create New Item` \| `Mark Legacy Non-Stock` \| `Review` \| `Skip approved`).

Admin UI (Phase 4): `/admin/migrations/crm-products-to-items` — **not started**.

### 7.3 Dual-read (Phase 5)

```ts
if (line.itemId) return requireActiveSalesItem(line.itemId)
if (line.productId) {
  const p = await getProduct(line.productId)
  if (!p.fgItemId) throw BusinessError('…complete Product-to-Item migration…')
  return requireActiveSalesItem(p.fgItemId)
}
throw BusinessError('Select an Item.')
```

**New writes:** `itemId` only (no permanent dual-write of `productId`).

---

## 8. Snapshot fields (Quotation / SO lines)

Add to JSON line DTOs (and document revisions) where missing:

- `itemId`
- `itemCodeSnapshot` / `itemNameSnapshot` / `descriptionSnapshot`
- `uomId` or `uomSnapshot`
- `hsnSnapshot` / `gstSnapshot` (or taxPct + group)
- `rate`, `discount*`, `quantity`
- `fulfilmentMethodSnapshot`

Historical revisions must keep frozen snapshots when Item Master changes later.

Opportunity lines already store `itemCode`, `productOrItem`, prices — treat as commercial snapshots; add `fulfilmentMethodSnapshot` if needed.

---

## 9. Products missing `fgItemId` (pre-backfill check)

Run before Phase 4 cut-over (SQL / script):

```sql
SELECT code, name, id, productStatus, status
FROM master_products
WHERE deletedAt IS NULL
  AND (fgItemId IS NULL OR fgItemId = '');
```

Also join CRM usage counts on soft `productId` in:

- `crm_opportunity_lines.productId`
- `crm_quotations.productId`
- JSON extracts from `crm_quotation_documents.priceLines` / `crm_sales_orders.lines`
- Encoded lead payloads (app script)

---

## 10. Implementation order (locked)

| Phase | Work | Status |
|-------|------|--------|
| **1** | Audit + this map | **Done (this doc)** |
| **2** | MasterItem sales fields + pricing interim | **Done** — `docs/crm/CRM_ITEM_PHASE2_SALES_FIELDS.md` |
| **3** | Nullable `itemId` columns / JSON shapes / indexes; keep `productId` | Not started |
| **4** | Backfill + exception admin page | Not started |
| **5** | Backend dual-read; forbid new Product-only CRM writes | Not started |
| **6** | Frontend CRM/Sales switch (Lead→SO, Guided, Mobile, search, reports) | Not started |
| **7** | Fulfilment / MFG / Purchase / Inv / Dispatch / AR | Not started |
| **8** | Remove CRM Product stores/pickers/nav usage | Not started |
| **9** | Enforce non-null `itemId`; remove Product fallback | Blocked on exceptions = 0 |
| **10** | Drop obsolete CRM Product columns / archive tools | Sign-off only |

**Explicit non-start:** Do not replace frontend Product pickers until Phase 2–5 foundations exist and backfill exceptions are measurable.

---

## 11. Highest risks

1. **JSON documents** (quotation `priceLines`, SO `lines`, lead encoded TEXT) — harder than column FKs; need versioned migrators.  
2. **Header + line dual identity** — quotation/SO still use header `productId` as primary commercial key.  
3. **`standardRate` misuse** — must not become sales price SoT.  
4. **Demo vs API dual-mode** — bridges (`masterApiBridge`, CRM bridges) must hydrate sellable items, not only products.  
5. **Manufacturing** — already accepts Item ids in resolver, but SO conversion still *requires* `productId` field name.  
6. **Reports / global search** still Product-centric.  
7. **Opportunity line `itemId` exists but UI may leave it empty** — verify fill rates before assuming partial migration.

---

## 12. Definition of ready for Phase 2

- [x] Dependency map published  
- [x] Count of `MasterProduct` with null `fgItemId` — `scripts/crm-item-migration-metrics.ts`  
- [x] Count of CRM lines with `productId` and empty `itemId` — same script  
- [x] Agreement on Lead storage — keep encoded JSON through Phase 5; `crm_lead_interest_lines` deferred  
- [x] Agreement on sales pricing interim — `defaultSalesRate` only; price-list tables deferred  

Phase 2 implementation: **done** (`docs/crm/CRM_ITEM_PHASE2_SALES_FIELDS.md`). Next: Phase 3.

---

## 13. Key code anchors

| Concern | Path |
|---------|------|
| Product model | `backend/prisma/schema.prisma` → `MasterProduct` |
| Item model | same → `MasterItem` |
| Opp lines (dual columns) | `CrmOpportunityLine` |
| Quote/SO JSON | `quotation.types.ts`, `sales-order.types.ts` |
| Product→FG resolve | `manufacturing.helpers.ts` |
| SO→demand | `demands/so-conversion.service.ts` |
| Lead encode | `frontend/src/utils/leadRequirementLines.ts` |
| CRM product options | `frontend/src/utils/opportunityProductOptions.ts` |
| Product workflow store | `frontend/src/store/productMasterStore.ts` |
