# Treasury Transfer Frontend (Phase 5B1)

## Routes (`VITE_USE_API=true`)

| Path | Page |
|------|------|
| `/accounting/bank-cash/transfers` | List |
| `/accounting/bank-cash/transfers/new` | Quick create |
| `/accounting/bank-cash/transfers/in-transit` | In-transit workspace |
| `/accounting/bank-cash/transfers/approvals` | Approvals entry |
| `/accounting/bank-cash/transfers/:id` | Detail |
| `/accounting/bank-cash/transfers/:id/edit` | Edit draft |

Demo mode keeps legacy `FundTransfersPage` when `VITE_USE_API=false`.

## UX

- Simple first screen: From / To / Amount / Date / Reference / Narration
- More Details: purpose, posting mode, dates, branches, notes
- Mode recommendation card from backend
- Accounting preview from backend (never local line construction)
- Confirmations for post / dispatch / receive / reverse
- Amounts as strings; dates `YYYY-MM-DD`
- Commands gated by `allowedActions`

## Module

`frontend/src/modules/accounting/treasury/transfers/` + methods on `treasuryApi.ts`.
