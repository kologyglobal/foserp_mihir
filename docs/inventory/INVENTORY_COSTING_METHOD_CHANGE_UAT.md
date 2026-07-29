# Inventory Costing — Method Change UAT

## Flow (required)

1. Current method (effective-method API)
2. Select target method + effective date
3. **Readiness & preview** (`GET …/inventory/costing/method-change/preview`)
4. Approve / reason
5. Execute (`POST …/method-change`) — `inventory.setup.manage`
6. Result + reconciliation link

Do **not** change method via a silent settings dropdown.

## Readiness severities

| Severity | Meaning |
|----------|---------|
| PASS | Safe to proceed |
| WARNING | Proceed with awareness (mid-period, opening migration, GL deferred, unidentified pools) |
| BLOCKED | Execute rejected unless `force=true` (uncosted movements, negative stock, same method, missing standards when targeting Standard) |

## Preview fields

- Affected balances, on-hand qty, current inventory value
- Proposed opening value (= current value this phase — no silent revaluation)
- Expected difference (0 unless future revaluation engine)
- Method evidence (FIFO migration hint, MA opening avg, missing standards, unidentified layers)
- GL impact: **Not Available**

## Permissions (this phase)

| Action | Permission |
|--------|------------|
| View / preview | `inventory.view_cost` (or stock/view equivalents) |
| Execute | `inventory.setup.manage` |
| Dedicated approve | Deferred — reuse setup.manage; do not invent parallel roles yet |

## Immutability

- `InventoryValuationMethodChange` audit row written
- Prior `InventoryCostEntry` rows keep original method/costs
- Opening migration may seed FIFO/Specific layers without changing physical qty

## Automated check

`inventory-costing-uat1-controlled.test.ts` → Method change readiness + tenant isolation  
`inventory-costing-phasec.test.ts` → force switch to FIFO + migration
