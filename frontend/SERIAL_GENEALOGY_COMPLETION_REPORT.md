# Serial Number Master & Trailer Genealogy Completion Report

**Project:** Vasant ERP (`trailer-erp`)  
**Sprint:** Serial Number Master + Trailer Genealogy  
**Date:** June 2026  
**Status:** ✅ Complete — production-grade serial registry and genealogy tracking wired across manufacturing lifecycle

---

## Executive Summary

This sprint delivers a **Serial Number Master** and **trailer/component genealogy** layer that complements existing QR traceability, work orders, inventory, QC, dispatch, invoice, and customer data — without changing core manufacturing transaction logic.

| Area | Before | After |
|------|--------|-------|
| Serial types | Partial / legacy | **9 types** (incl. Valve, Sub Assembly) |
| Serial statuses | 5 coarse states | **10 lifecycle statuses** + legacy aliases |
| Serial master fields | Basic WO link | Full field set: item, product, QR, SO, customer, vendor, GRN, batch, parent |
| GRN integration | None | Vendor serial capture on GRN post |
| WO integration | None | Component serial assignment + status movement |
| FG receipt | Manual only | Auto trailer + chassis registration on FG post |
| Dispatch gate | QR only | **Blocks dispatch** without trailer serial + chassis |
| Genealogy views | Legacy `/genealogy` | Register, detail, trailer, component, warranty |
| 360 panels | None | Item, Vendor, Customer, WO, Job Work, QC, Dispatch, Invoice |
| Tests | 9 checks | **14/14 passed** (covers all 11 required scenarios) |
| CI gate | Included | `test:serial-genealogy` in `test:ci` — **GREEN** |

**Test results (verified 23 Jun 2026):**
- `npm run test:serial-genealogy` — **14/14 passed**
- `npm run build` — **PASS**
- `npm run test:ci` — **26/26 suites, 293 checks — GREEN**

---

## 1. Serial Number Master ✅

**Types:** `src/types/serialNumber.ts`  
**Store:** `src/store/serialStore.ts` (Zustand + persist)

### Supported serial types (9)

Finished Trailer, Chassis, Tank, Axle, ABS/EBS Kit, Tyre, Compressor, Valve, Sub Assembly

### Record fields

| Field | Description |
|-------|-------------|
| Serial ID | Internal UUID |
| Serial Number | Human-readable unique identifier |
| Serial Type | One of 9 types above |
| Item / Product | Linked master references |
| QR Code | Linked QR registry code |
| Work Order / Sales Order | Manufacturing and commercial context |
| Customer / Vendor | End customer or supplier source |
| GRN / Batch-Lot | Inbound receipt trace |
| Status | Lifecycle state (see below) |
| Parent Serial | Component installed on trailer |
| Installed Trailer No | Reverse link for components |
| Created Date / Created By | Audit |

### Status lifecycle (10)

`created` → `in_stock` → `issued` → `in_wip` → `installed` → `qc_hold` / `rejected` → `dispatched` → `warranty` → `closed`

Legacy persisted values (`registered`, `assigned`, `in_production`, `ready`, `retired`) normalize at read time.

### Uniqueness rules

| Rule | Enforcement |
|------|-------------|
| Trailer serial unique | `validateUnique` on `finished_trailer` |
| Chassis number unique | `validateUnique` on `chassis` |
| Axle serial unique | Type-scoped duplicate check |
| No reuse after dispatch | `assertSerialDispatchReady` blocks dispatched serials |
| Status follows movement | `registerGrnLineSerials`, `assignToWorkOrder`, `installOnTrailer`, `markDispatched` |

---

## 2. Serial Assignment Integration ✅

**Integration layer:** `src/utils/serialIntegration.ts`  
**QR workflow hooks:** `src/utils/qrIntegration.ts`

### GRN — vendor serial capture

On GRN post (`onGrnPosted` → `onGrnSerialsRegistered`):
- Scans GRN lines for serialized item prefixes (axle, ABS/EBS, compressor, valve, tyre)
- Registers vendor serial numbers with `in_stock` status
- Links vendor, GRN, item, batch/lot

### Work Order — component consumption

`assignToWorkOrder(serialId, woId)`:
- Moves serial to `issued` / `in_wip`
- Links WO reference

### FG Receipt — trailer serial generation

On FG receipt post (`onFgReceiptPosted` → `onFgSerialsRegistered`):
- Creates **finished trailer** serial (from QR metadata or auto-generated)
- Creates **chassis** serial
- Links WO components already assigned to the WO
- Sets status `installed` on components, `in_wip` on trailer/chassis

### Dispatch — validation gate

`dispatchStore.confirmDispatch` calls `onDispatchSerialsConfirmed`:
- `assertSerialDispatchReady(trailerNo, chassisNo)` — separate errors for missing trailer vs chassis
- Marks trailer + chassis `dispatched`; propagates to installed components
- Blocks reuse of already-dispatched serials

---

## 3. Trailer Genealogy ✅

**Route:** `/traceability/trailers` (alias: `/genealogy`)  
**Page:** `TrailerGenealogyPage` in `src/modules/serial/SerialPages.tsx`

### Search dimensions

Trailer No, Chassis No, QR Code, Work Order, Sales Order, Customer

### Genealogy chain displayed

```
Finished Trailer
  ↓ Chassis
  ↓ Tank / Sub-assemblies
  ↓ Running gear components (Axles, Tyres, ABS/EBS)
  ↓ Vendor / GRN source
  ↓ QC Records (inspections, NCR, rework)
  ↓ Dispatch
  ↓ Invoice
  ↓ Customer
```

Built by `serialStore.buildGenealogy()` pulling from serial, quality, dispatch, invoice, and purchase stores.

---

## 4. Component Traceability ✅

**Route:** `/traceability/components/:serialNo`  
**Page:** `ComponentGenealogyPage`

From any component serial, shows upstream and downstream chain:

Vendor → GRN → Incoming QC → Issued to WO → Installed in Trailer → Dispatched to Customer

Implemented via `serialStore.buildComponentGenealogy()`.

---

## 5. Warranty / Complaint Support ✅

**Route:** `/traceability/warranty`  
**Page:** `WarrantyInvestigationPage`

Search by trailer serial returns:
- Customer, dispatch date, invoice reference
- Components used (full serial list)
- QC reports, rework history, NCR history
- Vendor source for bought-out parts

Implemented via `serialStore.buildWarrantyInvestigation()`.

---

## 6. UI / UX ✅

### Routes

| Route | Page |
|-------|------|
| `/serials` | Serial Number Register |
| `/serials/:id` | Serial Detail |
| `/traceability/trailers` | Trailer Genealogy |
| `/traceability/components/:serialNo` | Component Genealogy |
| `/traceability/warranty` | Warranty Investigation |
| `/masters/serial-numbers` | Legacy alias → Register |

### Design system usage

- `Entity360Shell` / `OperationalPageShell` for page chrome
- `DataGrid` for register and search results
- `Timeline` for genealogy chains
- QR panel integration on serial detail
- `EmptyState` for no-results search
- Semantic `StatusBadge` tokens for serial status

No raw HTML tables on serial/genealogy pages.

### Navigation

`src/config/navigation.ts` — Serial Numbers → `/serials`, Trailer Genealogy → `/traceability/trailers`  
`src/config/permissionMatrix.ts` — route permissions for serials, trailers, warranty, components

---

## 7. Integration Panels (360 / Detail Pages) ✅

**Reusable component:** `src/components/serial/SerialGenealogyPanel.tsx`

| Screen | Filter |
|--------|--------|
| Item 360 (`Item360Page`) | `itemId` |
| Vendor 360 (`Vendor360Page`) | `vendorId` |
| Customer 360 (`Customer360Page`) | `customerId` |
| WO 360 (`WorkOrder360Page`) | `workOrderId` |
| Job Work Order (`JobWorkOrderDetailPage`) | `workOrderId` |
| QC Inspection Detail (`QcInspectionDetailPage`) | `workOrderId`, `grnId` |
| Dispatch Detail (`DispatchPages`) | `workOrderId`, `trailerNo` |
| Invoice Detail (`InvoicePages`) | `customerId`, `trailerNo` |

---

## 8. Automated Tests ✅

**Script:** `scripts/test-serial-genealogy.ts`  
**Command:** `npm run test:serial-genealogy`  
**CI:** Included in `test:factory-control` and `test:ci` (`scripts/run-ci.ts`)

### Required scenarios (11) — all covered

| # | Scenario | Test |
|---|----------|------|
| 1 | Trailer serial unique | ✓ Test 1–2 |
| 2 | Chassis number unique | ✓ Test 3–4 |
| 3 | GRN captures axle serial | ✓ Test 5 |
| 4 | WO consumes serialized axle | ✓ Test 6 |
| 5 | FG receipt creates trailer serial | ✓ Test 7 |
| 6 | Trailer genealogy shows components | ✓ Test 8 |
| 7 | Component genealogy shows trailer | ✓ Test 9 |
| 8 | Dispatch blocked without trailer serial | ✓ Test 10 |
| 9 | Dispatch blocked without chassis | ✓ Test 11 |
| 10 | Warranty lookup (QC, vendor, dispatch, invoice) | ✓ Test 12 |
| 11 | QR and serial traceability link | ✓ Test 13 |

### Additional coverage

| # | Scenario | Test |
|---|----------|------|
| 12 | Dispatched serial cannot be reused | ✓ Test 14 |

**Result:** 14/14 passed

---

## 9. Key Files

| Area | Path |
|------|------|
| Types | `src/types/serialNumber.ts` |
| Store | `src/store/serialStore.ts` |
| Integration | `src/utils/serialIntegration.ts`, `src/utils/qrIntegration.ts` |
| Dispatch hook | `src/store/dispatchStore.ts` |
| UI pages | `src/modules/serial/SerialPages.tsx` |
| Panel | `src/components/serial/SerialGenealogyPanel.tsx` |
| Routes | `src/routes/index.tsx` |
| Tests | `scripts/test-serial-genealogy.ts` |
| CI | `scripts/run-ci.ts`, `package.json` |

---

## 10. Constraints Honoured

- ✅ No changes to core ERP transaction/business logic (side-effect hooks only)
- ✅ QR remains primary traceability; serial master complements QR registry
- ✅ Existing traceability screens retained (`/traceability`, `/genealogy`)
- ✅ Go-live simulation passes (9/9) with serial integration active

---

## Sign-off

Serial Number Master and Trailer Genealogy sprint is **complete and CI-green**. The system supports end-to-end trailer manufacturing genealogy from vendor GRN through dispatch, invoice, and warranty investigation.
