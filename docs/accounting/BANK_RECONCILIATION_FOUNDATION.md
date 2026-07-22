# Bank Reconciliation — Settings Foundation (Phase 5A1)

> Last verified: **2026-07-20**. Settings module still applies; **execution** is Phase 5A3 — see [`BANK_RECONCILIATION_ARCHITECTURE.md`](BANK_RECONCILIATION_ARCHITECTURE.md).

Overview: [`BANK_CASH_ARCHITECTURE.md`](BANK_CASH_ARCHITECTURE.md).

## Scope

`BankReconciliationProfile` holds **settings** — date basis, duplicate policy, approval requirement, and Phase 5A3 matching controls (`dateToleranceDays`, `autoReconcileEnabled`, `autoReconcileScore`, `minimumSuggestionScore`, group/partial flags, finalization tolerances, etc.).

Matching / session execution lives in `backend/src/modules/accounting/treasury/bank-reconciliation/` (Phase 5A3).

## Bank-only

A reconciliation profile can only exist for a `TreasuryAccount` with `accountType = BANK`. Any attempt to GET or PUT a profile for a `CASH` or `CLEARING` account returns `400 BANK_RECONCILIATION_PROFILE_BANK_ONLY`.

## `lastReconciled*` fields are read-only from this endpoint

`lastReconciledDate`, `lastReconciledBalance`, `lastReconciledAt`, `lastReconciledBy` are written by the reconciliation **finalize** path (5A3), not by the settings PUT. The PUT schema still declares these as `z.never()`.

## Create-on-first-PUT (upsert)

`GET` returns `404 BANK_RECONCILIATION_PROFILE_NOT_FOUND` if no profile exists yet. `PUT` creates on first call and updates thereafter (`expectedUpdatedAt` required on update).

## API

Mounted at `/api/v1/t/:tenantSlug/accounting/treasury/accounts/:id/reconciliation-profile`.

| Method | Permission |
|---|---|
| `GET` | `finance.treasury.reconciliation_settings.view` |
| `PUT` | `finance.treasury.reconciliation_settings.manage` |
