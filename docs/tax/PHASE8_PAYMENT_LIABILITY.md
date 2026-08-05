# Phase 8 — GST Payment & Liability

**Date:** 2026-08-05  
**Status:** **READY WITH CONDITIONS**  
**Exit label candidacy:** **GST PAYMENT BOOKS-SIDE READY**  
**Does not claim:** Live GST portal cash ledger · portal PMT-06 generate · FULL GST COMPLIANT

---

## Scope (from plan)

- Liability summary (books)  
- Ledger-based payment util proposal  
- PMT-06 style challan **records** (external CIN/CPIN capture)  
- Interest / late fee amounts  
- Period closure  
- Optional settle via **central `post()` only**

---

## Shipped

### Pure util
- `gst-payment-liability.util.ts` — proposal from ledger, cash/credit util hints, lifecycle gates

### Model / migration
- `GstPaymentChallan` → `gst_payment_challans`  
- Migration `20260805200000_gst_phase8_payment_liability`  
- Status: `DRAFT → PROPOSED → CONFIRMED_EXTERNAL → POSTED_GL → CLOSED` (+ `VOID`)

### Service
- Preview liability for period LE + GSTIN  
- Propose (immutable snapshot of ledger liability + interest/late fee)  
- Confirm external (user-paid on portal)  
- Post GL: `Dr GST_OUTPUT_* / GST_INTEREST / GST_LATE_FEE / GST_ROUND_OFF` · `Cr bank` via `post()`  
- Close period · void open challans  

### Permissions
| Code | Use |
|------|-----|
| `tax.gst.payment.prepare` | Propose / void |
| `tax.gst.payment.confirm` | Confirm external |
| `tax.gst.payment.post` | Post GL |
| `tax.gst.payment.close` | Close period |
| view | `tax.gst.view` / `finance.tax.view` |

### API (`…/tax-compliance`)

| Method | Path |
|--------|------|
| GET | `/payments` |
| POST | `/payments/preview` |
| POST | `/payments/propose` |
| GET | `/payments/:id` |
| POST | `/payments/:id/confirm-external` |
| POST | `/payments/:id/post-gl` |
| POST | `/payments/:id/close-period` |
| POST | `/payments/:id/void` |

### FE
- `/accounting/tax-compliance/gst/payments` dual-mode (API actions; demo empty list)

### Tests
- `backend/tests/gst-payment-phase8.test.ts`

---

## READY WITH CONDITIONS

1. Ledger must have Phase 2 SI/VI posts for the return period  
2. LE GSTIN required  
3. Only one active challan per LE + GSTIN + period (void to re-propose)  
4. GL post requires bank CoA UUID + default mapping of `GST_OUTPUT_*` (and interest/late fee if used)  
5. Cash ledger util in proposal is a **books heuristic**, not portal electronic cash ledger balance  
6. Confirming CPIN does **not** mean FOS called the portal  

---

## Still NOT ready

- Portal PMT-06 generate / cash credit deposit  
- Full Rule 86A / electronic ledger order of set-off certification  
- Multi-GSTIN hard isolation (Phase 9)  
- FULL GST COMPLIANT  

**Stop for product review before Phase 9.**
