# Vendor Adjustments — Architecture (Phase 4C2)

**Scope:** Vendor debit notes (`VENDOR_DEBIT_NOTE`) and vendor credit adjustments (`VENDOR_CREDIT_ADJUSTMENT`).

## Backend

| Layer | Location |
|-------|----------|
| Routes | `/api/v1/t/:tenantSlug/accounting/payables/vendor-adjustments` |
| Workflow | Draft → approval or mark-ready → post (mirrors vendor invoices) |
| Posting | GL voucher + payable open item (DEBIT for debit notes, CREDIT for credit adjustments) |
| Allocation | Debit note DEBIT open item → CREDIT invoices/credit adjustments (subledger only, 4C2) |
| Reversal | GL reversal voucher + open-item restore; optional allocation cascade (4C1 pattern) |

## Permissions

`finance.ap.adjustment.*`, allocation uses `finance.ap.allocation.*`, corrections hub uses `finance.ap.corrections.view`.

## Backend tests (live MySQL, `backend/tests/finance/`)

| File | Cases |
|------|-------|
| `finance-ap-vendor-adjustment-foundation.test.ts` | permission constants; draft CRUD + list; update/recalc; mark-ready → cancel; submit → reject → revise; mark-ready blocked on invalid lines; permission + tenant isolation |
| `finance-ap-vendor-adjustment-posting.test.ts` | debit note ITC reversal GL + DEBIT open item; credit adjustment ITC addition GL + CREDIT open item; idempotent replay |
| `finance-ap-vendor-adjustment-allocation.test.ts` | debit note → invoice; debit note → credit adjustment; blocks credit adjustment as allocation source |
| `finance-ap-vendor-adjustment-reversal.test.ts` | reverse with no allocations nets GL to zero; blocks reverse with active allocations; cascade reverse |

Shared fixture: `backend/tests/finance/helpers/ap-allocation-fixture.ts` (`createPostedDebitNote`, `createPostedCreditAdjustment`, `adjustmentAllocationBody`, `postAdjustmentAllocation`). Run with `npx vitest run --no-file-parallelism` for reliable results — parallel finance test workers can hit transient MariaDB write-conflict retries shared with vendor-invoice/payment line repositories.

## Frontend (Money Out)

API-only (`VITE_USE_API=true`). Pages under `/accounting/money-out/vendor-adjustments/*`. Corrections workspace at `/accounting/money-out/corrections`.

See [`AP_ADJUSTMENT_FRONTEND.md`](AP_ADJUSTMENT_FRONTEND.md) and [`AP_REVERSAL_FRONTEND.md`](AP_REVERSAL_FRONTEND.md).
