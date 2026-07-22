# Accounts Payable — Payment Architecture

**Status:** Phases **4B1** (DB) + **4B2** (calculation) + **4B3** (workflow + atomic posting) complete. Allocation execution, payment reversal, and payment frontend remain pending.

---

## One document: `VendorPayment`

| Purpose | Meaning |
|---------|---------|
| `INVOICE_SETTLEMENT` | Intended to settle existing vendor payable invoices |
| `ADVANCE` | Paid before invoice settlement |
| `MIXED` | Part settlement + remaining advance |

There is **no** separate `VendorAdvance` table. Advance is a payment purpose.

---

## Amount semantics

| Field | Meaning |
|-------|---------|
| `paymentAmount` | Cash paid to vendor |
| `settlementAdjustmentAmount` | Settles liability without cash (TDS, discount, retention, withholding) |
| `paymentExpenseAmount` | Company expense not reducing vendor liability (bank/processing charges) |
| `vendorSettlementAmount` | Future debit open-item original amount (= vendor payable GL debit) |
| `cashOutflowAmount` | Future bank/cash credit total |

Formulas and preview invariants: [`AP_PAYMENT_CALCULATION_RULES.md`](AP_PAYMENT_CALCULATION_RULES.md).

---

## Adjustment lines

`VendorPaymentAdjustmentLine` with `adjustmentType` + `accountingRole` (`SETTLEMENT_CREDIT`, `PAYMENT_EXPENSE_DEBIT`, …). No separate TDS/discount/charge tables.

---

## Calculation engine (Phase 4B2)

Internal module: `backend/src/modules/accounting/payables/vendor-payments/calculation/`

- Deterministic, Decimal-safe, `calculationVersion = 1`
- Vendor payable position (read-only)
- Account readiness + balanced accounting preview
- Open-item preview (`VENDOR_PAYMENT` / `VENDOR_ADVANCE`)
- **No** HTTP API, posting, or allocation

---

## Posting vs allocation

| Phase | Behaviour | Status |
|-------|-----------|--------|
| **4B3** | Atomic payment posting → SYSTEM voucher + immutable GL + one **DEBIT** open item (original = `vendorSettlementAmount`; `VENDOR_ADVANCE` for ADVANCE purpose else `VENDOR_PAYMENT`) | ✅ shipped |
| **4B4** | Allocation = no-GL subledger matching of DEBIT payment/advance to CREDIT invoices | ❌ not started |

Posting reuses the shared `post()` engine (event key `VENDOR_PAYMENT_POST:{id}:V1`), enforces
the GL invariant *vendor payable DEBIT = `vendorSettlementAmount`*, and never creates or
allocates against invoices. See [`AP_PAYMENT_WORKFLOW.md`](AP_PAYMENT_WORKFLOW.md).

---

## Related docs

- [`AP_PAYMENT_WORKFLOW.md`](AP_PAYMENT_WORKFLOW.md)
- [`AP_PAYMENT_CALCULATION_RULES.md`](AP_PAYMENT_CALCULATION_RULES.md)
- [`AP_ALLOCATION_ARCHITECTURE.md`](AP_ALLOCATION_ARCHITECTURE.md)
- [`AP_STATUS.md`](AP_STATUS.md)
