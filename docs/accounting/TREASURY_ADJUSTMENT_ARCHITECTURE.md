# Treasury Adjustment Architecture (Phase 5B3)

**Status:** Shipped (backend + dual-mode frontend). Code is source of truth under `backend/src/modules/accounting/treasury/adjustments/`.

## Purpose

Controlled accounting for bank-originated transactions that are not AR receipts, AP payments, cheques, or internal transfers:

- Bank charges / interest / collection & merchant fees
- Direct debit / credit
- Other bank debit/credit (narration + explicit offset + approval required)
- Standing-instruction and statement-led drafts

## Source document

Single document: **`TreasuryAdjustment`** (+ `TreasuryAdjustmentLine` offset lines).

Differentiate via `TreasuryAdjustmentType`. Direction (`BANK_DEBIT` / `BANK_CREDIT`) is server-derived from type (except `GST_ADJUSTMENT`).

## Non-negotiables

1. No second journal engine — posting uses central `post()` only.
2. No AR/AP open items from adjustments.
3. Statement lines never auto-post; standing instructions never auto-approve/post.
4. Bank GL line is backend-generated; clients submit offset lines only.
5. Bankbook/cashbook are read-only GL views.

## API prefix

`/api/v1/t/:tenantSlug/accounting/treasury/…`

| Area | Paths |
|------|-------|
| Adjustments | `/treasury-adjustments*` |
| Statement-led create | `/bank-statements/:statementId/lines/:lineId/treasury-adjustment` |
| Classification | `/bank-statements/:statementId/lines/:lineId/classify` |
| Posting rules | `/bank-posting-rules*` |
| Standing instructions | `/standing-instructions*` |
| Books | `/books/bankbook`, `/books/cashbook` (+ export) |

## PostingEvent keys

- Post: `TREASURY_ADJUSTMENT_POST:{id}:V1`
- Reverse: `TREASURY_ADJUSTMENT_REVERSE:{id}:V1`

Statement-led post atomically creates voucher + bank reconciliation match.

## Frontend

| Route | Purpose |
|-------|---------|
| `/accounting/bank-cash/treasury-adjustments*` | Bank Transactions workspace |
| `/accounting/bank-cash/standing-instructions*` | Standing instructions |
| `/accounting/bank-cash/posting-rules` | Classification rules |
| `/accounting/bank-cash/bankbook` | GL bankbook |
| `/accounting/bank-cash/cashbook` | GL cashbook |

Reconciliation workspace: **Create Bank Transaction** opens a draft drawer (classify → draft only).

Gated by Finance Settings `useTreasuryAdjustmentsForStatementItems` (default true). When false, BE returns `422 TREASURY_ADJUSTMENT_STATEMENT_PATH_DISABLED` and the recon button is hidden.

## Deferred

MT940/CAMT · bank APIs · payment files · FX treasury · advanced multi-currency liquidity (beyond Phase 5C1 soft day-close).
