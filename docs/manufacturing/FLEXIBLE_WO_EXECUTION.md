# Flexible Work Order Execution

**Status:** Implemented (API mode). Work Order is a self-contained production execution surface.

## Principle

A user can run **Create → Release → Start → Hold → Resume → Record Production → Complete Stage → Complete WO** without waiting for Inventory, Purchase, Quality, Costing, Accounting, Dispatch, or Finance.

Routing still drives the **recommended sequence** (snapshot on release, dependency-aware stage promotion). Permissions, warnings, and overrides keep the process flexible.

## Settings

| Key | Default | Effect |
|-----|---------|--------|
| `general.flexibleExecution` | `true` | Master switch: soften material/QC/overproduction hard blocks |
| `general.allowCloseWithoutQc` | `true` (with flexible) | WO complete converts QC blockers to warnings |
| `general.allowUnderCompletion` | `true` | Stage complete allowed below planned good qty |
| `general.allowOverproduction` + tolerance % | on / 5% | Expands planned max; flexible still allows beyond with warning |
| `materialConsumption.requireReservation` | `false` | If on and flexible, start warns instead of ConflictError |

Denormalized flags are also exposed on `GET /manufacturing/settings` (`flexibleExecution`, `allowUnderCompletion`, …).

## Lifecycle rules (flexible mode)

| Action | Hard block? | Notes |
|--------|-------------|-------|
| Release | BOM/routing ACTIVE only | Material sync failure does not abort release |
| Start | Status READY | Missing reservation → warning when flexible |
| Progress | WO IN_PROGRESS; stage READY/IN_PROGRESS | Over tolerance → **warning**, not 400 |
| Complete stage | WO IN_PROGRESS | Underproduction → warning. `qualityRequired` → complete + promote (QC deferred) unless `skipQcGate: false` |
| Complete stage (override) | `skipQcGate` + `qcOverrideReason` | Explicit override logged on activity |
| Complete WO | All mandatory stages COMPLETED/SKIPPED (QC_PENDING counts if allowCloseWithoutQc) | Quality blockers → **warnings**, not ConflictError |
| Hold / Resume | Status gates only | Reason required on hold |

## Inline QC on Work Order

- Stages tab shows **Stage QC** when `qualityRequired` or `QC_PENDING`.
- **Submit QC** calls Quality `decideInspection` when an open inspection exists (no navigation required).
- **Override & Complete Stage** calls `POST .../stages/complete` with `skipQcGate` + reason.
- Quality module remains available; it is not required to finish a flexible WO.

## Tracking (WO detail)

- Status, health, current stage, planned vs good, completion %, started time, duration
- Stage pipeline with ops table
- Activity timeline for lifecycle events (including underproduction / QC override notes)
- Assignments tab: Start / Pause / Resume on the WO

## API payloads

```http
POST /work-orders/:id/progress
→ { …, warnings?: string[] }

POST /work-orders/:id/stages/complete
Body: { stageId, remarks?, skipQcGate?, qcOverrideReason? }
→ { stage, promotedStages, order, awaitingQuality, warnings? }

POST /work-orders/:id/complete
→ { order, warnings: string[] }
```

## Out of scope

- Removing the Quality module
- Auto negative-stock inventory redesign (issue still uses inventory permissions)
- Demo-mode WO rewrite

## Related

- Phase 2A spine: [`PRODUCTION_PHASE2A_README.md`](PRODUCTION_PHASE2A_README.md)
- Operator My Work: [`OPERATOR_UX_GUIDE.md`](OPERATOR_UX_GUIDE.md)
