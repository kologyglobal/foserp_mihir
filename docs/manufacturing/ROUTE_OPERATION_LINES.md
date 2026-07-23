# Route operation lines

## Visible fields

| Field | Required | Notes |
|-------|----------|-------|
| Operation No. (`sequence`) | Yes | Default +10 (10, 20, 30…) |
| Description (`name`) | Yes | Production action |
| Work Centre | Yes | Active, tenant-scoped |
| Machine | No | Filtered by Work Centre; cleared when WC changes |
| Setup Time + Unit | No | Units: Second…Week |
| Run Time + Unit | No | Same unit enum; `runTimeBasis` under Advanced |
| QC Required | Yes | Boolean |
| QC Test Group | If QC Yes | `qcTestGroupId` → Quality Inspection Plan |

## Resource rule

Work Centre mandatory. Machine optional. No Workstation.

Blank Machine = supervisor may assign an eligible machine on the WO at runtime.

## Storage

- `setupTimeMinutes` remains the costing-compatible minutes field
- `setupTimeUnit` / `runTimeUnit` store display units (`ManufacturingTimeUnit`)
- Default stage group `MAIN` is auto-created when ops are added without an explicit stage (BC flat-line UX)
