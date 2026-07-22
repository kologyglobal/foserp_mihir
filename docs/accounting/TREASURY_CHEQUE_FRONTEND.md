# Treasury Cheque Frontend (Phase 5B2)

## Routes (`VITE_USE_API=true`)

| Path | Page |
|------|------|
| `/accounting/bank-cash/cheques` | List |
| `/accounting/bank-cash/cheques/new` | Create |
| `/accounting/bank-cash/cheques/:id` | Detail |

Demo mode (`VITE_USE_API=false`) keeps the legacy `ChequeManagementPage` (Zustand demo) for the list route; the new create/detail routes redirect back to the list in demo mode since no demo screens exist for them.

## UX

- List: filters (status, direction, search by cheque number), KPI strip, "New Cheque" primary action, row navigation to detail.
- Create: single form — direction (Issued/Received), treasury BANK account, cheque number/date, payee, amount, PDC flag, accounting mode, optional counterpart GL account, narration. "More details" section for bank/branch, currency/exchange rate, and dates.
- Detail: summary panel, accounting preview panel (from backend calculation or stored snapshot), validation panel, timeline, and an action bar gated by the backend's `allowedActions` plus frontend permissions.
- Human labels throughout (Issued / Received, not raw enum values); one primary action per screen; loading/empty/error/permission-denied states follow the existing Dynamics-style components (`LoadingState`, `EnterpriseRegisterTableShell`, `ErpStatusChip`, `ErpButton`).
- Lifecycle actions requiring extra input (issue, deposit, clear, bounce, stop, reverse) use a single generic `ChequeLifecycleModal`; simple actions (submit, approve, reject, revise, mark-ready, cancel) use inline `appConfirm` / `appPromptNote`.
- Optimistic concurrency: mutations pass `expectedUpdatedAt` from the last-loaded cheque.

## Module layout

`frontend/src/modules/accounting/treasury/cheques/`

```
api/            treasury-cheque.types.ts, treasury-cheque.api.ts
hooks/          useChequeList, useChequeDetail, useChequeMutations, useChequeOverviewCounts
components/     ChequeStatusChip, ChequeWorkspaceShell, ChequeActionBar, ChequeForm,
                ChequeSummaryPanel, ChequeAccountingPreviewPanel, ChequeValidationPanel,
                ChequeTimeline, ChequeLifecycleModal
pages/          ChequeListPage, ChequeCreatePage, ChequeDetailPage (dual-mode wrappers)
                ApiChequeListPage, ApiChequeCreatePage, ApiChequeDetailPage
utils/          format.ts, idempotency.ts, list-filters.ts, treasuryChequeUi.ts
__tests__/      routes-and-nav.test.ts, permissions.test.ts
```

Plus:
- `treasuryApi.ts` — list/get/create/update/validate/submit/approve/reject/revise/mark-ready/cancel/issue/deposit/clear/bounce/stop/reverse.
- `frontend/src/utils/permissions/treasuryCheque.ts` — `useTreasuryChequePermissions` reading `finance.treasury.cheque.*`, with workspace-admin bypass and a Bank & Cash demo-permission fallback.

## API response shapes

Workflow endpoints (submit/approve/reject/revise/mark-ready/cancel/clear/bounce/stop/validate) return the `TreasuryChequeDto` directly (or a `ValidateChequeResult` for `validate`).

Posting endpoints (`issue`, `deposit`, `reverse`) return a wrapped `{ cheque, posting, idempotentReplay }` object; `treasury-cheque.api.ts` unwraps `.cheque` so callers always work with `TreasuryChequeDto`.

## Reused infrastructure

- `useTreasuryAccountOptions` (from transfers) filtered to `BANK` accounts only.
- `resolveLegalEntityId` from `financeApiBridge`.
- `BankCashWorkspaceTabs` inside `ChequeWorkspaceShell` (active tab: Cheques).
- Idempotency keys for create/issue/deposit/clear/bounce/stop/reverse via `useIdempotencyKey`.

## Tests

`npm run test:treasury-cheques` runs `frontend/scripts/verify-treasury-cheques.ts`, a static-analysis smoke test covering: permission key parity with backend, routes wiring, workspace-shell integration, action-bar wiring for all lifecycle actions, `treasuryApi` export coverage, and file existence for every module file. 92/92 passing.
