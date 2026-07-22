# Work Order Form UX

## Create Work Order — `/manufacturing/work-orders/new` (`ApiWorkOrderCreatePage.tsx`)

Layout: 12-col grid — form 8 cols, context panel 4 cols.

- **Step selection**: Manual vs From Sales Order (tab strip; deep-linkable via `?mode=sales_order`).
- **Essential fields**: Product Item, Planned Quantity, Planned Start, Required Completion Date, Priority.
- **Optional details** collapsed (Job Number, Notes) — progressive disclosure.
- **Sales Order path**: eligible orders → line eligibility table (Eligible/Blocked with reasons) → convert quantity (defaults to remaining).
- **Context panel — Manufacturing Readiness** (`ManufacturingReadinessPanel`):
  server-derived from `listProfiles({ productItemId, status: ACTIVE })` + `getProfileReadiness`:
  Profile / BOM Version / Routing Version / RM / WIP / FG warehouses each shown as
  Ready / Missing with human explanations. Missing setup blocks release, not draft creation
  (explicitly stated).
- **"What happens next"** panel: draft → release snapshots BOM/routing → requirements sync → start.
- Primary action: **Create Work Order** (idempotency key on submit).
- Permission gate: `manufacturing.work_orders.create` (explicit access-denied state).

## Work Order Detail — `/manufacturing/work-orders/:id` (`ApiWorkOrderDetailPage.tsx`)

- **Next Best Action banner** (server status + permissions):
  - Draft → Release Work Order (locks BOM/Routing snapshots)
  - Ready → Start Production
  - On Hold → Resume (with hold reason)
  - Quality blockers while running → Open Quality
  - Completed + FG post permission → Receive Finished Goods
- **Header card**: WO number, product, source, status/health badges, open-issue and active-assignment chips.
- **Operational summary strip**: Planned / Good / Rework / Rejected / Scrap / Completion %.
- **Primary tabs**: Overview, Stages, Materials, Quality, Changes, Timeline (+ More: Assignments, Job Work/Transfers, Costing, BOM Snapshot, Ledger).
- **Overview**: basic info grid + completion progress + collapsible `DocumentInfoPanel`
  (General / Dates / Source / Setup with snapshot lock states).
- **Materials tab**: readiness table (required/reserved/issued/shortage/free), actions:
  - Reserve (line + all), Shortage PR, Sync
  - **Issue…** → `MaterialIssueDrawer` posting preview (replaces old inline qty input)
  - **Return…** → `MaterialReturnDrawer` (visible when returnable balance > 0; requires reason)
- **Complete** → `CompleteWorkOrderDialog` with server close-readiness (blockers/warnings + production position). No generic confirm.
- **FG receipt** → `FgReceiptDrawer` (eligibility, preview, post; batch field required when profile demands it).
- Command-bar labels are lifecycle-specific: Release Work Order / Start Production / Record Production / Receive Finished Goods.

## Release / Start / Hold / Resume

- Release and Start are single-click lifecycle actions with server validation; failures surface
  as human-readable toasts and the readiness data explains blockers beforehand.
- Hold: reason category (required), expected resume date, remarks. On-hold state is surfaced
  in the header card and next-best-action banner.
- Resume: remarks-only drawer.

## Information score (10-point standard)

| Category | Where |
|---|---|
| Identity | header card + breadcrumb |
| Status | status + health badges, human labels |
| Ownership | supervisor/manager fields (admin user names resolved) |
| Source | source label + job number + info panel |
| Dates | summary + info panel (created/required/released/started/completed) |
| Quantities | summary strip + completion panel |
| Readiness | materials readiness, quality blockers, close-readiness dialog |
| Exceptions | issues tab, runtime changes, corrections links |
| Related records | changes/transfers/job-work/costing tabs, corrections register link |
| Activity | timeline tab + stage ledger |
