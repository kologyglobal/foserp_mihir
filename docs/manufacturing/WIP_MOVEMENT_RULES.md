# WIP Movement Rules

| Type | Physical post |
|------|----------------|
| LOCATION_WIP + LOGICAL_WIP profile | Activity-only (`physicalPosted=false`) |
| LOCATION_WIP + STOCKED/BOTH | Paired ISSUE+INWARD `WIP_TRANSFER` |
| MATERIAL_RELOCATE | Always physical if stockable; updates material warehouse |
| WO_TO_WO | Physical attribution to target; `sourceWorkOrderId` set |

Same-warehouse LOCATION/MATERIAL moves are rejected. Idempotency keys supported.
