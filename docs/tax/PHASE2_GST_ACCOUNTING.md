# Phase 2 — GST Accounting & Ledgers

**Date:** 2026-08-05  
**Status:** **READY WITH CONDITIONS**  
**Does not claim:** FULL GST COMPLIANT / returns preparation ready  

---

## Principles (honoured)

| Rule | Implementation |
|------|----------------|
| One posting engine | Existing `post()` — unchanged |
| One canonical SI / VI | Posted document line tax snapshots feed subledger |
| GL = accounting truth | No change to voucher/GL tables as source of financial books |
| GST subledger = compliance truth | New `gst_ledger_entries` |
| No re-resolve on post | Ledger writes rates/amounts from stored SI/VI lines only |

---

## Delivered

### Account mappings
New **optional** `DefaultAccountMappingKey` values:

- `GST_INPUT_CESS`
- `GST_RCM_CGST_PAYABLE` / `SGST` / `IGST`
- `ITC_INELIGIBLE_EXPENSE`
- `GST_ROUND_OFF` (AP ROUND_OFF component prefers this; generic `ROUNDING` still available)
- `GST_INTEREST` / `GST_LATE_FEE`

Wired in:

- `vendor-invoice-account-resolver` / `vendor-adjustment-account-resolver` (INPUT_CESS + RCM payables + ROUND_OFF)
- `default-mapping.validation.ts` allow-list
- `finance.constants.ts` type maps

**Map accounts in Finance → Default mappings** before posting RCM invoices without overrides.

### GST subledger
- Model: `GstLedgerEntry` (`gst_ledger_entries`)
- Service: `tax-compliance/gst-ledger.service.ts`
  - `recordSalesInvoiceGstLedger` — after SI post (in posting transaction)
  - `recordVendorInvoiceGstLedger` — after VI post
  - `listGstLedgerEntries` — filtered by LE / period / direction
  - `toReturnPeriod` → `yyyy-MM`
- API: `GET …/tax-compliance/gst-ledger?legalEntityId=&returnPeriod=&direction=&fromDate=&toDate=`
  Permission: `finance.tax.view`

Each row: document, line, GSTIN, return period, HSN, tax type (OUTPUT/INPUT/RCM components), taxable, rate, amount, RCM flag, ITC eligibility, filing status (`NOT_FILED` default).

### Migration
`backend/prisma/migrations/20260805120000_gst_phase2_ledger_and_mappings`

```bash
cd backend
npx tsx scripts/prisma-cli.ts migrate deploy
npx prisma generate
```

---

## Conditions

1. **Customer credit note / vendor adjustment** ledger write not yet hooked (schema supports document types).  
2. **Backfill** of historical posted SI/VI into ledger not shipped (new posts only).  
3. **RCM/INPUT cess mapping** must be configured in tenant default mappings or overrides still work.  
4. **Filing status** transitions (INCLUDED_IN_DRAFT / FILED) deferred to Phase 5.  
5. FE register UI for line ledger not polished (API ready; extract headers remain).  
6. Tenant must map new keys before RCM auto-resolve works without invoice-level overrides.

---

## Tests

```bash
npx vitest run tests/gst-ledger-period.test.ts
```

---

## Verdict

**GST ACCOUNTING — READY WITH CONDITIONS**

Stop for review before Phase 3 (ITC / GSTR-2B).
