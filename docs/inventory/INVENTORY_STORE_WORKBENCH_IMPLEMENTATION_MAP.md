# Inventory & Store Workbench — Existing Implementation Map

Last audited against code: 2026-07-22.

## Source-of-truth decision

The authoritative physical-stock ledger is `InventoryStockMovement`. `InventoryStockBalance`
is a cached projection updated in the same transaction by
`backend/src/modules/inventory/shared/stock-posting.service.ts` and
`balance.service.ts`.

Do not create a second stock ledger, balance, reservation, Work Order material, GRN,
FG-receipt, or Dispatch allocation model.

## Capability map

| Capability | Existing route | Existing model | Existing service | Status | Gap / required change | Regression risk |
|---|---|---|---|---|---|---|
| Stock balance | `GET /inventory/balances`, `/position` | `InventoryStockBalance` (+ `qcHoldQty`/`blockedQty`/`rejectedQty`) | inventory balance + posting services | Live | In-transit remains derived from transfer docs; authorized balance repair later | Medium |
| Immutable stock ledger | `GET /inventory/ledger` | `InventoryStockMovement` (+ status/batch/serial) | `InventoryPostingService` / `stock-posting.service.ts` | Live SoT | Location/bin dimensions still deferred | High |
| Ledger/balance reconciliation | `GET /inventory/balances/reconciliation` | Existing ledger + balance | `reconciliation.service.ts` | Live read-only | Persist exceptions and authorized correction later | Low |
| Reservations | `/inventory/reservations`; Dispatch reservation routes | `InventoryStockReservation` | inventory + dispatch reservation services | Live | Reservable qty is unrestricted free qty only; full reallocate UX later | High |
| Purchase receipt | Purchase GRN lifecycle | GRN + inventory movement | `purchase-inventory-posting.ts` | Live | QC GRN posts to `QC_HOLD`; no-QC remains unrestricted | High |
| Purchase QC | `/purchase/quality-inspections` | `PurchaseQualityInspection` | QI service + `transferStockStatus` | Live | Accepted → unrestricted; rejected → rejected bucket | High |
| Production issue/return | Work Order materials routes | ProductionOrderMaterial + inventory movement | manufacturing material service | Live | Tighten document + movement transaction boundary | High |
| Extra issue | Runtime/material services | Existing material/runtime models | manufacturing services | Partial | Stable separate variance classification and approval | Medium |
| WIP transfer | Manufacturing WIP routes | `ProductionWipMovement` | WIP movement service | Live | Reuse shared paired-transfer helper later | Medium |
| FG receipt | `/manufacturing/fg-receipts` | `ProductionFinishedGoodsReceipt` | FG receipt service | Live | FG QC-hold output path still warehouse-mapping based | High |
| Dispatch reservation/pick | Dispatch 7C2 routes | Inventory reservation + pick models | dispatch reservation/pick services | Live | DISPATCH reservation consumption fixed at confirm | High |
| FG dispatch | Dispatch outbound confirm | OutboundDispatch + inventory movement | outbound + `InventoryPostingService` | Live | Controlled reversal remains required | High |
| Warehouse transfer document | `/inventory/transfers` | `InventoryTransfer` / `InventoryTransferLine` | transfer services | Live | Request→approve→dispatch→partial receive→reverse | Medium |
| Stock count/adjustment workflow | `/inventory/stock-counts`, `/inventory/adjustments` | `InventoryStockCount*`, `InventoryAdjustment*` | count/adjustment services | Live | Snapshot→count→approve→post variance; controlled adj approval | Medium |
| Batch/serial | `/inventory/lots`, `/inventory/serials`, `/inventory/traceability` | `InventoryBatch*`, `InventorySerial*`, `InventoryLot*` | posting + tracking + traceability | Live | Dual batch/lot masters coexist; consolidate UX later | High |
| Store Workbench | `/inventory/store-workbench` (+ mfg alias) | Live projections only | inventory store-workbench compose | Live | Needs Action aggregates purchase/dispatch/transfers/counts/recon/exceptions | Medium |
| Inventory accounting hooks | `/inventory/accounting/*` | `InventoryAccountingEvent` | gate/builder/event services → central `post()` | Live flag-off | Enable `INVENTORY_ACCOUNTING` after COA mapping review | Medium |
| Stock Overview UI | `/inventory/stock` | Live balances API in API mode | inventoryApi | Partial FE | Surface status buckets in register/drawer | Medium |
| Ledger UI | `/inventory/ledger` | Live ledger API in API mode | inventoryApi | Partial FE | Show batch/serial/status columns | Low |
| Traceability/reports | `/inventory/traceability` + ops reports | Batch/serial lineage + ops reports | traceability + ops-reports | Partial | Richer origin-to-destination report pack later | Medium |

## Phase sequence

1. **Core quantity accuracy:** shared posting facade, reservation-consumption correctness,
   ledger/balance reconciliation, idempotency and rollback tests. **Done.**
2. **Shared Store Workbench:** compose live queues under `/inventory/store-workbench`;
   preserve `/manufacturing/store-workbench`. **Done (Needs Action aggregation).**
3. **Reservation consolidation:** one inventory-owned reservation engine with partial
   allocation/release/reallocate/consume. **Partial** — unrestricted-only free qty + DISPATCH/SO consume fixed; reallocate UX later.
4. **Production material operations:** atomic issue/return/extra issue and material position. **Existing manufacturing ownership; no duplicate docs.**
5. **Warehouse transfers:** request, dispatch, in-transit, partial receipt, discrepancy, reversal. **Done (document workflow live).**
6. **FG/QC:** FG and semi-finished receipts, hold/release/reject, Dispatch readiness. **Partial** — purchase QI status buckets live; FG hold still mapping-based.
7. **Counts/adjustments:** snapshot, count, approval, post, reverse, negative-stock exception. **Done (document workflow live).**
8. **Batch/serial/traceability/reports.** **Done for masters + lineage APIs;** report pack later.
9. **Accounting hooks:** central Accounting posting engine only; feature-gated. **Done (flag default off).**

## Remaining follow-ups

- Apply pending migrations on each environment (`prisma-cli.ts migrate deploy`).
- Enable `INVENTORY_ACCOUNTING` only after COA default-account mappings are reviewed.
- Consolidate `InventoryBatch` vs `InventoryLot` UX (both persist today).
- Wire FE Needs Action tab to `/inventory/store-workbench/needs-action`.
- Live lifecycle tests for transfers/counts/QC-hold after migrate deploy.

## Non-negotiable compatibility

- Keep `/manufacturing/store-workbench` and existing document lifecycle routes.
- Never hydrate demo Zustand inventory data in API mode.
- Existing domain modules remain owners of their documents; Inventory owns quantity posting.
- Posted movements are immutable. Correction is always a compensating movement.
- Historical applied migrations are not rewritten; all schema changes are forward-only.
