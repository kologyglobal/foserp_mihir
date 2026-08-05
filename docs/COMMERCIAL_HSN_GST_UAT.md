# Commercial HSN/GST UAT Checklist

**Last automated UI/UX run:** 2026-08-05 — **24/24 PASS**  
**Command:** `npx tsx --tsconfig tsconfig.app.json scripts/test-uat-commercial-hsn-gst-ui.ts`  
**Report:** `frontend/docs/uat-results/commercial-hsn-gst-ui-*.md`

## Prerequisites
- [x] Migration `20260805310000_so_place_of_supply_tax_header` applied
- [x] Backend :5000 reachable for live cases
- [x] Item master HSN + rate resolves (tax/resolve LIVE-04 rate=18)

## Automated results (script)

| Area | Result |
|------|--------|
| Form wiring (SO / PI / TI / AR) | 10/10 PASS |
| Pure PoS + supply type UX rules | 6/6 PASS |
| Backend commercial unit tests | 13/13 PASS |
| Live API (login, rates, SO, resolve) | 7/7 PASS |

## Coverage detail
- Supply type **read-only** on CommercialGstSupplyPanel + Money-In Invoice/Credit Note
- PoS override chrome + reason + permission gate in panel
- SO / Proforma / Tax Invoice panels wired; TI HSN + Scheme + master resolve
- Auto ship-to PoS; GJ↔MH inter; Delhi UT; unresolved missing PoS
- Live: gst-rates 200, SO list 200, tax/resolve intra+inter, SO DTO tax header fields

## Manual browser (optional visual sign-off)
- [ ] SO Create: GST strip above commercial; HSN fills on item pick
- [ ] Tax Invoice New: same + scheme column
- [ ] Money-In Invoice: supply type label only
- [ ] PoS override + reason → save; audit `PLACE_OF_SUPPLY_OVERRIDE` if audited path used

## Sign-off
| Tester | Date | Result | Notes |
|--------|------|--------|-------|
| Auto UAT script | 2026-08-05 | PASS | 24 automated; visual chrome deferred to human |
