# Vendor Adjustments — Frontend (Phase 4C2)

## Routes

| Path | Page |
|------|------|
| `/accounting/money-out/vendor-adjustments` | Register |
| `/accounting/money-out/vendor-adjustments/new?type=VENDOR_DEBIT_NOTE` | Create (debit note default) |
| `/accounting/money-out/vendor-adjustments/:id` | Detail + lifecycle |
| `/accounting/money-out/vendor-adjustments/:id/edit` | Edit draft |
| `/accounting/money-out/vendor-adjustments/:id/allocate` | Debit note allocation |

## API client

`frontend/src/services/api/payablesApi.ts` + `payablesApiBridge.ts` — full CRUD, validate, workflow, post, reversal preview/reverse, allocatable-payables, allocations.

## UI patterns

- `MoneyOutWorkspaceShell` + workspace tabs (Vendor Adjustments live)
- Server-authoritative totals via `VendorInvoiceTotalsPanel`
- `allowedActions` + `useMoneyOutPermissions` for command bar
- Allocate page mirrors vendor payment allocate (idempotency key + concurrency timestamps)

## Verify

`npm run test:money-out-adjustments` (static checks) + `npm run typecheck`
