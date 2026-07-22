# Job Work Costing

Source: `backend/src/modules/manufacturing/costing/work-order-cost.service.ts` (job-work section), model `JobWorkOrder`.

Sub-contracted (job work) cost follows an **invoice → expected-cost provisional chain**: the real vendor invoice is used when linked, otherwise the job's expected cost stands in as provisional.

---

## Per job-work order

For each `jobWorkOrder` on the work order:

- `expected = job.expectedCost` (planned)
- `linked = job.invoiceStatus === 'LINKED' && job.invoiceAmount != null`
- `amount = linked ? job.invoiceAmount : expected`
- `plannedJobWork += expected`
- `actualJobWork += amount`

If **not linked**, the amount is added to the snapshot `provisionalCost` and a `PROVISIONAL_JOB_WORK:<jobId>` warning is raised.

---

## Provisional chain

| Job-work state | Actual cost used | Provisional? |
|----------------|------------------|--------------|
| Invoice `LINKED` with `invoiceAmount` | `invoiceAmount` | No |
| Not linked (any other `invoiceStatus`, or no amount) | `expectedCost` | Yes → `PROVISIONAL_JOB_WORK` |

This mirrors the material fallback pattern: a best-available figure keeps costing complete, flagged provisional until the real invoice arrives. Recalculating after the invoice links naturally replaces the provisional amount and clears the warning — no rewrite.

The costing policy field `jobWorkCostSource` (`LINKED_INVOICE` default / `APPROVED_CHARGE` / `PROVISIONAL_RATE`) records intent; the calculator's live behaviour is the linked-invoice-else-expected chain above.

---

## Cost entry written

One `WorkOrderCostEntry` per job:

- `costCategory = JOB_WORK`, `sourceEntityType = JOB_WORK_ORDER`, `sourceEntityId = job.id`, `jobWorkOrderId = job.id`
- `itemId = job.itemId`, `quantity = job.acceptedQty`, `rate = job.rate`
- `amount` = linked invoice amount or expected cost
- `provisional = !linked`

---

## Accounting

Job-work cost is absorbed into WIP (when enabled) via the manual `JOB_WORK_RECEIPT_COST` event (debit `WIP_INVENTORY`, credit `JOB_WORK_ABSORPTION`) recorded by `recordAbsorptionEvents` as a delta over previously-recorded job-work absorption. See `MANUFACTURING_POSTING_EVENTS.md`.
