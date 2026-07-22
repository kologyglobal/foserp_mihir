# Report Catalogue (Phase 7D)

All report keys defined in `backend/src/modules/ops-reports/registry.ts`, with owning module,
required permission and availability. `UNAVAILABLE` reports are still listed by the catalog API
(`disabled: true`) so the UI can explain why they are missing.

Availability legend: **READY** = fully computed from live data · **PARTIAL** = computed but with
a documented caveat · **UNAVAILABLE** = no source data in this build (empty result + warning).

## PRODUCTION

| Key | Name | Permission | Availability |
|-----|------|-----------|--------------|
| `production-control` | Production Control Tower | `manufacturing.reports.production` | READY |
| `shopfloor-live` | Shopfloor Live Board | `manufacturing.reports.shopfloor` | READY |
| `shift-dashboard` | Shift Production Dashboard | `manufacturing.reports.shift` | READY |
| `work-order-progress` | Work Order Progress | `manufacturing.reports.production` | READY |
| `plan-vs-actual` | Plan vs Actual | `manufacturing.reports.production` | READY |
| `stage-performance` | Stage Performance | `manufacturing.reports.work_centres` | READY |
| `work-centre-performance` | Work Centre Performance | `manufacturing.reports.work_centres` | READY |
| `issues-downtime` | Issues & Downtime | `manufacturing.reports.downtime` | READY |

## MATERIALS

| Key | Name | Permission | Availability |
|-----|------|-----------|--------------|
| `material-readiness` | Material Readiness | `manufacturing.reports.materials` | READY |
| `material-reconciliation` | Material Reconciliation | `manufacturing.reports.materials` | READY |

## WIP

| Key | Name | Permission | Availability |
|-----|------|-----------|--------------|
| `wip-position` | WIP Position | `manufacturing.reports.wip` | READY |
| `wip-ageing` | WIP Ageing | `manufacturing.reports.wip` | READY |

## JOB_WORK

| Key | Name | Permission | Availability |
|-----|------|-----------|--------------|
| `job-work-ageing` | Job Work Ageing | `manufacturing.reports.job_work` | READY |
| `job-work-reconciliation` | Job Work Reconciliation | `manufacturing.reports.job_work` | READY |

## QUALITY

| Key | Name | Permission | Availability |
|-----|------|-----------|--------------|
| `quality-dashboard` | Quality Dashboard | `quality.reports.view` | READY |
| `quality-inspections` | Quality Inspections | `quality.reports.view` | READY |
| `production-quality` | Production Quality / First-Pass Yield | `quality.reports.production` | **PARTIAL** |
| `ncr-register` | NCR Register | `quality.reports.ncr` | READY |
| `rework-rejection` | Rework & Rejection Analysis | `quality.reports.production` | READY |
| `supplier-quality` | Supplier Quality | `quality.reports.view` | **UNAVAILABLE** — no GRN / incoming-inspection model |

## DISPATCH

| Key | Name | Permission | Availability |
|-----|------|-----------|--------------|
| `dispatch-readiness` | Dispatch Readiness | `dispatch.reports.view` | READY (FG stock not joined) |
| `sales-order-fulfilment` | Sales Order Fulfilment | `dispatch.reports.fulfilment` | READY |
| `dispatch-performance` | Dispatch Performance | `dispatch.reports.view` | READY |
| `invoice-readiness` | Invoice Readiness | `dispatch.reports.invoice_readiness` | **PARTIAL** — readiness flags only, no invoice posting |
| `delivery-challans` | Delivery Challans | `dispatch.reports.view` | **UNAVAILABLE** — no DeliveryChallan model (Dispatch is 7C0 only) |

---

**Totals:** 25 report keys — 21 READY, 2 PARTIAL (`production-quality`, `invoice-readiness`),
2 UNAVAILABLE (`supplier-quality`, `delivery-challans`).

Traceability, the shopfloor live board and the exception centre are separate endpoints (not
registry report keys) — see their dedicated docs.
