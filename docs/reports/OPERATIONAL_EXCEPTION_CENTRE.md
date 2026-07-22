# Operational Exception Centre (Phase 7D)

**Services:** `ops-reports/exceptions/exception-derivation.service.ts`,
`ops-reports/exceptions/exception.service.ts`
**Routes:** `/operations/exceptions` — `GET /`, `GET /summary`,
`POST /:exceptionKey/acknowledge|assign|resolve`
**Permissions:** `operations.exceptions.view` (read), `operations.exceptions.manage` (act).

Exceptions are **derived live** from operational ledgers on every request. A thin
`OperationalExceptionAction` row stores only the *workflow overlay* (acknowledge / assign /
resolve / dismiss) — never a copy of the underlying condition.

---

## Derived, not stored

`deriveOpenExceptions(tenantId)` recomputes the open set each call from these sources (each
bounded, tenant-scoped):

| Category | Condition |
|----------|-----------|
| `WORK_ORDER_OVERDUE` | Open WO (`DRAFT`/`READY`/`IN_PROGRESS`/`ON_HOLD`) with `requiredCompletionDate` in the past. Severity HIGH if > 7 days. |
| `MATERIAL_SHORTAGE` | `ProductionOrderMaterial.status = SHORT` on an open WO. Severity HIGH. |
| `CRITICAL_ISSUE` | `ProductionIssue` severity CRITICAL and status open. |
| `QUALITY_PENDING` | `QualityInspection` status `PENDING`/`READY`/`IN_PROGRESS`. Severity HIGH if pending > 3 days. |
| `NCR_OPEN` | `QualityNcr` status ≠ `CLOSED`. Severity from the NCR. |
| `JOB_WORK_OVERDUE` | Open job work order past `expectedReturnDate`. Severity HIGH if > 7 days. |
| `SALES_ORDER_LINE_OVERDUE` | Open SO line past `requiredDate`/`expectedDeliveryDate` with undispatched remaining qty. |

Each derived exception has a stable `exceptionKey` (e.g. `WO_OVERDUE:<id>`), category, severity,
`sourceType`/`sourceId`, title, detail, `ageDays`, and `referenceDate`. Rows are returned sorted
by age (oldest first). `/summary` aggregates counts by category / severity / resolution status.

## Workflow overlay — `OperationalExceptionAction`

- `acknowledge` → upserts an action with `resolutionStatus = ACKNOWLEDGED`.
- `assign` → sets `assignedTo`; moves an `OPEN` action to `IN_PROGRESS`.
- `resolve` → sets `RESOLVED` (or `DISMISSED` when `dismiss = true`) with note + resolver.
- The action is keyed by `(tenantId, exceptionKey)` and stores only workflow state — the
  exception itself is always re-derived, so a listed row merges the derived condition with any
  existing action (defaulting to `resolutionStatus: OPEN`).

## Can't resolve while the source is still open

- `resolveException` **rejects** (`ConflictError`) when the underlying condition is still derived
  as open and `dismiss` is false:
  > "This exception is still open at the source (e.g. the work order is still overdue or the NCR
  > is still open). Resolve the underlying record first, or use dismiss instead."
- To close an exception you either **fix the source record** (after which the condition stops
  being derived and can be marked resolved cleanly) or explicitly **dismiss** it with a note.
- This guarantees the exception centre can never show "resolved" while the real problem is still
  live in the ledger.
