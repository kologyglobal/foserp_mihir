# Accounts Payable — Workflow (Phases 4A3–4A5)

> Last verified: **2026-07-18** against `backend/src/modules/accounting/payables/vendor-invoices/` and `frontend/src/modules/accounting/money-out/`.

Frontend Money Out pages call the same lifecycle endpoints. See [`AP_FRONTEND.md`](AP_FRONTEND.md).

---

## Document lifecycle

```text
DRAFT
  ├─ (approvalRequired=false) ── mark-ready ──► READY_TO_POST ── post ──► POSTED
  └─ (approvalRequired=true) ── submit ──► PENDING_APPROVAL
                                            ├─ approve ──► READY_TO_POST ── post ──► POSTED
                                            └─ reject ──► REJECTED ── revise ──► DRAFT

READY_TO_POST / REJECTED ── revise ──► DRAFT
DRAFT / REJECTED / READY_TO_POST / PENDING_APPROVAL ── cancel ──► CANCELLED

POSTED is immutable (no edit / cancel / revise / re-post; reverse deferred to Phase 4C).
```

Money Out UI never invents status changes — buttons follow backend `allowedActions` and refresh after each mutation.
---

## Numbering

| Number | When assigned | Series |
|--------|---------------|--------|
| `draftReference` | Draft create | Generated (not FinanceNumberSeries) |
| `supplierInvoiceNumber` | Draft create (supplier’s bill id) | External — never overwritten on post |
| `vendorInvoiceNumber` | Successful post only | `FinanceDocumentType.VENDOR_INVOICE` |
| Accounting voucher number | Successful post only | SYSTEM voucher → JOURNAL series |

Failed post after reservation: invoice stays `READY_TO_POST` with null FOS number; PostingEvent keeps reserved numbers for retry.

---

## Supplier uniqueness

`supplierInvoiceUniquenessKey` is claimed on submit / mark-ready and retained through POSTED. Exact-duplicate recheck runs again at post time.

---

## Posting (4A4)

Controlled endpoint:

```text
POST /api/v1/t/:tenantSlug/accounting/payables/vendor-invoices/:id/post
Body: { expectedUpdatedAt }
Permission: finance.ap.vendor_invoice.post
```

Atomic outcome (one Prisma transaction via central posting engine + `afterAccounting` participant):

1. Recalculate / revalidate (Phase 4A2)
2. Approval, uniqueness, period, vendor, accounts
3. PostingEvent `VENDOR_INVOICE_POST:{id}:V1`
4. Reserve FOS vendor-invoice number + voucher number
5. Create SYSTEM voucher + lines + GL
6. Create CREDIT `PayableOpenItem` (outstanding = vendor payable)
7. Conditional `READY_TO_POST` → `POSTED` update

**Posting recognises liability only — it does not create or allocate a vendor payment.**

Drill-down: existing `GET /accounting/vouchers/:id`, `…/ledger`, `GET /accounting/posting-events/:id`.
