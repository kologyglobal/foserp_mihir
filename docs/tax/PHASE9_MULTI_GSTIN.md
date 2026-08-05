# Phase 9 — Multi-GSTIN / Multi-branch

**Date:** 2026-08-05  
**Status:** **READY WITH CONDITIONS**  
**Does not claim:** Full multi-state multi-HO production UAT · automatic document series split per GSTIN on all document types · stock transfer GL automation

---

## Scope (from plan)

- LE → Branch registration → series prefix → POS → GST ledger → return  
- **Hard isolation** of cross-GSTIN contamination  
- Branch transfer tax **policy-driven**

---

## Shipped

### Pure util
- `gst-registration-scope.util.ts` — resolve company GSTIN (branch → LE → explicit), hard isolation filter, contamination detector, branch transfer treatments, series prefix hints

### Ledger
- **Sales invoice** GST ledger now stamps `companyGstin` from Branch GSTIN (preferred) or Legal Entity GSTIN (Phase 5/8 null gap closed for new posts)

### Registers / payments / returns
- `loadLedgerRowsForPeriod` defaults to **exact `companyGstin` match** (no null bleed into other GSTIN)
- Legacy orphans: only if `GST_MULTI_GSTIN_ALLOW_LEGACY_ORPHANS=true`

### Schema
- `LegalEntity.branchTransferTaxPolicy` enum  
- `GstRegistration` map table (`gst_registrations`)  
- Migration `20260805210000_gst_phase9_multi_gstin`

### API (`…/tax-compliance`)

| Method | Path |
|--------|------|
| GET | `/registrations?legalEntityId=` |
| POST | `/registrations` |
| POST | `/registrations/branch-transfer-policy` |
| POST | `/registrations/evaluate-branch-transfer` |
| GET | `/registrations/isolation-status?legalEntityId=&returnPeriod=` |

### Tests
- `gst-multigstin-phase9.test.ts`

---

## Branch transfer policies

| Policy | Behaviour |
|--------|-----------|
| `NOT_CONFIGURED` | Transfers blocked until set |
| `SAME_GSTIN_STOCK_NO_TAX` | Same GSTIN only; no GST |
| `CROSS_GSTIN_TAXABLE_SUPPLY` | Cross-GSTIN allowed as taxable supply |
| `PROHIBITED` | All transfers blocked |

Policy evaluation is advisory for inventory modules — Phase 9 does not invent a second transfer engine.

---

## READY WITH CONDITIONS

1. Backfill historical SI ledger rows with null `companyGstin` (or enable legacy orphans env temporarily)  
2. Configure branch GSTINs for multi-reg entities  
3. Set branch transfer policy before using transfer evaluation  
4. Always pass `companyGstin` on registers / GSTR prep / payments for multi-GSTIN LEs  
5. Document number series remains LE-level `FinanceNumberSeries` — registration `seriesPrefix` is a **hint**, not auto allocation  

---

## Still NOT ready

- FULL GST COMPLIANT  
- Automatic reassignment of all commercial docs per GSTIN  
- Inventory branch transfer inventory+tax end-to-end (policy only)  

**Phase 10 Export/SEZ/LUT shipped separately** — see `PHASE10_EXPORT_SEZ_LUT.md`.
