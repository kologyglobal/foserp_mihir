# Simple Manufacturing & Production

ERPNext-style **simple manufacturing** shell for FOS ERP. Frontend / mock store only until an explicit backend phase is scheduled. Production transactional API remains **deferred by design**.

## Principles

- **Core UX:** Select source → Confirm quantity → Complete. Material issue, consumption, FG output, scrap, and rework happen **inside the Work Order**, not as separate primary documents.
- **No Job Card / Material Issue / FG Receipt as primary user documents** in the simple flow (Job Cards fold into Work Orders).
- Match CRM / Dynamics visual language used in Purchase and Accounting.
- **One phase per implementation run.**

## Navigation

```text
Manufacturing & Production
├── Dashboard          /manufacturing
├── BOM                /manufacturing/bom
├── Production Plan    /manufacturing/production-plan
├── Work Orders        /manufacturing/work-orders
├── Job Work           /manufacturing/job-work
├── Reports            /manufacturing/reports
└── Settings           /manufacturing/settings
```

Sidebar rail label remains **Mfg** (`categoryId: production`).

## Legacy URLs

Hub bookmarks redirect into the new shell (legacy page modules remain on disk until later phases):

| Legacy path | Redirects to |
|-------------|--------------|
| `/production`, `/production/control-tower` | `/manufacturing` |
| `/production/job-cards` | `/manufacturing/work-orders` |
| `/work-orders` | `/manufacturing/work-orders` |
| `/job-work` | `/manufacturing/job-work` |

Detail / scan routes under `/work-orders/:id`, `/job-work/:id`, `/production/scan/*` still resolve for deep links until folded or removed.

## Phase roadmap

| Phase | Deliverable | Out of scope |
|-------|-------------|--------------|
| **1 — Shell + Dashboard** (done) | Nav, routes, Manufacturing Dashboard, placeholders / early BOM & Production Plan UI, legacy redirects | WO complete-flow rewrite, Job Work rewrite, backend |
| **2 — BOM** | Manufacturing BOM list/detail under `/manufacturing/bom`; reuse Engineering BOM master where possible | WO posting |
| **3 — Production Plan** | Plan list + create from SO/stock; generate planned WO lines (mock) | Live MRP engine |
| **4 — Simple Work Order** | WO workspace: select → confirm qty → Complete (issues/posts inside WO) | Separate Job Cards / Material Issue / FG Receipt docs |
| **5 — Job Work** | Subcontract send/receive under `/manufacturing/job-work` | Scan-heavy legacy UX unless reused lightly |
| **6 — Reports + Settings** | Simple production reports + module settings | Full costing / GL posting |

## Phase 1 status

- Left nav: **Manufacturing & Production** with the seven items above.
- Dashboard: mock KPIs (open WOs, delayed, FG today, shortages) + quick actions.
- BOM / Production Plan: demo FE under `/manufacturing/*` (ahead of strict Phase 1 placeholders where already built).
- Work Orders / Job Work / Reports / Settings: intentional placeholders (“later phase”).
- No new backend / Prisma for manufacturing.

## Deferred separate documents

Do **not** reintroduce as primary nav for the simple mode:

- Job Cards (as standalone workflow)
- Material Issue (as standalone WO companion doc)
- FG Receipt (as standalone companion doc)
- Scrap / Rework as separate document types outside the WO

Those concerns belong inside the Phase 4 Work Order complete flow.
