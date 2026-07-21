# Accounts Payable — Calculation Rules (Phase 4A2)

> Scope: `backend/src/modules/accounting/payables/vendor-invoices/calculation/`. **Pure calculation and validation engine — no HTTP routes, no persistence writes, no posting.** Last verified: **2026-07-18** against code.

`calculationVersion = 1` (`VENDOR_INVOICE_CALCULATION_VERSION` in `vendor-invoice-calculation.types.ts`). Bump whenever calculation semantics change.

---

## Entry points

| Function | File | DB access |
|----------|------|-----------|
| `calculateVendorInvoiceSync(input)` | `vendor-invoice-calculation.service.ts` | None — account resolution only honours `configuration.accounts` / line `debitAccountId` overrides; duplicate detection always `NONE` |
| `calculateVendorInvoice(input, context)` | `vendor-invoice-calculation.service.ts` | Optional, via `context.include*` flags (default `true` whenever `context.tenantId` is set) — duplicate scan, `DefaultAccountMapping` lookups, account validation |

Both return the same `VendorInvoiceCalculationResult` shape: `totals`, `baseTotals`, `lines`, `duplicateAssessment`, `accountReadiness`, `accountingPreview`, `validation`, `snapshot`.

---

## Decimal precision

All money/tax/rate math uses `Prisma.Decimal` (`backend/src/modules/accounting/shared/finance-decimal.ts`) — never native `number` arithmetic.

| Kind | Precision | Rounding |
|------|-----------|----------|
| Money / tax amounts (`formatDecimal4` / `roundTax`) | 4 dp | `ROUND_HALF_UP` |
| Quantities (`formatDecimal6` / `roundQuantity`) | 6 dp | `ROUND_HALF_UP` |
| Percentages/rates (`roundPercentage`) | 4 dp | `ROUND_HALF_UP` |
| Exchange rates (`roundExchangeRate`) | 8 dp | `ROUND_HALF_UP` |

All totals/line fields are serialized as fixed-precision decimal **strings**, not numbers.

---

## Calculation order

1. Zod schema validation (`vendor-invoice-calculation.schemas.ts`) — malformed input short-circuits to a zero-totals result with `VENDOR_INVOICE_VALIDATION_ERROR` per issue.
2. Supply-type derivation (company state vs place-of-supply, fallback to vendor state) — `INTRA_STATE` / `INTER_STATE`; manual `supplyType` validated against the derived value.
3. Per-line: gross (`qty × unitPrice`) → line discount (`PERCENTAGE`/`AMOUNT`) → header discount allocation → GST split → ITC recoverable/non-recoverable split.
4. Header freight / other-charge tax (single combined rate, no cess).
5. Rounding (`NONE` / `NEAREST_UNIT` / `NEAREST_0_05` / `MANUAL`, shared with AR's `invoice-rounding.service.ts`).
6. TDS (`NOT_APPLICABLE` / `AT_INVOICE` / `AT_PAYMENT`).
7. Vendor payable amount.
8. Base-currency conversion (`amount × exchangeRate`, all totals).

## Header discount allocation

`AMOUNT` or `PERCENTAGE`, proportional across lines with `netBeforeHeaderDiscount > 0`. Per-line share is rounded to 4 dp; the rounding remainder is assigned to the **highest-numbered eligible line** so the allocated shares always sum exactly to the header discount value.

## GST components

- Combined `gstRate` splits evenly into `cgstRate`/`sgstRate` (intra-state) or fully into `igstRate` (inter-state); explicit `cgstRate`/`sgstRate`/`igstRate` on a line always take precedence over `gstRate`.
- `cessRate` is independent of the CGST/SGST/IGST split and always computed on the taxable base.
- Zero-tax treatments (`NON_GST`, `EXEMPT`, `NIL_RATED`) skip tax computation entirely — `taxableAmount = lineTotal`, all tax fields zero, and company/place-of-supply are not required.
- Tax-inclusive lines (`isTaxInclusive: true` with any non-zero rate): `taxable = inclusive ÷ (1 + combinedRate/100)`; cess (when present) is added on top of the inclusive price and reconciliation is a warning (`CESS_ON_INCLUSIVE_EXCEEDS_PRICE`), not an error; without cess, a >0.01 mismatch is an error (`INCLUSIVE_TAX_MISMATCH`).

## ITC (input tax credit) eligibility

Per line, `effectiveItcEligibility = line.itcEligibility ?? header.itcEligibility` splits `totalTaxAmount` into `recoverableTaxAmount` / `nonRecoverableTaxAmount`:

| Eligibility | Recoverable | Non-recoverable |
|-------------|-------------|------------------|
| `ELIGIBLE` | 100% | 0% |
| `INELIGIBLE` | 0% | 100% |
| `PARTIALLY_ELIGIBLE` | `itcEligiblePercent`% (required; error `ITC_ELIGIBLE_PERCENT_INVALID` if missing/out of range) | remainder |
| `PENDING_REVIEW` | 100% (treated as recoverable) | 0% — warning `ITC_PENDING_REVIEW` |

`nonRecoverableTaxAmount` folds into the line debit (cost); `recoverableTaxAmount` is aggregated header-wide and proportionally re-split across CGST/SGST/IGST/CESS by `computeRecoverableInputTaxByComponent` for the accounting preview (remainder goes to the largest gross component).

## Reverse charge (RCM)

`taxTreatment === 'REVERSE_CHARGE'` (header or per-line override): tax is self-assessed by the buyer.

- `lineTotal = taxableAmount` only — GST is **excluded** from what is owed to the vendor.
- CGST/SGST/IGST/CESS are still computed and still participate in the ITC recoverable/non-recoverable split (unaffected by RCM status).
- Self-assessed amounts are tracked separately in `rcmCgstAmount` / `rcmSgstAmount` / `rcmIgstAmount` / `rcmCessAmount` / `rcmTotalTaxAmount` and posted as **credits** to `RCM_*_PAYABLE` accounts in the accounting preview — additive to the balance, since the corresponding debit (recoverable + non-recoverable tax) is already booked on the debit side.
- `vendorPayableAmount` excludes all self-assessed RCM tax.

## TDS (`tdsRecognitionMode`)

Default base = `taxableAmount` (excludes GST); `tdsBaseOverride` replaces it when supplied.

| Mode | `tdsAmount` (posted) | `estimatedTdsAmount` | `vendorPayableAmount` |
|------|----------------------|-----------------------|-------------------------|
| `NOT_APPLICABLE` | 0 | 0 | `invoiceGrandTotal` |
| `AT_INVOICE` | `base × rate ÷ 100` | same as `tdsAmount` | `invoiceGrandTotal − tdsAmount` (error `TDS_EXCEEDS_GRAND_TOTAL` if this would go negative) |
| `AT_PAYMENT` | 0 (withheld later, at payment) | `base × rate ÷ 100` | `invoiceGrandTotal` — warning `TDS_AT_PAYMENT_NOTICE` |

`TDS_PAYABLE` is only a *required* account component when `mode === 'AT_INVOICE'` and `tdsAmount > 0`.

## Currency and base totals

Every `VendorInvoiceCalculationTotals` field has a `baseTotals` mirror computed as `amount × exchangeRate` (`convertAllTotals`), rounded to 4 dp.

`assertBaseCurrencyRate(currencyCode, baseCurrencyCode, exchangeRate, errors)` in `vendor-invoice-currency-calculator.service.ts` enforces `exchangeRate ≈ 1` when `currencyCode === baseCurrencyCode`. It is called from `calculateVendorInvoiceAmounts` using `configuration.baseCurrencyCode` (default `INR`).

## Duplicate detection

Live-DB only (`assessVendorInvoiceDuplicates`), scoped to `tenantId` + `legalEntityId` + `vendorId`, excludes `CANCELLED` invoices and (when editing) `excludeVendorInvoiceId`.

| Risk level | Trigger |
|------------|---------|
| `EXACT_BLOCKING` | Another non-cancelled invoice for the same vendor has the same normalized supplier invoice number — blocks the caller (`isBlocking: true`) |
| `HIGH` | No exact match, but another invoice for the same vendor shares the same supplier invoice date and grand total (±₹0.01) under a different number |
| `NONE` | No matches, or detection skipped (no `vendorId`/number, or `enabled: false`) |

`calculateVendorInvoiceSync` always returns `NONE` (`emptyVendorInvoiceDuplicateAssessment`) — duplicate detection requires the async, DB-backed path.

## Account resolution priority

For every required posting slot (`VendorInvoiceAccountComponent`: `LINE_DEBIT`, `INPUT_CGST/SGST/IGST/CESS`, `VENDOR_PAYABLE`, `TDS_PAYABLE`, `FREIGHT`, `ROUND_OFF`, `RCM_CGST/SGST/IGST_PAYABLE`):

1. Per-line `debitAccountId` (for `LINE_DEBIT` only) — source `LINE_OVERRIDE`.
2. `configuration.accounts.*` explicit override — source `EXPLICIT`.
3. Tenant `DefaultAccountMapping` lookup (async path only; `LINE_DEBIT`→`PURCHASE`, `INPUT_CGST`→`GST_INPUT_CGST`, etc. — see `DEFAULT_MAPPING_BY_COMPONENT`) — source `DEFAULT_MAPPING`. No mapping key exists for `INPUT_CESS` or the RCM payable components — override-only.
4. Otherwise `UNRESOLVED` — required components left unresolved make `accountReadiness.isReady = false` (`ACCOUNT_NOT_CONFIGURED`).

The async path additionally validates every resolved account exists in the legal entity, is not a group account (`ACCOUNT_IS_GROUP`), and is active (`ACCOUNT_INACTIVE`).

Components are only *required* when their underlying amount is non-zero (e.g. `FREIGHT` only required when `freightAmount > 0`; `TDS_PAYABLE` only when `mode === 'AT_INVOICE'` and `tdsAmount > 0`; RCM payables only when the invoice is reverse-charge with non-zero RCM tax) — `VENDOR_PAYABLE` and per-line `LINE_DEBIT` (when the line has a non-zero taxable+non-recoverable amount) are always required.

## Accounting preview invariants

`buildVendorInvoiceAccountingPreview` produces **draft, unposted** journal lines:

```text
Dr  Σ line (taxableAmount + nonRecoverableTaxAmount)   [LINE_DEBIT, per line]
Dr  Σ recoverable input tax (CGST/SGST/IGST/CESS)      [INPUT_*, header aggregate]
Dr  freightAmount                                       [FREIGHT]
Dr/Cr round-off (Dr when positive, Cr when negative)    [ROUND_OFF]
Cr  vendorPayableAmount                                  [VENDOR_PAYABLE]
Cr  tdsAmount (AT_INVOICE only)                          [TDS_PAYABLE]
Cr  rcmTaxTotals.{cgst,sgst,igst}Amount (RCM only)       [RCM_*_PAYABLE]
```

- A component whose account did not resolve is **omitted** from `lines` (not zero-amount-posted) and recorded as an issue — this deliberately makes the two sides fail to balance, which is the signal that the invoice cannot yet post.
- `isBalanced` requires: no unresolved-account issues, `totalDebit === totalCredit`, **and** at least one line (`lines.length > 0`) — an invoice with zero net effect is not considered "balanced", it is considered empty/invalid.
- Freight and other charges debit via `FREIGHT` / `OTHER_CHARGE` components when non-zero.
- Round-off uses `ROUND_OFF` (debit if positive, credit if negative).

## What this phase does **not** do

- No HTTP routes, controllers, or Swagger entries.
- No persistence — nothing is written to `VendorInvoice` / `VendorInvoiceLine` / `PayableOpenItem` by any function in this folder.
- No posting to GL, no `vendorInvoiceNumber` issuance, no `PayableOpenItem` creation.
- No draft workflow (submit/approve/reject) or supplier-invoice uniqueness claim — those are Phase 4A3.

## Related docs

| Doc | Purpose |
|-----|---------|
| [`AP_STATUS.md`](AP_STATUS.md) | Phase checklist and status line |
| [`AP_ARCHITECTURE.md`](AP_ARCHITECTURE.md) | Schema and repository design (Phase 4A1) |
| [`ACCOUNTING_PHASE_STATUS_MATRIX.md`](ACCOUNTING_PHASE_STATUS_MATRIX.md) | Cross-phase accounting matrix |
