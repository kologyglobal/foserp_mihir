# Bank Matching Rules (Phase 5A3)

> Last verified: **2026-07-20**.

## Candidate eligibility

Posted, active, not-reversed GL entries with positive unreconciled amount; same tenant, legal entity, currency; date within search range; account is either:

1. **Direct bank** — `GeneralLedgerEntry.accountId = TreasuryAccount.glAccountId`, or
2. **Allowed clearing** — receipt/payment clearing routed to the selected treasury account via `PaymentAccountMapping`.

## Direction

| Statement | Direct bank GL | Clearing (typical) |
|-----------|----------------|--------------------|
| CREDIT | Bank DEBIT | Receipt clearing DEBIT |
| DEBIT | Bank CREDIT | Payment clearing CREDIT |

## Scoring (0–100, transparent)

| Feature | Points |
|---------|-------:|
| Exact amount | +45 |
| Exact UTR / bank reference | +30 |
| Exact document number | +20 |
| Exact normalized narration | +15 |
| Same date | +15 |
| Within 1 / 3 / 7 days | +12 / +10 / +6 |
| Party name | +5 |
| Source amount remaining exact | +5 |
| Unique candidate bonus | +10 |
| Ambiguity penalty | −15 |
| Weak text-only | −20 |

Confidence: `EXACT` 95–100 · `HIGH` 85–94 · `MEDIUM` 65–84 · `LOW` &lt;65 (hidden by default).

Weights are configurable via `BankReconciliationProfile` (`minimumSuggestionScore`, `autoReconcileScore`, `dateToleranceDays`, etc.).

## Automatic match policy

Auto-create an **ACTIVE** match only when:

- Candidate is `DIRECT_BANK_GL`
- Confidence / score meets `autoReconcileScore` (typically EXACT band)
- Unique candidate
- Exact amounts
- No posting required
- No partial / grouped requirement
- `autoReconcileEnabled` (and related settings)

Clearing, grouped, partial, and ambiguous cases become **suggestions** only. Auto-match **never** posts clearing settlements.

## Reference normalisation (match-only)

Trim, uppercase, remove safe punctuation, collapse whitespace. Original imported references are never mutated.

## Grouped suggestions

Bounded after one-to-one: max candidate pool / group size / combination limit from settings (default group size 5). Exact sum only.

## Partial matching

Statement and GL remaining amounts may be partially allocated. Totals on a match must still balance (statement allocations = ledger allocations = match amount). Residuals stay unmatched — no automatic write-off.

## Suggestion staleness

Accept revalidates remaining amounts, candidate status, currency, direction, routing, versions. If changed → `BANK_RECONCILIATION_SUGGESTION_STALE`.
