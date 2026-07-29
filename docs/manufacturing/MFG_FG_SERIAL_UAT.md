# MFG FG Serial UAT — Fuel Tank

## Policy

| Field | Value |
|-------|-------|
| Item | `FG-FUEL-TANK-5000L` |
| Tracking | SERIAL |
| Qty | 1 NOS per receipt (happy path) |
| Warehouse | `FG-MAIN` |
| Cost | `WorkOrderCostSnapshot.unitActualCost` |

## Evidence (2026-07-28)

| Field | Value |
|-------|-------|
| WO | `WO-000010` |
| Receipt | `FG-000002` |
| Serial | `FT-5000L-52948875` |
| InventorySerial | AVAILABLE @ FG-MAIN |
| Rate / value | ₹111,020.00 (= WO unitActualCost) |
| Stock onHand | 1 → 2 |

## Invariants

- Serial unique per tenant/item scope.
- No duplicate FG receipt for same eligible qty without correction.
- Capitalised FG cost ≤ eligible WO capitalisable cost (here equal: full qty 1).
- Partial FG (qty 3 WO / complete 1): existing FG eligibility rules — separate SPA/scenario; not this happy-path run.

## Dispatch readiness

After receipt: serial AVAILABLE + Final QC passed → FG is dispatch-ready. **Do not** expand Dispatch features in MFG-GOLDEN-1.
