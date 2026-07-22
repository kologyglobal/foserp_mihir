# Physical WIP Rules (Phase 7A3)

## Modes

| Mode | Inventory | Source of truth |
|------|-----------|-----------------|
| **LOGICAL_WIP** | No stock movement | Production Stage Ledger + `ProductionWipMovement` (logical) |
| **STOCKED_SEMI_FINISHED** | Yes — Inventory movement | Inventory + WIP movement link (`physicalPosted`, outbound/inbound movement ids) |

Configured on `ManufacturingProfile.wipTrackingMethod`.

## Rules

1. Do not force all WIP into Inventory.  
2. Stocked WIP requires Item + WIP warehouse (mapping / profile).  
3. Partial receipt / send-forward / return / WO-to-WO transfer reuse Phase 5B services.  
4. Quality blockers block unrestricted stocked WIP movement.  
5. WIP quantities must not go negative (server validation).  
6. Work Order split does not copy physical stock (split feature still deferred).

**API:** `GET /manufacturing/work-orders/:id/wip-position` — labels Logical vs Stocked.
