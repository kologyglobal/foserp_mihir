# Accounting Phase Status Matrix

Statuses: `VERIFIED COMPLETE` | `BACKEND COMPLETE` | `FRONTEND ONLY` | `PARTIAL` | `DOCUMENTED ONLY` | `BLOCKED` | `FAILED`

| Phase | Capability | Schema | Backend | API | Frontend | Permission | Automated tests | API smoke | Final status |
| ----- | --------------------------------- | -----: | ------: | --: | -------: | ---------: | --------------: | --------: | ------------ |
| 1 | Finance setup | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ setup 8 | Partial | **VERIFIED COMPLETE** |
| 2A | Voucher and GL foundation | ✅ | ✅ | ✅ | Partial (read) | ✅ | ✅ ledger 11 | Partial | **VERIFIED COMPLETE** |
| 2B | Central posting engine | ✅ | ✅ | internal | N/A | N/A | ✅ posting-engine 13 | N/A | **VERIFIED COMPLETE** |
| 2C1 | Journal drafts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ journals 11 | Partial | **VERIFIED COMPLETE** |
| 2C2 | Journal approval and posting | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ approvals 9 + posting 8 | Partial | **VERIFIED COMPLETE** |
| 2C3 | Journal reversal | ✅ | ✅ | ✅ | ✅ | ✅ `finance.voucher.reverse` | ✅ journal-reversal **5/5** | Partial (UI wired) | **VERIFIED COMPLETE** |
| 3A | Sales invoices + Money In reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ invoice posting + reporting | Money In verify | **VERIFIED COMPLETE** |
| 3B | Customer receipts and allocations | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ drafts/post/alloc | Money In verify | **VERIFIED COMPLETE** |
| 3C | Credit notes and allocations | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ post/alloc | Money In verify | **VERIFIED COMPLETE** |
| 3D | AR reversals (receipt/CN) | ✅ | ✅ | ✅ | ✅ | ✅ reverse perms | ✅ receipt+CN reversal **14/14** | Money In reverse demos | **VERIFIED COMPLETE** |
| 3E | Sales invoice document reverse | ✅ | ✅ | ✅ | ✅ | ✅ `finance.ar.invoice.reverse` | ✅ `finance-ar-invoice-reversal.test.ts` | Money In Reverse Document | **VERIFIED COMPLETE** |
| 4A1 | AP vendor invoice / open-item foundation | ✅ | repos only | ❌ | ❌ | ✅ seeded | ✅ ap-vendor-invoice-foundation (live MySQL) | N/A | **PARTIAL** (DB foundation complete; calculation/API/posting/frontend pending) |
| 4A2 | AP vendor invoice calculation/validation engine | N/A (no writes) | ✅ pure/DB-optional | ❌ | ❌ | N/A (no writes) | ✅ ap-vendor-invoice-calculation 22 + ap-vendor-invoice-duplicate 3 (live MySQL) | N/A | **PARTIAL** (calculation engine complete; API/workflow/posting/frontend pending) |
| — | Sales invoice document reverse | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **See Phase 3E** |

## Overall Accounting classification

```text
Accounting overall: PARTIAL

Live:
- Finance Settings
- Journals and Approvals
- General Ledger
- Accounts Receivable / Money In (incl. Phase 3D receipt/CN reverse + **sales invoice document reverse** + Phase 2C3 journal reverse)
- Legacy demo CoA/vouchers routes redirect to settings CoA + journals / GL voucher ledger (2026-07-21)

Deferred or preview:
- AP / Money Out (see [`AP_STATUS.md`](AP_STATUS.md) — often ahead of this matrix)
- Bank and Cash
- Fixed Assets (Phases 1–4 live: register/capitalize/depreciate/dispose/transfer/revalue/impair/maint/reports; PV/acquisition still demo)
- GST and TDS returns
- Budgeting
- Period Close (Phase 1 lock + live inventory/mfg close feeds; accruals/year-end still demo)
- Inventory Accounting (events + FE register; flag OFF by default — pilot)
- Manufacturing Accounting (Phase 7E workspace live; flag OFF by default — pilot)```

## Actual Phase definitions (from code)

### Phase 2C3
- `POST /accounting/journals/:id/reverse`
- Permission: `finance.voucher.reverse`
- Service: `journal-reverse.service.ts`
- Event key: `MANUAL_JOURNAL_REVERSE:{id}:V1`
- Effect: new REVERSAL voucher, Dr↔Cr swap, original → REVERSED, JO- number kept

### Phase 3D
- Receipt alloc reverse: `…/receipts/:id/allocations/:batchId/reverse` (`finance.ar.allocation.reverse`) — **no GL**
- Receipt doc reverse: `…/receipts/:id/reverse` (`finance.ar.receipt.reverse`) — REVERSAL voucher
- CN alloc reverse: `…/credit-notes/:id/allocations/:batchId/reverse` — **no GL**
- CN doc reverse: `…/credit-notes/:id/reverse` (`finance.ar.credit_note.reverse`) — REVERSAL voucher
- **Sales invoice doc reverse:** `POST …/receivables/invoices/:id/reverse` (`finance.ar.invoice.reverse`) — REVERSAL voucher; requires no POSTED receipt/CN allocations and fully unallocated debit open item; preserves `invoiceNumber`

### Phase 4A1
- Tables: `vendor_invoices`, `vendor_invoice_lines`, `vendor_invoice_source_links`, `payable_open_items`
- Migration: `20260718150000_add_vendor_invoice_and_ap_open_item_foundation`
- Repos under `backend/src/modules/accounting/payables/`; permissions `finance.ap.*` seeded
- **No HTTP routes**, calculation, posting, payment, allocation, or frontend

### Phase 4A2
- Calculation/validation engine under `backend/src/modules/accounting/payables/vendor-invoices/calculation/`
- `calculateVendorInvoiceSync` (pure) / `calculateVendorInvoice` (async, DB-optional); duplicate detector (live DB); account resolver; accounting-preview builder
- Rules doc: [`AP_CALCULATION_RULES.md`](AP_CALCULATION_RULES.md)
- **No HTTP routes**, persistence writes, posting, payment, allocation, or frontend
- Next: **4A3** draft workflow + HTTP API
