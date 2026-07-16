# Vasant Fabricators — Product Master Portfolio

Last updated: **2026-07-13**

## Architecture found (no schema migration)

| Concept | Implementation |
|---------|----------------|
| Product Category | `details.productCategory` (+ label) — no separate DB table |
| Product Family | `MasterProduct.productFamily` (VarChar) + FE `ProductFamily` union |
| Product / Model | `MasterProduct` row (`PRD-*`) |
| Variant | Separate `MasterProduct` row with `details.parentProductCode`, `details.isVariant`, `capacity`, `gvwKg`, `details.material` |
| Configurable attributes | `details.configAttributes` on parent products (Fuel Tank) |
| FG Item link | `fgItemId` → `MasterItem` (`FG-*`, `itemType=finished_good`) |
| BOM / Routing | Still via `details.manufacturing` + demo stores (deferred transactional ERP) |

Existing legacy products (`FG-45M3-BULKER`, `FG-ISO-TANK-26K`, `FG-SIDEWALL-32FT`) are **preserved**.

## Seed files (idempotent)

| File | Role |
|------|------|
| `backend/prisma/vasantProductPortfolio.ts` | Hierarchy + attribute catalogs + Vasant rows |
| `backend/prisma/productSeedData.ts` | Legacy + Vasant merge by code |
| `backend/prisma/seed.ts` | Upserts Nos UOM, CAT-FG, FG items, products |
| `trailer-erp/src/data/demo/vasantPortfolioSeed.ts` | Demo-mode mirror |
| `trailer-erp/src/data/demo/mastersExtension.ts` | Merges into demo masters |

Safe to re-run: upserts on `tenantId + code`.

## Categories (5)

Tanks · Semi Trailers · Trailers · Process Equipment · Body Building Works

## Families created/reused

Fuel Tanks, Gas Tanks, Bulk Liquid Tanks, Dry Bulk Non-Tipping Tanks, Tipping Tanks, Storage Tanks, Gas Tank Semi Trailers, Dry Bulk Non-Tipping Semi Trailers, Tipping Tanker Semi Trailers, Bulk Liquid Tank Semi Trailers, Bulker Semi Trailers, Liquid Tank Trailers, Tanker Trailers, Custom Transport Trailers, ASME / SMPV(U) / Custom Process Equipment, Commercial / Custom Body Building (+ legacy Bulker / ISO / Side Wall).

## Core products (14+)

`PRD-FUEL-TANK`, `PRD-GAS-TANK`, `PRD-GAS-ST`, `PRD-BULK-LIQ-TANK`, `PRD-BULK-LIQ-ST`, `PRD-DRY-BULK-TANK`, `PRD-DRY-BULK-ST`, `PRD-TIPPING-TANK`, `PRD-TIPPING-ST`, `PRD-BULKER-ST`, `PRD-STORAGE-TANK`, `PRD-CUSTOM-PROC`, `PRD-CV-BODY`, `PRD-CUSTOM-BODY`, plus trailer/process family parents.

## Fuel Tank variants (9)

| Code | Capacity | Material | GVW |
|------|----------|----------|-----|
| PRD-FUEL-TANK-12KL | 12 KL | Mild Steel | 16 GVW |
| PRD-FUEL-TANK-18KL | 18 KL | Mild Steel | 25 GVW |
| PRD-FUEL-TANK-20KL | 20 KL | Mild Steel | 25 GVW |
| PRD-FUEL-TANK-24KL | 24 KL | Mild Steel | 31 GVW |
| PRD-FUEL-TANK-28KL | 28 KL | Mild Steel | 37 GVW |
| PRD-FUEL-TANK-29KL | 29 KL | Mild Steel | 37 GVW |
| PRD-FUEL-TANK-30KL | 30 KL | Mild Steel | 40 GVW |
| PRD-FUEL-TANK-35KL | 35 KL | Mild Steel | 49 GVW |
| **PRD-FUEL-TANK-40KL-AL** | **40 KL** | **Aluminium** | **49 GVW** |

Parent `PRD-FUEL-TANK` holds configurable attributes (capacity, material, loading, mounting, chassis make, compartments, treatments, accessories) — not exploded into every combination SKU.

## How to apply (API mode)

```bash
cd backend
npx tsx prisma/seed.ts
# or project wrapper if configured
```

Then hydrate masters in the SPA (`VITE_USE_API=true`).

Demo mode: reset/reload demo baseline so `applyDemoMasterExtensions` merges the portfolio.

## Integration notes

| Flow | Status |
|------|--------|
| Product Master list/filters | Category, family, material, status + search |
| CRM Lead / Opportunity pick | Via `buildProductMasterOptions` (`released` + active) |
| Quotation lines | Same product pick map |
| FG Item mapping | Seeded + linked |
| BOM / Routing / WO | Architecture ready via `fgItemId` + manufacturing details; full transactional link remains deferred |

## Remaining / recommendations

1. Optional: Product Category master table if multi-tenant category CRUD is needed in UI.
2. Optional: true attribute/option matrix table when configure-to-order is required beyond `details.configAttributes`.
3. Populate technical specs (pressure, discharge, certifications) as approved engineering data becomes available — left blank/configurable by design.
4. Align quotation template `productFamily` display strings with new family labels when templates are expanded.
5. Run live CRM pick + quotation add for `PRD-FUEL-TANK-40KL-AL` after seed on a MySQL environment.
