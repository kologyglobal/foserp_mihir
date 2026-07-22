# Runtime Change Approval Matrix

Approvals are **manufacturing-local** (`ProductionRuntimeChange` + `ManufacturingRuntimeChangeRule`). Finance approval workspace is not used (ADR-035).

## Hard-coded defaults (no tenant rule configured)

`determineRuntimeChangeRisk` (`runtime-change-risk.service.ts`) applies these defaults whenever no active `ManufacturingRuntimeChangeRule` exists for the change type. Rules are **opt-in only** — they are never auto-seeded, so the dynamic percentage/day-threshold checks below stay live for every tenant unless an admin explicitly configures an override.

| Change type | Default risk | Approval required | Notes |
|-------------|--------------|-------------------|-------|
| Priority / supervisor / operator / hold / resume (WO + stage) | LOW | No | Direct apply after draft/submit |
| Quantity — within tolerance (≤10% change, default) | LOW | No | `qtyChangePct` vs. `qtyTolerancePct` (default 10, overridable via rule `configJson`) |
| Quantity — beyond tolerance, or increase exceeds remaining SO demand | MEDIUM / HIGH | Yes | Over-demand always forces `HIGH` regardless of tolerance |
| Due date — delay ≤7 days (default) | LOW | No | `delayDays` vs. `dueDateDelayDays` (default 7, overridable) |
| Due date — delay beyond threshold | MEDIUM | Yes | |
| Machine / work centre change | MEDIUM | No | |
| Add / repeat operation | MEDIUM | No | |
| Skip operation — optional, not quality-required | LOW | No | |
| Skip operation — mandatory (`isOptional=false`) or quality-required | HIGH | Yes | |
| Convert remaining to job work | HIGH | Yes | Draft JW only |

An active tenant `ManufacturingRuntimeChangeRule` (matched by `tenantId` + `changeType`, most-recently-updated wins) always overrides the row above verbatim (`riskLevel`, `approvalRequired`), except that `overDemand` on `QUANTITY_CHANGE` still forces `HIGH`/approval-required ahead of any rule check. `runtime-change-rules.seed.ts` provides an idempotent `ensureDefaultRuntimeChangeRules(tenantId)` helper tenants/admin tooling can call to materialise the table above as editable rows — it is **not** invoked automatically.

## Role permission subsets

| Role | Runtime-change keys |
|------|---------------------|
| Production Manager | All `manufacturing.runtime_change.*` via production pack |
| Production Supervisor | `view`, `request`, `apply` + assignment / machine / hold type keys |
| Production Engineer | `view`, `request` + route / skip / machine / work_centre / schedule type keys |
| Approver | Needs `manufacturing.runtime_change.approve` / `.reject` |

Type-specific keys (e.g. `manufacturing.runtime_change.quantity`) are enforced in the service in addition to route-level `request`/`apply`.
