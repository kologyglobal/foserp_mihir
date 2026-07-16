# Code / Number Series Master — Completion Report

## Module Created

Centralized **Code / Number Series Master** under **Master Data → Administration**, controlling document numbers and master codes across CRM, Sales, Purchase, Inventory, Production, Quality, Finance, Engineering, Logistics, and Master Data.

## Routes

| Route | Page |
|-------|------|
| `/masters/code-series` | List |
| `/masters/code-series/new` | Create |
| `/masters/code-series/:id` | Detail |
| `/masters/code-series/:id/edit` | Edit |

## Core Files

| Layer | Path |
|-------|------|
| Types | `src/types/codeSeriesMaster.ts` |
| Seed | `src/data/masters/codeSeriesSeed.ts` |
| Store | `src/store/codeSeriesStore.ts` |
| Service | `src/services/codeSeriesService.ts` |
| Format builder | `src/utils/codeSeriesFormat.ts` |
| Permissions | `src/utils/codeSeriesPermissions.ts` |
| UI | `src/modules/masters/code-series/CodeSeriesPages.tsx` |
| Tests | `scripts/test-code-series.ts` |

## Fields

General, numbering configuration, reset rules, manual control, preview, and audit fields as specified — including prefix, separator, FY/month/branch/department/location flags, running number length, starting/current numbers, increment, suffix, reset frequency, manual/override/gap/duplicate/posting lock flags, and audit metadata.

## Format Builder

Visual segment toggles (Prefix, Separator, Year, Month, Branch, Department, Location, Running Number, Suffix) with live preview via `buildCodeFromSeries()` and `previewFormat()`.

## Service Functions

- `getNextCode(entityType, context?, mode?)`
- `previewNextCode(entityType, context?)`
- `reserveCode(entityType, context?)`
- `confirmCode(entityType, code)`
- `releaseReservedCode(entityType, code)`
- `resetSeriesIfRequired(entityType)`
- `validateManualCode(entityType, code)`
- `validateUniqueActiveEntity(entityType, excludeId?)`
- `adminResetSeries(seriesId, reason)`

`src/utils/documentNumbers.ts` now delegates to the centralized service (legacy prefix bridge).

## Integrated Modules

Stores/utils updated to consume Code Master:

- Sales: leads, inquiries, quotations (`salesStore`)
- CRM: opportunities (`crmStore`)
- Purchase: PR, RFQ, PO, GRN, VQ, returns (`purchaseStore`)
- MRP / Sales orders (`mrpStore`)
- Invoice (`invoiceStore`)
- Work orders (`workOrderStore`)
- Dispatch / gate pass (`dispatchStore`)
- Quality: QC, NCR, rework (`qualityStore`, `qualityEngine`)
- Proforma (`proformaInvoiceStore`)
- DMS, barcode, QR (`dmsStore`, `barcodeStore`, `qrStore`)
- ECO/ECR (`ecoStore`)
- Job cards (`jobCard.ts`)
- Master suggests: customer, vendor, item codes
- Inventory movements (`inventory.ts` — entity bridge where mapped)

## Permissions

`codeSeries.view`, `.create`, `.edit`, `.delete`, `.reset`, `.override`, `.manualNumber`, `.deactivate` — enforced via `src/utils/codeSeriesPermissions.ts` (Admin / ERP Manager configure; others consume generated codes).

## Sample Data

36 seeded series including: LEAD, OPP, QT, SO, CUST, VEND, ITEM, PR, RFQ, PO, GRN, PROD, WO, QC, INV, BOM, ROUTE, WH, UOM, HSN, GST, and supporting document types.

## Tests

```bash
npm run build
npm run test:code-series
```

Test script covers list routes, service API, format preview, reserve/confirm/release, duplicate entity guard, reset rules, permission reset, and removal of hardcoded invoice/WO generators.

## Remaining Gaps

- BOM/routing inline product-based codes (`BOM-{product}-001`) still use product-scoped patterns — migrate to entity series with context key
- Inventory movement prefixes not in seed (fallback legacy pad still available)
- Branch/department/location context not yet passed from all module forms
- Full reserve→confirm→release lifecycle not wired in every draft UI (stores use immediate `getNextCode` mode)
- Backend API persistence and cross-session reservation locks pending backend phase
- `npm run test:ci` may still fail on unrelated demo-data checks

## Result

All ERP document numbers and master code suggestions now flow through one centralized **Code / Number Series Master** and **`codeSeriesService`**.
