# Treasury Transfer Architecture (Phase 5B1)

> Last verified: **2026-07-20** against `backend/src/modules/accounting/treasury/transfers/` and `frontend/src/modules/accounting/treasury/transfers/`.

Related: [`TREASURY_TRANSFER_WORKFLOW.md`](TREASURY_TRANSFER_WORKFLOW.md) · [`TREASURY_TRANSFER_ACCOUNTING.md`](TREASURY_TRANSFER_ACCOUNTING.md) · [`TREASURY_TRANSFER_FRONTEND.md`](TREASURY_TRANSFER_FRONTEND.md) · [`BANK_CASH_STATUS.md`](BANK_CASH_STATUS.md)

## Principle

One source document — `TreasuryTransfer` — covers all company-owned fund movements:

```text
BANK → BANK | BANK → CASH | CASH → BANK | CASH → CASH
```

Transfer type is **derived** from source/destination `TreasuryAccountType`. Users never select CLEARING accounts; in-transit clearing is resolved by the server.

## Posting modes

| Mode | When | Accounting |
|------|------|------------|
| `DIRECT` | Both legs same operational moment | One voucher: Dr destination / Cr source |
| `IN_TRANSIT` | Source leaves before destination confirms | Dispatch then receipt via internal clearing |

Recommended defaults: bank↔bank and cash→bank → IN_TRANSIT; bank→cash and same-branch cash↔cash → DIRECT. Forced IN_TRANSIT when dates differ, settings require it, amount exceeds threshold, or cross-branch policy applies. Backend remains authoritative (`TREASURY_TRANSFER_IN_TRANSIT_REQUIRED`).

## Scope rules

- Same legal entity only (`TREASURY_TRANSFER_INTERCOMPANY_NOT_SUPPORTED`)
- Same currency only (no FX)
- Source ≠ destination
- BANK/CASH only as user-selectable accounts
- No P&L, AR/AP, tax, inventory, or purchase side effects

## Numbers

| Field | When assigned |
|-------|----------------|
| Draft reference `TTR-DRAFT-…` | Create draft (no series) |
| Transfer number `TTR/…` | Direct post or in-transit dispatch |
| Voucher numbers | Central posting (`SYSTEM` → JOURNAL series) |

## Clearing resolution

1. `DefaultAccountMapping` key `INTERNAL_TRANSFER_CLEARING`
2. Else active CLEARING `TreasuryAccount` GL for the legal entity / currency
3. Else `TREASURY_TRANSFER_CLEARING_ACCOUNT_MISSING`

## Balance controls

- **CASH source:** available book balance ≥ amount (hard block)
- **BANK source:** FinanceSettings `treasuryTransferBankBalancePolicy` = ALLOW | WARN | BLOCK
- Balance recalculated inside posting transaction (concurrency-safe)

## Reconciliation

Posted **bank** GL legs are Phase 5A3 reconciliation candidates (`sourceDocumentType = TREASURY_TRANSFER`). Cash legs are not bank-statement candidates. Transfer status and reconciliation status are independent. Active recon matches block transfer reversal.

## Explicitly out of scope

Cheques · intercompany · cross-currency · bank charges · payment files · bank APIs · Phase 5B2.
