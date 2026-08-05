# Phase 1 — Tax Determination (implementation note)

**Date:** 2026-08-05  
**Status:** Implemented (incremental) — **READY WITH CONDITIONS**  
**North star:** one resolver path; no silent 18%; HSN + scheme on commercial lines  

---

## Delivered

### Backend
| Piece | Detail |
|-------|--------|
| `resolveGstTax` | `backend/src/modules/tax/gst-tax-resolve.service.ts` — HSN, group, dated rate, LE/branch state, scheme apply, blockers, never invents 18% |
| `applySchemeToMasterRate` | Intra → CGST+SGST; Inter → IGST |
| API | `GET …/masters/tax/resolve` returns full determination DTO (not rate row only) |
| Silent defaults removed | SO workflow + commercial pi/invoice line `taxPct` **required**; CRM→SI bridge no longer `?? 18` |
| Permissions | `tax.gst.view`, `tax.gst.setup.manage`, `tax.gst.override` |
| Tests | `backend/tests/gst-tax-scheme.test.ts` |

### Frontend
| Piece | Detail |
|-------|--------|
| Dual-mode helper | `frontend/src/utils/commercialLineTax.ts` — local masters (demo) + API resolve |
| Client DTO | `taxResolutionApi.ts` — Phase 1 result shape |
| Product pick tax | `buildOpportunityLineFromItem` + `ErpProductPricingPanel.selectItem` hydrate tax from masters; API re-resolve |
| Grid UI | HSN + CGST/SGST vs IGST scheme hint; unresolved warning; rate override marks `OVERRIDE` |
| Proforma | HSN column; item pick resolve; default tax `0` |
| SO create / SO draft | item pick resolve; default tax `0` |
| Purchase Order | item pick use purchase POS + local resolve; default gstRatePct `0` |

### Docs / memory
- This file + updates to SESSION_CHANGELOG / PROJECT_STATUS / REMAINING_WORK

---

## Conditions (not yet TAX DETERMINATION READY fully)

1. **Not every document** is on full component snapshot columns (Quote/SO still primarily `taxPct` dual-write).  
2. **`tax.gst.override`** not yet enforced as hard permission gate on UI/API (rate still changeable with OVERRIDE source).  
3. **API mode** commercial forms depend on `GET /masters/tax/resolve` — ensure masters seeded with rates per tenant.  
4. **Freight / charge lines** still may default tax rates in order adjustments (legacy 18 on charges).  
5. **Schema `@default(18)`** on some proforma DB columns may still exist — API services now reject omit rather than invent.  
6. **Quotation repository** header still has legacy `DEFAULT_GST_PCT` fallback for header-only fields.  
7. **Party classification / multi-GSTIN LE print** incomplete (Phase 1 partial POS).  
8. Full matrix column set (CGST/SGST amount columns on every grid) partial — totals still use header `computeGst` in places.

---

## How product pick tax works now

```text
Select item
  → buildOpportunityLineFromItem / resolveLineTaxFromLocalMasters (demo masters)
  → taxPct from MasterGstRate (e.g. 12% if GST12 group), not silent 18
  → show HSN + scheme
  → API: resolveCommercialLineTax → GET masters/tax/resolve (authoritative)
```

Items without HSN/GST group show **Tax unresolved** — user must fix masters or deliberately override rate.

---

## Verification

```bash
cd backend && npx vitest run tests/gst-tax-scheme.test.ts
# Manual: SO/Proforma pick item with gstg-12 (HSN 721070) → GST 12%, not 18%
# Manual: item missing HSN → unresolved warning
```

After permission add: `npm run db:sync-permissions` and re-login for `tax.gst.*`.

---

## Verdict

**TAX DETERMINATION — READY WITH CONDITIONS**

Do **not** claim FULL GST COMPLIANT or portal ready.

**Next (Phase 2 or Phase 1 polish):** enforce override permission, component amount columns everywhere, remove remaining charge/quotation silent defaults, persist line snapshot JSON on commercial docs, post-block when unresolved.
