# Accounts Payable — Vendor Payment Calculation Rules (Phase 4B2)

**Status:** Internal calculation engine complete. No public API, workflow, posting, allocation, or frontend.

**Calculation version:** `1`

---

## Three distinct amounts

| Amount | Formula / meaning |
|--------|-------------------|
| **Payment Amount** | Cash paid directly to the vendor (input; must be &gt; 0) |
| **Vendor Settlement Amount** | `Payment + Settlement Credits + Round-Off Credit − Round-Off Debit` → future vendor payable **GL debit** and DEBIT open-item original |
| **Cash Outflow Amount** | `Payment + Payment Expenses` → future bank/cash **GL credit** |

These must never be conflated.

---

## Settlement credits vs payment expenses

| Role | Examples | Effect |
|------|----------|--------|
| `SETTLEMENT_CREDIT` | TDS, discount, retention, withholding | Increases settlement; does **not** increase cash paid to vendor |
| `PAYMENT_EXPENSE_DEBIT` | Bank / processing charges | Increases cash outflow; does **not** increase vendor open-item amount |
| `ROUND_OFF_DEBIT` / `ROUND_OFF_CREDIT` | Rounding | Adjusts settlement only (within allowed difference) |
| `INFORMATION_ONLY` | Memos | No totals / preview impact |

---

## Core balancing equation

```text
Dr Vendor Payable (settlement)
+ Dr Payment Expenses
+ Dr Round-Off
=
Cr Bank/Cash (cash outflow)
+ Cr Settlement Adjustments (TDS, discount, retention, …)
+ Cr Round-Off
```

---

## TDS at payment

- Enabled only when TDS + TDS-at-payment policy allow it.
- Normally `adjustmentType=TDS`, `accountingRole=SETTLEMENT_CREDIT`.
- Amount = explicit amount **or** `base × rate%`.
- Double recognition: when `tdsAlreadyRecognisedAtInvoice` is set → `VENDOR_PAYMENT_TDS_DOUBLE_RECOGNITION`.
- Without allocation targets, payment-level TDS is treated as review-required input.

---

## Advance and MIXED

| Purpose | Open-item preview |
|---------|-------------------|
| `ADVANCE` | `DEBIT` / `VENDOR_ADVANCE` |
| `INVOICE_SETTLEMENT` | `DEBIT` / `VENDOR_PAYMENT` |
| `MIXED` | Single `DEBIT` / `VENDOR_PAYMENT` (full settlement allocatable; residual = advance) |

Advance posts to the **same vendor payable control** (no separate advance GL that would force GL reclass on allocation).

---

## Currency

- Convert each component: `base = amount × exchangeRate`.
- Base-currency payments require rate ≈ 1.
- Tiny FX residual assigned deterministically to the payment-account credit line so base debit = base credit.

---

## Account resolution (sync/override path)

Priority for tests and pure previews: explicit line account → `configuration.accounts` → unresolved.

Default mapping keys (async enrichment ready): `VENDOR_PAYABLE`, `TDS_PAYABLE`, `BANK_CHARGES`, `ROUNDING`. Discount / retention / withholding / processing require explicit or override accounts until dedicated mapping keys exist.

---

## Side-effect-free rule

`calculateVendorPayment` / `calculateVendorPaymentSync` **read** position/config only. They do **not** create payments, vouchers, GL, open items, allocations, approvals, or number reservations.

Entry points:

- `calculateVendorPaymentSync(input)` — DB-free (unit tests)
- `calculateVendorPayment(input, context)` — optional vendor-position DB read

No public HTTP calculate/validate routes in 4B2.

---

## Query efficiency (async position path)

Typical: **1** vendor-position `groupBy` + optional batched account loads in later phases. Adjustment math is in-memory.
