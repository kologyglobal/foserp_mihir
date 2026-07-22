# Manufacturing Costing Policy

Source: `backend/src/modules/manufacturing/costing/costing-policy.service.ts`, `costing.schemas.ts`, model `ManufacturingCostingPolicy`.

A costing policy chooses the **rate sources** and **overhead method** used when a work-order cost is calculated. There is at most one `ACTIVE` policy per plant scope; if none exists a built-in provisional policy is used.

---

## Costing method — `ACTUAL` vs `PLANNED_AS_PROVISIONAL`

`ManufacturingCostingMethod` enum has exactly two values:

| Value | Meaning in code |
|-------|-----------------|
| `PLANNED_AS_PROVISIONAL` (default) | Planned figures are computed for comparison, but the snapshot's **actual** cost is always built from real movements/daily lines/invoices; where a real value is missing, a provisional fallback fills in and the cost is flagged provisional. |
| `ACTUAL` | Same actual-cost computation. The calculator does **not** branch differently on `ACTUAL`; it is a labelling/intent field. |

> **`STANDARD_WITH_VARIANCE` is not implemented** — it is not a member of the enum. Any standard-costing / capitalise-at-standard-then-variance workflow is deferred.

---

## Built-in fallback policy

When no `ACTIVE` policy resolves for the tenant/plant, `resolveCostingPolicy` returns `BUILT_IN_COSTING_POLICY`:

| Field | Built-in value |
|-------|----------------|
| `costingMethod` | `PLANNED_AS_PROVISIONAL` |
| `materialValuationSource` | `MOVEMENT_UNIT_COST` |
| `labourRateSource` | `WORK_CENTRE_RATE` |
| `machineRateSource` | `MACHINE_RATE` |
| `jobWorkCostSource` | `LINKED_INVOICE` |
| `overheadMethod` | `NONE` |
| `overheadRate` / `defaultLabourRate` / `defaultMachineRate` | `0` |
| `fgPostingMode` / `variancePostingMode` | `MANUAL` |
| `currencyCode` | `INR` |
| `builtIn` | `true` |

Resolution prefers a plant-specific `ACTIVE` policy, then a tenant-wide (`plantCode = null`) one, ordered by `plantCode desc`, `effectiveFrom desc`, `createdAt desc`.

---

## Rate sources

| Policy field | Values | Used for |
|--------------|--------|----------|
| `materialValuationSource` | `MOVEMENT_UNIT_COST` (default), `PROVISIONAL_RATE` | Material actual cost basis — see `MATERIAL_COSTING_RULES.md`. In code the actual material amount comes from `InventoryStockMovement.value` regardless; the field records intent. |
| `labourRateSource` | `WORK_CENTRE_RATE` (default), `TENANT_DEFAULT` | `WORK_CENTRE_RATE` → `workCentre.costRate` (falling back to `defaultLabourRate`); `TENANT_DEFAULT` → always `defaultLabourRate`. |
| `machineRateSource` | `MACHINE_RATE` (default), `WORK_CENTRE_RATE` | `WORK_CENTRE_RATE` → `workCentre.costRate`; `MACHINE_RATE` → `machine.costRate` (falling back to work-centre then `defaultMachineRate`). |
| `jobWorkCostSource` | `LINKED_INVOICE` (default), `APPROVED_CHARGE`, `PROVISIONAL_RATE` | Job-work actual cost — see `JOB_WORK_COSTING.md`. Actual uses linked invoice amount when `invoiceStatus = LINKED`, else the job's `expectedCost` (provisional). |

`manufacturing_machines.costRate` was added in the Phase 7E migration to supply the machine rate.

---

## Overhead methods

`overheadMethod` (enum `ManufacturingOverheadMethod`) with `overheadRate`:

| Method | Formula (per `overheadAmount`) |
|--------|-------------------------------|
| `NONE` (default) | 0 |
| `PER_LABOUR_HOUR` | `labourMinutes / 60 × rate` |
| `PER_MACHINE_HOUR` | `machineMinutes / 60 × rate` |
| `PER_GOOD_UNIT` | `goodQuantity × rate` |
| `PERCENT_OF_MATERIAL_COST` | `materialCost × rate / 100` |

Validation: when `overheadMethod ≠ NONE`, `overheadRate` must be > 0 (enforced on create, update, and activate).

---

## Lifecycle & status

`ManufacturingCostingPolicyStatus`: `DRAFT` → `ACTIVE` → `ARCHIVED`.

- Created as `DRAFT`. Only `DRAFT` policies can be edited.
- **Activate** archives any other `ACTIVE` policy in the same plant scope (tenant-wide vs a specific `plantCode`) in a transaction, then sets `ACTIVE` and stamps `effectiveFrom` if unset.
- `ARCHIVED` policies cannot be activated.
- Delete is a soft delete (`deletedAt`, status → `ARCHIVED`) and is blocked while `ACTIVE`.
- Unique per `(tenantId, name)`.

---

## Account mapping reuse — no parallel table (ADR-039)

Manufacturing costing/accounting reuses the finance **`DefaultAccountMapping`** table for all GL account resolution. There is **no `ManufacturingAccountMapping` table**. The policy stores rate/overhead intent only; it does **not** hold GL accounts. See `MANUFACTURING_ACCOUNT_MAPPING.md`.

---

## API

Under `/api/v1/t/:tenantSlug/manufacturing/costing/policies` (permissions `manufacturing.costing_policy.view|manage`):
`GET` list, `POST` create, `GET/:id`, `PATCH/:id`, `DELETE/:id`, `POST/:id/activate`.
`GET /costing/readiness` → tenant accounting readiness (`manufacturing.accounting.view`).
