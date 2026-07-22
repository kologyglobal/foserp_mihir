# Phase 7C4 Test Results

**Date:** 2026-07-21 (polish re-run)  
**Migration:** `20260721210000_dispatch_phase7c4_delivery_challan` (applied)  
**Semantics:** `DELIVERY_CHALLAN_AS_DOCUMENT_ONLY`

## Backend

| Suite | Result |
|-------|--------|
| `dispatch-phase7c4.test.ts` | **7/7** (retry after P2034 deadlock in parallel suite setup) |
| `dispatch-phase7c3.test.ts` | **8/8** |
| `dispatch-phase7c2.test.ts` | **7/7** |
| `dispatch-phase7c1.test.ts` | **3/3** |
| `dispatch-phase7c0.test.ts` | **5/5** |
| `npx tsc --noEmit` | **exit 0** |

7C4 coverage: create draft; duplicate blocked; fulfilment unchanged; draft blocks confirm; submit/approve/issue + number; no FG_DISPATCH on issue; confirm after ISSUED once.

## Frontend

| Check | Result |
|-------|--------|
| `test:dispatch-phase7c4` | **22/22** |
| `npx tsc -b --force` | **exit 0** |
| `npm run build` | **exit 0** |

## Known flake

Parallel live suites can hit MySQL `P2034` TransactionWriteConflict during inventory opening balance create in beforeAll. Re-run 7C4 alone when that occurs.

## Phase 7C5 readiness

**READY WITH CONDITIONS** — soft tracking; printable HTML (browser print) rather than binary PDF engine; one active challan per dispatch; CRM attachment entity wiring optional.

Do **not** auto-start Phase 7C5.
