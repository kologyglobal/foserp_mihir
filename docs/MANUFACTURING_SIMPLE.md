# Simple Manufacturing — Production Command Center

ERPNext-style **simple manufacturing** for FOS ERP. Frontend / mock store only until an explicit backend phase is scheduled. Production transactional API remains **deferred by design**.

## Product feel

**One simple production command center** — not a stack of ERP documents.

### Do not build this (too heavy)

```text
BOM → Job Card → Material Issue → Operation Entry → FG Receipt → Scrap Entry → QC Entry → Rework Entry
```

### Better flow (this product)

```text
BOM
↓
Plan
↓
Work Order                          ← center
↓
Start / Hold / Complete / QC / Close   (all on the WO)
↓
Shopfloor View + Reports
```

Material check, consumption, scrap, rework, and FG output stay **inside the Work Order** — they are actions, not separate primary documents. Job Work is optional outside processing on a WO.

| Area | Role |
|------|------|
| **Work Order** | **Center** — Start / Hold / Complete / QC / Close |
| BOM | What is needed |
| Plan | What to make |
| Shopfloor + Reports | Visibility |
| Control Room | Owner / manager attention board |
| Job Work | Optional outside processing |
| Settings | Keep Advanced off |

## Principles

- **Core UX:** Select source → Confirm quantity → Complete **inside the Work Order**.
- Material issue, consumption, FG output, scrap, and rework are **not** separate primary documents.
- No Job Card / Material Issue / FG Receipt as primary user documents (Job Cards fold into Work Orders).
- Quick Mode and Automatic Consumption are the recommended defaults (ON).
- Nav and command map always point back to the Work Order.

## Navigation

```text
Manufacturing
├── Control Room       /manufacturing/control-room   ← owner / manager
├── Work Orders        /manufacturing/work-orders   ← center
├── Shopfloor          /manufacturing/shopfloor
├── Production Plan    /manufacturing/production-plan
├── BOM                /manufacturing/bom
├── Routes             /manufacturing/routes         ← operation stages for WO
├── Job Work           /manufacturing/job-work
├── Reports            /manufacturing/reports
└── Settings           /manufacturing/settings
```

**Production Control Room** (owner/manager): Today's Plan, Running WOs, Material Shortage, QC Pending, Delayed WOs, Job Work Pending. Execute on the Work Order — Control Room is attention only.

`/manufacturing` and `/manufacturing/dashboard` redirect to Control Room.

## Route Master (reusable process template)

Create a Route **once** and attach it to a Finished Item / default BOM. Status: **Draft → Active → Inactive** (one Active route per finished item).

Work Order create stays simple (Source · Item · Qty · Dates). The system auto-finds active BOM + active Route, then **copies** operation lines into the WO as a snapshot.

- Review stages on the create form before saving
- Do not rebuild Cutting → Welding → … on every WO
- Route override is permission-gated
- Edits on the WO Operations tab affect **that WO only**
- Existing WOs keep their original snapshot if the master route changes later

`/manufacturing/routes` — Route No, Name, Finished Item, Version, Status, Default BOM, Remarks.

**Operation lines:** Sequence, Operation Name, Work Center, Planned Time, QC Required, Job Work (+ default vendor), Remarks (plus optional qty/scrap flags in demo).

Example: **Tank Assembly Route** — Cutting → Welding → Coating → Assembly → Final QC.

**WO Operations tab** executes the snapshot (Start / Hold / Complete / QC / Job Work). Shopfloor shows Current / Next Operation. Master edits never rewrite existing WOs.

## Phase status

| Phase | Status | Deliverable |
|-------|--------|-------------|
| **1 — Shell + Dashboard** | Done | Nav, dashboard, BOM/Plan demo, redirects |
| **2 — Work Orders** | Done | Register, Quick Mode create, detail execution screen (8 tabs, status actions, stepper Ready/QC Pending) |
| **3 — Complete Production** | Done | Complete dialog (good qty), partial output, auto consumption preview, optional manual issue, return, quality hold, scrap, rework, close, cost/variance preview — all inside WO |
| **4 — Job Work + Reports + Settings** | Done | Job Work list/create/detail; 8 report cards with filters/export/print; settings (quick mode / auto consumption / advanced off by default) |
| **5 — Shopfloor + AI UX** | Done | Live Board + Machine/Line + Daily Summary tabs; AI panels; WO steppers |
| **6 — Manager Dashboard** | Done | Production Control Room (`/manufacturing/control-room`) — plan / running / shortage / QC / delayed / job work |
| **7 — Route / Operations** | Done | Reusable Route Master + WO route snapshot on create; Operations tab; no Job Cards |

## Production Plan flow

Open `/manufacturing/production-plan` → list plans → New Plan (source, warehouse, lines) → Detail with Create WO / Generate Work Orders. Sources: Sales Order, Stock Requirement, Forecast, Manual. Statuses: Draft → Planned → Work Orders Created → Closed.

Open `/manufacturing/bom` → list (filters for item / status / active / version) → New BOM with finished item, qty basis, materials, Save Draft or Activate. Detail tabs: Overview, Components, Cost Estimate, Where Used, Timeline.

## Work Order create (Quick Mode)

`/manufacturing/work-orders/new` — enter Source, Finished Item, Qty, Dates. System auto-fills BOM, materials, warehouses, **Route Operations (review table)**, QC/Job Work flags, cost. Actions: Save Draft, Check Materials, Create & Mark Ready.

Open `/manufacturing/work-orders` — WO No, Source, Finished Item, Planned/Good Qty, Due Date, Material, QC, Production Status, Owner/Line. Status chips include Draft / Ready / In Progress / On Hold / QC Pending / QC Hold / Completed / Closed / Cancelled. Top actions: Create, Import from Production Plan, View Shopfloor, Export.

## Work Order detail (execution screen)

`/manufacturing/work-orders/:id` — main shopfloor execution page.

- **Header:** WO No, Finished Item, Status, Planned/Good Qty, Due Date, Material Status, QC Status, Source Reference
- **Actions by status:** Check Materials, Reserve Materials, Start, Hold, Resume, Complete Production, Send to QC, Close, Cancel
- **Quick action drawers:** Check Material, Start Production, Hold, Complete Production, QC Action, Close (summary + Confirm Close → read-only)
- **Stepper:** Draft → Ready → In Progress → Completed → [QC Pending if QC required] → Closed
- **Tabs:** Overview, Materials, **Operations**, Production, Quality, Job Work, Costing, Timeline, Documents

## Work Order flow

1. BOM defines materials.
2. Plan (or Sales Order / Manual) creates a Work Order.
3. On that **one** Work Order: Start / Hold / Complete / QC / Close.
4. Shopfloor and Reports show status and performance — they do not replace the WO.

## Shopfloor flow

Open `/manufacturing/shopfloor` — three supervisor views, **tablet/phone friendly**:

1. **Live Board** — Ready / In Progress / On Hold / QC Pending / Completed. On phone/tablet: lane chips + card list (not a 5-column board). Large touch actions: Start, Hold, Resume, Complete, QC Accept, Close.
2. **Machine / Line View** — cards per line on mobile; table on desktop. Current WO, operator, qty, next WO, hold reason.
3. **Daily Production Summary** — planned / good / scrap / rework / rejected / QC pending / delayed / job-work pending.

## Mobile / tablet execution UX

Priority screens: Shopfloor, Work Order Detail, Start / Hold / Resume / Complete / QC / Close drawers.

- Large touch buttons (`MfgTouchBtn`), status chips, card-based WO rows
- Sticky action footer on WO detail (Start, Hold, Resume, Complete, QC Accept, Close)
- Action drawers open as bottom sheets on phone; right drawers on desktop
- Minimal fields on mobile (scrap/rework/reject and remarks behind optional sections)
- No complex tables on small screens — material lines use cards

## Role-based UI planning (placeholder)

Demo-only role switcher on manufacturing pages (`ManufacturingRoleBar`). **No backend RBAC yet.**

| Role | Can do (UI) |
|------|-------------|
| **Owner / Management** | Dashboard, reports, all WOs, production performance (read-focused) |
| **Production Manager** | Create plans & WOs; start / hold / complete / close |
| **Supervisor** | Start, hold, resume, complete production |
| **Store User** | View material requirement; reserve & issue material |
| **QC User** | QC pending WOs; accept / reject / rework |
| **Job Work User** | Create JW; send / receive material; reconcile |
| **Viewer** | Read-only |

Default preview role: **Production Manager**. Persisted in `localStorage` (`fos-mfg-ui-role`). Switching roles updates action buttons and soft route guards immediately.

## Job Work flow

`/manufacturing/job-work` — outside processing linked to Work Orders (demo FE only).

- **List:** Job Work No, Linked WO, Vendor, Process, Material Sent Date, Sent/Received/Balance Qty, Status, Actions
- **Statuses:** Draft → Material Sent → Partially Received → Received → Reconciliation Pending → Closed (or Cancelled)
- **Create:** Select WO, Vendor, Process, Material to Send, Qty, Expected Return, Rate placeholder, Remarks
- **Detail tabs:** Overview, Material Sent, Receipts, Reconciliation, Vendor Invoice Placeholder, Timeline, Documents
- **Flow:** Select WO → Vendor → Send Material → Receive Qty → Reconcile → Link Vendor Invoice (placeholder) → Close
- No complex subcontracting accounting in UI

## Reports

`/manufacturing/reports` — simple export-friendly cards:

1. Work Order Status Report
2. Daily Production Report
3. Material Consumption Report
4. Scrap & Rework Report
5. QC Pending Report
6. Job Work Pending Report
7. Delayed Work Orders Report
8. Production Efficiency Report

Each report: Date / Item / Status / Warehouse filters, Export CSV, Print. Column sets documented on the report view.

## Settings

`/manufacturing/settings` — simple sections for normal users:

1. General — Quick Mode, Auto BOM / Warehouse / Consumption / QC Detection
2. Work Order — numbering series, manual create, close without QC, over-production %, partial completion
3. Material — reserve before start, allow incomplete material, negative stock warning, default warehouses
4. Quality — item-master QC, QC before close, rework, reject
5. Job Work — enable, material reconciliation, vendor invoice placeholder
6. Advanced — **collapsed by default**; complex MRP / routing / OEE / IoT stay off

## AI assistance

Right-side insight boxes (not a chatbot) on Dashboard, Shopfloor, Work Order create/detail, Production Plan, and Job Work.

Examples: delayed WOs, material shortages, QC pending, start-ready materials, BOM gaps, overdue vendor returns.

## Deferred separate documents

Do **not** reintroduce as primary nav:

- Job Cards (optional via settings — default off)
- Material Issue / FG Receipt as standalone docs
- Scrap / Rework modules outside the WO
- Separate QC module (QC lives on the WO)

## Backend

No manufacturing Prisma/API yet. Frontend permissions under `manufacturing.*` gate UI only — **backend authorization must enforce the same permission rules** when APIs ship.
