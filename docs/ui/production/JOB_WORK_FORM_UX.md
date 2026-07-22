# Job Work Form UX (FORM 16–19)

Routes: `/manufacturing/job-work`, `/new`, `/:id`, `/:id/edit` (dual mode via `jobWorkService`).

## Create (FORM 16) — `JobWorkFormPage.tsx`

Stepwise source → vendor → material/movement → commercial reference; API mode links a
Work Order via `listWorkOrders`. Primary: **Create Draft Job Work**.

## Detail — `JobWorkDetailPage.tsx`

- Header: JW number, vendor, status badge (human labels via `jobWorkStatusMeta`).
- Summary tiles include pending **Balance** with vendor.
- Lifecycle actions map to status: Send Material → Receive → Reconcile → Close
  (single relevant primary; others in overflow).

## Dispatch (FORM 17) / Receipt (FORM 18)

Dialogs show planned vs sent vs pending, quantity entry, dates; receipts feed the vendor
pending balance and reconciliation. `SUBCON_OUT` / `SUBCON_IN` semantics stay server-side.

## Reconciliation (FORM 19) — modernised

The reconciliation tab now leads with the explicit equation strip:

```
Sent = Consumed + Returned + Process loss + Pending with vendor
```

- Totals aggregated across material lines (sent + additional sent; returned + scrap returned).
- **Unexplained difference is never hidden**: shown in red with
  "must be approved or resolved before close"; zero difference shows a green confirmation.
- Per-material table: Sent / Consumed / Returned / Balance / Status.
- Actions: Reconcile, Approve Difference (with note via prompt), Close Job Work —
  close is blocked while `canClose` is false server-side.
