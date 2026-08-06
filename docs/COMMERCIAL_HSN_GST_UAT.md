# Commercial HSN/GST UAT Checklist

**Date:** 2026-08-05  

## Automatic Place of Supply

- [ ] Company LE Gujarat + customer/ship-to Gujarat → PoS Gujarat (24), source SHIP_TO or CUSTOMER  
- [ ] Company Gujarat + ship-to Maharashtra → PoS Maharashtra (27)  
- [ ] Ship-to empty + registered customer GSTIN state Gujarat → source CUSTOMER_GSTIN  
- [ ] No state available → “Not resolved” + cannot confirm SO  

## Automatic Supply Type

- [ ] Gujarat supplier + Gujarat PoS → Intra-state — CGST + SGST  
- [ ] Gujarat supplier + Maharashtra PoS → Inter-state — IGST  
- [ ] Delhi LE + Delhi PoS → Intra-state — CGST + UTGST (if UT set)  

## Recalc

- [ ] Change ship-to GJ → MH → CGST/SGST cleared, IGST applied on save  
- [ ] Change ship-to MH → GJ → IGST cleared, CGST+SGST applied  

## Override

- [ ] User **without** `crm.commercial.tax_place_override` → cannot enable override  
- [ ] Authorised user, no reason → save rejected  
- [ ] Authorised + reason → audit `PLACE_OF_SUPPLY_OVERRIDE`, tax recalculated, supply type still read-only  

## Surfaces

- [ ] SO Create / Edit / 360 / PDF show same HSN, PoS, scheme, totals from **snapshot**  
- [ ] Quotation save/reopen keeps HSN + taxScheme on lines  
- [ ] Quotation → SO keeps HSN + PoS header  
- [ ] Proforma / Tax Invoice / Accounting SI — supply type not free-editable  

## Unit tests (automated)

```bash
cd backend
npx vitest run tests/commercial-supply-pos-conversion.test.ts tests/commercial-conversion-chain.test.ts
```

Expect **pass**.

---

## Completion report

| Item | Status |
|------|--------|
| Sales Order header POS snapshot | **Done** (columns + resolve on write) |
| Automatic Place of Supply | **Done** (priority + no sticky auto) |
| Automatic Supply Type | **Done** |
| Supply Type read-only | **Done** (panel + money-in SI/CN) |
| POS source displayed | **Done** |
| Authorised override | **Done** (`crm.commercial.tax_place_override`) |
| Override audit trail | **Done** (`PLACE_OF_SUPPLY_OVERRIDE` + by/at in newValues) |
| Quotation HSN DTO | **Done** (optional snapshot fields on JSON lines) |
| Quotation → SO parity | **Done** (convert maps snapshot + tax header) |
| SO → Proforma parity | **Partial** — FE prefill uses SO; full E2E manual UAT |
| Proforma → Tax Invoice parity | **Partial** — manual UAT |
| Tax Invoice → Accounting parity | **Partial** — AR bridge; use existing path |
| Preview parity | **Partial** — snapshot preferred; legacy drafts fallback |
| PDF parity | **Partial** — SO PDF HSN; full matrix UAT |
| Order adjustment tax parity | **Partial** — quote charges still rate-based; scheme from header when SO-aligned |
| UTGST readiness | **Partial** — code path ready; master + print UAT |
| Cess readiness | **Partial** — rate + header amount; not full posting claim |
| Tests passed | **17** pure commercial tests (this pass) |
| Tests failed | **0** (commercial suite above) |
| Manual UAT pending | Yes — tables above |
| Production blockers | LIVE GSTN unrelated; tenant masters + UAT; legacy docs without PoS until edited |
| Safe to merge | **Yes with conditions** — run unit tests; do not claim FULL GST COMPLIANT; no migrate/deploy in this pass |

**Do not:** commit/push/migrate/deploy automatically.  
**Migration:** existing SO header migration only if not applied on target DB (`20260805310000_so_place_of_supply_tax_header`). No new migration in this pass.
