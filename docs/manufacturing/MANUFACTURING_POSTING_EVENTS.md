# Manufacturing Posting Events

Source: `backend/src/modules/manufacturing/accounting/manufacturing-accounting-event.service.ts`, `manufacturing-accounting-builder.service.ts`, `costing/posting-orchestrator.service.ts`. Model `ProductionAccountingEvent`.

All manufacturing GL flows through **`ProductionAccountingEvent`** rows and post via the central finance `post()` engine. Nothing writes GL directly.

---

## Event types (`ProductionAccountingEventType`)

`MATERIAL_RESERVED`, `MATERIAL_ISSUED`, `MATERIAL_RETURNED`, `MATERIAL_CONSUMED`, `WIP_MOVED`, `SEMI_FINISHED_RECEIVED`, `PRODUCTION_COMPLETED`, `FINISHED_GOODS_RECEIVED`, `SCRAP_RECORDED`, `PRODUCTION_ORDER_CLOSED`, `LABOUR_ABSORPTION`, `MACHINE_ABSORPTION`, `OVERHEAD_ABSORPTION`, `JOB_WORK_RECEIPT_COST`, `PRODUCTION_VARIANCE`, `MANUFACTURING_REVERSAL`.

Only a subset is **MappingReady** (postable to GL). Others can be recorded for audit but are not posted.

---

## Event status (`ProductionAccountingEventStatus`)

| Status | Meaning |
|--------|---------|
| `RECORDED` | Persisted; not posted (flag off path is `SKIPPED_FLAG_OFF`; this is the default for manual events awaiting post) |
| `POSTED` | Balanced SYSTEM voucher created via `post()`; `voucherId` + `postingEventId` + `postedAt` set |
| `SKIPPED_ZERO` | Flag on but amount ≤ 0 or event not MappingReady — nothing to post |
| `SKIPPED_FLAG_OFF` | `MANUFACTURING_ACCOUNTING` disabled at record time |
| `FAILED` | Posting attempt threw; `failureReason` classified |
| `REVERSED` | Superseded by a compensating reversal |

On record: `RECORDED` when `attemptPost = false`; else `SKIPPED_FLAG_OFF` if flag off; else `SKIPPED_ZERO` if not postable; else it posts immediately and becomes `POSTED`.

---

## MappingReady debit/credit pairs

`EVENT_MAPPINGS` — each pair resolves against `DefaultAccountMapping` keys (see `MANUFACTURING_ACCOUNT_MAPPING.md`):

| Event type | Debit | Credit |
|------------|-------|--------|
| `MATERIAL_ISSUED` | `WIP_INVENTORY` | `RAW_MATERIAL_INVENTORY` |
| `MATERIAL_RETURNED` | `RAW_MATERIAL_INVENTORY` | `WIP_INVENTORY` |
| `FINISHED_GOODS_RECEIVED` | `FINISHED_GOODS_INVENTORY` | `WIP_INVENTORY` |
| `SCRAP_RECORDED` | `SCRAP_LOSS` | `WIP_INVENTORY` |
| `LABOUR_ABSORPTION` | `WIP_INVENTORY` | `LABOUR_ABSORPTION` |
| `MACHINE_ABSORPTION` | `WIP_INVENTORY` | `MACHINE_ABSORPTION` |
| `OVERHEAD_ABSORPTION` | `WIP_INVENTORY` | `PRODUCTION_OVERHEAD_ABSORPTION` |
| `JOB_WORK_RECEIPT_COST` | `WIP_INVENTORY` | `JOB_WORK_ABSORPTION` |
| `PRODUCTION_VARIANCE` | `PRODUCTION_VARIANCE` | `WIP_INVENTORY` |
| `MANUFACTURING_REVERSAL` | from payload `debitMappingKey` | from payload `creditMappingKey` |

`isPostableManufacturingEvent` = type in this map **or** `MANUFACTURING_REVERSAL`. Non-mapped types (e.g. `MATERIAL_RESERVED`, `WIP_MOVED`, `PRODUCTION_COMPLETED`, `PRODUCTION_ORDER_CLOSED`) are not posted.

Special cases:
- **`PRODUCTION_VARIANCE`** with a negative signed variance flips debit/credit.
- **`MANUFACTURING_REVERSAL`** requires both `debitMappingKey` and `creditMappingKey` in the payload or the build throws.

---

## Posting request shape

`buildManufacturingPostingRequest` emits a balanced 2-line `PostingRequest`:

- `eventType = MFG_<type>`, `eventKey = idempotencyKey`, `voucherType = SYSTEM`, `postingPurpose = SYSTEM_DOCUMENT`, `sourceModule = MANUFACTURING`.
- Amount formatted to 4 dp, always absolute; line 1 debit, line 2 credit; `projectReference = productionOrderId`.

Posted through `post()` (finance posting engine, Phase 2B). Idempotency is enforced two ways: `ProductionAccountingEvent` unique `(tenantId, idempotencyKey)`, and the posting engine's own `eventKey` idempotency (a retry returns the same `voucherId`).

---

## Auto-recorded events (shop floor)

`tryRecordManufacturingAccountingEvent` is called from operational flows and skips silently if the tenant has no legal entity:

| Flow | Event | Idempotency key |
|------|-------|-----------------|
| Material issue (`material.service.ts`) | `MATERIAL_ISSUED` | `PROD_MAT_ISSUE:<movementId>:V1` |
| Material return | `MATERIAL_RETURNED` | `PROD_MAT_RETURN:<movementId>:V1` |
| FG receipt (`fg-receipt.service.ts`) | `FINISHED_GOODS_RECEIVED` | `PROD_FG_RCV:<movementId>:V1` |

These post automatically **only when the flag is on**; otherwise they are `SKIPPED_FLAG_OFF`.

---

## Manual post / retry

`posting-orchestrator.service.ts`:

- **`validateEvent`** — event must be `RECORDED`/`FAILED`/`POSTED`; readiness must pass; amount > 0 (`ZERO_EVENT_AMOUNT` blocker). Returns `ready` + blockers.
- **`postEvent`** — only `RECORDED` or `FAILED` may post (`POSTED` returns as-is). Validates, builds request, calls `post()`, sets `POSTED` with voucher refs; on error sets `FAILED` with a classified `failureReason` (`CONFIGURATION` / `OPERATIONAL` / `ACCOUNTING` / `TECHNICAL`) and rethrows.
- **`retryEvent` = `postEvent`** — voucher-idempotent (same voucher id on retry).
- **`recordAbsorptionEvents`** — for the latest snapshot, records `LABOUR_ABSORPTION`, `MACHINE_ABSORPTION`, `OVERHEAD_ABSORPTION`, `JOB_WORK_RECEIPT_COST` as the **delta** over prior non-`REVERSED` amounts (skips non-positive deltas). Key `P7E_<type>:<WO>:<snapshotVersion>`, `attemptPost: false`.

API: `POST /accounting/events/:id/validate|post|retry` (`manufacturing.accounting.validate|post|retry`); `GET /accounting/events`, `/accounting/events/:id`, `/accounting/gate` (`manufacturing.cost.view`).
