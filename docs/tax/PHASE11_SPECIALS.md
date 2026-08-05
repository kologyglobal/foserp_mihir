# Phase 11 — Advances, job work, special flows

**Date:** 2026-08-05  
**Status:** **READY WITH CONDITIONS**  
**Does not claim:** FULL GST COMPLIANT · portal GSTR-7/8 filing · full GSTR-1 Table 11 · Income-tax TDS/TCS Act 2025 · automatic job-work tax engine

---

## Scope (from plan)

- Controlled special flows after legal/accounting review checklist  
- Feature-flagged increments (`GST_PHASE11_SPECIALS_ENABLED`, default **true**)  
- Reuse Phase 1 tax resolve + GST ledger + GSTR prep — **no second tax engine**

### Shipped

| Area | Behaviour |
|------|-----------|
| Supply classification | `classifyGstSupply` — NIL_RATED / EXEMPT / NON_GST / ZERO_RATED / COMPOSITION / REVERSE_CHARGE / TAXABLE |
| Tax resolve | `taxCategoryHint`, composition registration scheme, `supplyClass` + `specialSchemeFlags` on result; coexists with **Phase 10** export zero-rated |
| Ledger visibility | `gst_ledger_entries.supplyClass`; zero-tax nil/exempt/non-gst rows stamped (mirrors Phase 10 WOPAY zero rows) |
| Composition gates | Blocks e-invoice IRN when `GstRegistration.registrationType` is COMPOSITION |
| GST TDS/TCS books | `gst_withholding_entries` — manual Sec 51/52 style liability prep, mark paid / void (**not** portal / **not** IT TDS) |
| Advances | `gst_advance_entries` + adjustments — allocate against invoice taxable/tax remainder (**not** full Table 11 engine) |
| Job work | Eval util only — manufacturing JobWorkOrder remains source of truth |
| Capability matrix | Honest ready/partial/deferred/not-in-scope labels via API |
| FE | `/accounting/tax-compliance/gst/specials` dual-mode (demo fixture matrix; API live) |

---

## Migration

`20260805230000_gst_phase11_specials`

Runs **after** Phase 10 `20260805220000_gst_phase10_export_sez_lut`.

---

## Permissions

| Code | Use |
|------|-----|
| `tax.gst.specials.view` | Read specials / matrix / registers |
| `tax.gst.specials.manage` | Mutate withholding / advances |

Also accepted: `tax.gst.view`, `finance.tax.view`, `tax.gst.setup.manage` (aligned with prior phases).

---

## API (`…/tax-compliance/specials`)

| Method | Path |
|--------|------|
| GET | `/capability-matrix` |
| GET | `/composition-gates?legalEntityId=` |
| POST | `/classify` |
| POST | `/job-work/evaluate` |
| GET | `/nil-exempt?legalEntityId&returnPeriod` |
| GET/POST | `/withholding` (+ `:id/mark-paid`, `:id/void`) |
| GET/POST | `/advances` (+ `:id/adjust`, `:id/close`) |

---

## Tests

`backend/tests/gst-specials-phase11.test.ts` — pure unit tests (classification, composition IRN gate, GST TDS split, advance allocate, capability honesty).

---

## READY WITH CONDITIONS

1. `migrate deploy` including `20260805230000_gst_phase11_specials`  
2. `db:sync-permissions` for `tax.gst.specials.*`  
3. Set `GstRegistration.registrationType=COMPOSITION` where applicable for IRN gates  
4. Manually enter GST TDS/TCS and advances (no auto-deduct on every AP/AR yet)  
5. Disable with `GST_PHASE11_SPECIALS_ENABLED=false` if product wants specials off  

---

## Still NOT ready

- FULL GST COMPLIANT  
- Portal GSTR submit / GSTR-7/8  
- Full advanced Table 11 engine  
- Job-work challan tax automation end-to-end  
- Income-tax TDS parallel track (Act 2025)  

**Phase 10 collision status:** Phase 10 Export/SEZ/LUT was **landing in parallel** (`GstLut`, export APIs, zero-rated resolve/ledger). Phase 11 **reused** those hooks and **did not** re-implement LUT; migration timestamp ordered **after** Phase 10.

**Stop for product review before Phase 12 (portal filing).**
