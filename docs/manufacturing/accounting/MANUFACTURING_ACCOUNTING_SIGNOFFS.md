# Manufacturing Accounting Sign-Offs

Source: `manufacturing-accounting-enablement.service.ts`, model `ManufacturingAccountingSignOff`.

## Endpoints

### Inventory reconciliation

`POST /manufacturing/accounting/sign-offs/inventory-reconciliation`

```json
{
  "legalEntityId": "uuid",
  "inventoryReconcileConfirmed": true,
  "remarks": "Pilot warehouses reconciled.",
  "scope": { "plantId": "uuid", "warehouseIds": ["uuid"], "workOrderIds": ["uuid"] },
  "reportRef": "optional",
  "idempotencyKey": "optional"
}
```

Permission: `manufacturing.accounting.reconcile_signoff` (or `.reconcile` / `finance.settings.manage`).  
HTTP **422** `INVENTORY_RECONCILE_NOT_SIGNED_OFF` when not explicitly `true`.

### Finance pilot

`POST /manufacturing/accounting/sign-offs/finance-pilot`

```json
{
  "legalEntityId": "uuid",
  "pilotSignOff": true,
  "remarks": "Finance approved pilot enablement.",
  "scope": { "plantId": "uuid", "finishedItemIds": ["uuid"], "warehouseIds": ["uuid"] }
}
```

Permission: `manufacturing.accounting.finance_signoff` (or `finance.settings.manage`).  
Pre-checks: finance activated, mappings, open period, no failed events.

## Storage

1. **Additive row** in `manufacturing_accounting_sign_offs` (`ACTIVE`; prior ACTIVE → `SUPERSEDED`).
2. **Snapshot** on `FinanceFeatureControl.configurationJson` (current confirmedBy/At/remarks/scope + `signOffHistory[]`).

Does not overwrite history. Idempotency key returns the existing row.
