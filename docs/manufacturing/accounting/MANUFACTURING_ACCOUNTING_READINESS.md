# Manufacturing Accounting Readiness

Source: `backend/src/modules/manufacturing/accounting/manufacturing-accounting-readiness.service.ts`  
API: `GET /api/v1/t/:tenantSlug/manufacturing/accounting/readiness`

Read-only enablement readiness. **No posting. No feature-flag mutation.**

## Query

| Param | Required | Notes |
|-------|----------|-------|
| `legalEntityId` | preferred | UUID; defaults via manufacturing LE resolution |
| `postingDate` | optional | `YYYY-MM-DD`; default = tenant timezone today |
| `includeTechnicalDetails` | optional | only honoured for elevated roles |

## Response (consolidated)

- `ready` / `canEnable`
- `checks` — accountMappings, openFinancialPeriod, failedAccountingEvents, unreconciledAccountingEvents, inventoryReconciliation, pilotFinanceSignOff
- `blockingCodes` / `blockers`
- `nextAction` `{ code, label }`
- `allowedActions`
- `featureFlag` (enabled + audit metadata)
- `signOffHistorySummary`
- `readiness` — legacy detailed payload

## Next-action priority

1. `CONFIGURE_ACCOUNT_MAPPINGS`
2. `OPEN_ACCOUNTING_PERIOD`
3. `RESOLVE_FAILED_EVENTS`
4. `RESOLVE_UNRECONCILED_EVENTS`
5. `COMPLETE_INVENTORY_SIGNOFF`
6. `COMPLETE_FINANCE_SIGNOFF`
7. `ENABLE_MANUFACTURING_ACCOUNTING`

## UI

Canonical: **Accounting → Manufacturing Accounting** (`/accounting/manufacturing`).  
Alias: `/manufacturing/costing/accounting-readiness` → redirects to canonical.
