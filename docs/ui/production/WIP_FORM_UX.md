# WIP Transfer Form UX (FORM 12)

Component: `frontend/src/modules/manufacturing/work-orders/WipTransferDrawer.tsx`
Entry: Work Order detail → Transfer (permission `manufacturing.wip.move` / `materials.transfer`).

## Movement types

| Type | Meaning | Stock effect |
|---|---|---|
| LOCATION_WIP | Move WIP between locations/warehouses | Logical or physical per WIP mode |
| MATERIAL_RELOCATE | Relocate issued material | Paired inventory movements |
| WO_TO_WO | Transfer to another work order | Source responsibility ↓, destination ↑ |

## Form

- Source: work order, quantity, from-warehouse.
- Destination: warehouse / target work order (selected from lists, never typed IDs).
- Reason required.
- Posted movements listed in the Job Work / Transfers tab with **Physical/Logical** flag,
  movement number, from/to warehouse names, and posted timestamp.

## Rules

- Posting is explicit and immutable; reversals via corrections.
- Labels distinguish logical WIP transfer vs stocked WIP transfer (spec §23).
