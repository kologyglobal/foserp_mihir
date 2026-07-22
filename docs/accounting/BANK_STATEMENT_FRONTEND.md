# Bank Statement Frontend (Phase 5A2)

## Routes (API mode)

| Path | Page |
|------|------|
| `/accounting/bank-cash/statements` | List |
| `/accounting/bank-cash/statements/import` | Import wizard |
| `/accounting/bank-cash/statements/manual` | Manual entry |
| `/accounting/bank-cash/statements/:id` | Detail / review |
| `/accounting/bank-cash/statements/:id/edit` | Edit draft |
| `/accounting/bank-cash/import-batches/:id` | Import batch |
| `/accounting/bank-cash/mapping-templates` | Mapping templates |

Demo mode (`VITE_USE_API=false`) continues to use existing demo pages where wired.

## Module path

`frontend/src/modules/accounting/treasury/bank-statements/`  
API client: `frontend/src/services/api/treasuryApi.ts`  
Permissions: `frontend/src/utils/permissions/treasuryStatement.ts`

## Live vs preview nav

**Live:** Bank Statements, Import Statement, Manual Statement, Mapping Templates  
**Preview / unavailable:** Matching, Reconciliation, Bank Charges, Transfers, Cheque Clearing
