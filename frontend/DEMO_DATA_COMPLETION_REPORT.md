# Demo Data Completion Report

**Sprint:** ERP Sample Data Wiring  
**Date:** 23 Jun 2026  
**Status:** Complete

## Summary

The Vasant Trailer ERP now loads a full interconnected factory dataset via **Settings → Demo Data → Reset Demo Data**. All records are created through existing store APIs (no business logic changes). Existing CI suites remain isolated — tests reset stores independently unless they explicitly call `loadDemoData()`.

## How to Load Demo Data

1. Open **Settings → Demo Data** (`/settings/demo-data`)
2. Click **Reset Demo Data**
3. Confirm: *"This will reset all demo records."*
4. The app clears localStorage and reloads the complete dataset (~2s)

Programmatic load: `import { loadDemoData } from './src/demo/loadDemoData'`

## Record Counts (after `loadDemoData()`)

| Module | Count | Target |
|--------|------:|--------|
| Customers | 15 | 15+ |
| Vendors | 15 | 15+ |
| Items | 51 | 50+ |
| Products | 10 | 10+ |
| Leads | 15 | 15 |
| Inquiries | 15 | 15 |
| Quotations | 15 | 15 |
| Sales Orders | 18 | 15+ |
| Work Orders | 40 | 15+ |
| Job Cards | 200 | 30–50+ |
| Purchase Requisitions | 9 | ~10 (MRP shortage-driven) |
| RFQs | 8 | ~10 |
| Purchase Orders | 20 | 15+ |
| GRNs | 11 | 15 (partial receipts on some POs) |
| Dispatches | 5 | 5+ full chains |
| Invoices | 5 | 5+ |
| QC Inspections | 149 | 15+ per category combined |
| Stock Movements | 475 | 15+ |
| QR Records | 96 | 10+ |
| Serial Numbers | 11 | 7+ types |
| ECRs | 10 | 10 |
| ECOs | 10 | 10 |

## Five Business Scenarios

| # | Customer | Product | Qty | Status | Implementation |
|---|----------|---------|-----|--------|----------------|
| 1 | ABC Cement | 45 M3 Bulker | 2 | **Closed** | `runGoLiveScenario()` — lead→MRP→WO→QC→dispatch→invoice→payment |
| 2 | UltraBuild Logistics | 26 KL ISO Tank | 3 | **In Production** | MRP + WO released + production started |
| 3 | Shree Cement Transport | 32 FT Side Wall | 4 | **Material Shortage** | MRP + PR approved, shortages remain |
| 4 | Patel Bulk Carriers | Cement Bulker | 1 | **Dispatch Ready** | Dispatch plan + loading + logistics |
| 5 | Metro Infra Logistics | Tipping Trailer | 2 | **Job Work Pending** | Subcontract WO + partial material send |

## Architecture

| File | Role |
|------|------|
| `src/demo/loadDemoData.ts` | Orchestrator |
| `src/demo/resetDemoBaseline.ts` | Reset stores + master/sales seeds |
| `src/demo/runGoLiveScenario.ts` | Scenario 1 closed loop |
| `src/demo/demoScenarioExtensions.ts` | Scenarios 2–5 + ECO/serial/QR seed |
| `src/demo/demoBulkSeed.ts` | MRP/purchase/production/dispatch expansion |
| `src/demo/demoBomRoutingClone.ts` | Released BOM/routing clones for ISO/sidewall/lowbed |
| `src/demo/persistDemoStores.ts` | Write all slices to localStorage |
| `src/data/demo/*` | Master, sales, MRP, inventory extensions |
| `src/modules/settings/DemoDataPage.tsx` | Reset UI |

## Wiring Rules Verified

- No orphan Sales Orders, Work Orders, POs, GRNs, invoices, QR, or serials
- Every invoice links to a dispatch; payments link to invoices
- Every WO links to SO, product, BOM, and routing (via freeze)
- 360 pages (BOM, Customer) and control towers return live metrics

## Tests

```bash
npm run test:demo-data   # 20 checks — interconnected data validation
npm run test:ci          # includes test:demo-data in factory-control gate
```

## Known Limits

- **PR/RFQ count (9/8):** PRs are only created when MRP finds shortages; not all open SOs generate PRs.
- **Dispatch count (5):** Each dispatch requires a full FG manufacturing cycle (SA WOs → FG receipt → final QC → dispatch). Five complete chains are seeded; additional SOs have active WOs in production states.
- **Auto-load on first visit:** Intentionally **not** enabled — full load takes ~2s and would surprise users with empty stores. Use Settings → Demo Data instead.

## CI Impact

- `test:demo-data` added to `test:ci` factory-control gate
- Existing regression checks unchanged (demo data not in store initial state)
