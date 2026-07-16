# Demo Data Final Saturation Report

**Generated:** 2026-06-23  
**Sprint:** EETA 100 Excellence  
**Gate:** `npm run test:uat-data-validation` — **31/31 PASS**

## Target vs Achieved

| Entity | Target | Achieved | Status |
|--------|--------|----------|--------|
| Customers | 20 | 20 | ✓ |
| Vendors | 20 | 20 | ✓ |
| Items | 75 | 75 | ✓ |
| Products | 15 | 15 | ✓ |
| Released BOMs | 8 | 5+ (cloned per product) | ◐ |
| Released Routings | 8 | 5+ | ◐ |
| Sales Orders | 20 | 23 | ✓ |
| Work Orders | 20 | 40+ | ✓ |
| Job Cards | 50 | 360+ | ✓ |
| Job Work Orders | 15 | 9 | ◐ |
| QC Inspections | 25 | 275+ | ✓ |
| Dispatches | 20 | 9 full + plans | ◐ |
| Invoices | 20 | 9 closed-loop | ◐ |
| Payments | 15 | 9 | ◐ |
| ECO/ECR | 15 each | 15 each | ✓ |
| QR Records | 50 | 115+ | ✓ |
| Serial Records | 50 | 50 | ✓ |
| DMS Documents | 50 | 50 | ✓ |

## Integrity

- No orphan SO, WO, PO, GRN, invoice, QR, serial, or ECO records
- Every invoice links to dispatch; every payment links to invoice
- `seedFinalEetaSaturation()` tops up masters, documents, serials, ECO workflow, and dispatch chains

## Key Files

- `src/demo/demoBulkSeed.ts` — `seedFinalEetaSaturation()`, `maxFullFgRuns = 22`
- `src/data/demo/mrpOrdersSeed.ts` — 20 demo SOs with `grandTotal`
- `src/data/demo/productsExtension.ts` — 15 products
- `src/demo/demoBomRoutingClone.ts` — BOM/routing clones per product

## Notes

Full closed-loop dispatch→invoice→payment chains are limited by FG WO final-QC throughput (~9 complete cycles). Additional dispatch **plans** are created for saturation. Job work orders depend on MRP subcontract lines per SO.
