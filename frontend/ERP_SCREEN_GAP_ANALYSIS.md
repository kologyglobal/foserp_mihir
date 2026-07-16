# ERP Screen Gap Analysis

**System:** Vasant Trailer ERP  
**Audit date:** 23 June 2026  
**Baseline UX maturity:** **88 / 100** (post Phase 1 design-system rollout)  
**Target UX maturity:** **95 / 100**  
**Benchmarks:** Microsoft Dynamics 365 · SAP Business One · SAP S/4HANA Fiori · Oracle Fusion Manufacturing

---

## Executive Summary

Vasant Trailer ERP has **~95 routed screens** covering a strong **discrete manufacturing anchor path** (SO → MRP → WO → QC → Dispatch → Invoice). Compared to tier-1 ERPs, the gap is not missing *business logic* on the happy path — it is missing **role-based workspaces**, **control towers**, **shop-floor productivity surfaces**, **finance depth**, and **executive analytics** that enterprise users expect.

**Critical finding:** Several fully built screens are **not routed** — users cannot reach them from navigation:

| Screen | Status | Impact |
|--------|--------|--------|
| `DispatchDashboardPage` (Dispatch Register — Phase 1 operational shell) | Built, **not routed** | Users see workspace only; no register list at `/dispatch/register` |
| `ProductionWorkspacePage` | Built, **not routed** | Nav label "Production Workspace" points to WO list, not command center |
| `InvoiceDashboardPage` (Invoice Register + receivables) | Built, **not routed** | `/invoices` loops to minimal Finance Workspace; no invoice list |

Fixing route wiring alone yields an estimated **+2 UX points** with zero new UI design.

| Gap category | Items identified | Critical | Important | Nice to Have |
|--------------|------------------|----------|-----------|--------------|
| Missing operational screens | 28 | 8 | 12 | 8 |
| Missing workspace screens | 12 | 3 | 6 | 3 |
| Missing control tower screens | 9 | 2 | 5 | 2 |
| Missing productivity screens | 14 | 2 | 7 | 5 |
| Missing executive dashboards | 10 | 1 | 5 | 4 |
| **Total** | **73** | **16** | **35** | **22** |

**Estimated maturity impact if all Critical + Important gaps closed:** **+7 points → 95/100**

---

## Current Screen Inventory

### Routed today (~95 paths)

| Module | Workspace | Operational registers | Transaction forms | Detail / print | Reports |
|--------|-----------|----------------------|-------------------|----------------|---------|
| Executive | ✅ Command Center | — | — | — | — |
| Masters | ✅ Master Data Hub | 10 master lists | 10 create/edit | 10 detail (+ Product 8-tab) | 5 product |
| Sales | ✅ Sales Workspace | Leads, Inquiries, Quotations, SO, Approvals | Lead/Inquiry forms | Quotation/SO detail | 2 |
| Inventory | ✅ Inventory Workspace | Ledger, Reservations | Inward/Issue/Adj/Opening | Item stock detail | 3 |
| MRP | ⚠️ Dashboard only | Run list (in dashboard) | Run MRP | Run detail | — |
| Purchase | ✅ Purchase Workspace | PR, RFQ, PO, GRN | Manual PR, PO amend | PR/RFQ/PO/GRN detail, PO print | 2 + hub |
| Production | ❌ **No workspace route** | WO list | Create from MRP | WO detail (job cards inline) | 2 |
| Quality | ✅ Quality Workspace | QC Queue, Incoming, NCR, Rework | Inspection detail | NCR detail | 2 + hub |
| Dispatch | ✅ Dispatch Workspace | Plan | — | Dispatch detail, gate pass | 2 + hub |
| Finance | ⚠️ Minimal workspace | ❌ **Invoice register unrouted** | — | Invoice detail | — |
| Costing | — | Costing dashboard | — | WO cost (in WO detail) | — |
| Analytics | ✅ Reports Hub | — | — | — | 18 operational |

### Built but not routed (orphan screens)

- `ProductionWorkspacePage` — production command center with capacity ring + late WO tables
- `DispatchDashboardPage` — Phase 1 operational Dispatch Register (DataGrid + quick view)
- `InvoiceDashboardPage` — invoice register, create-from-dispatch, receivables tab
- Legacy module dashboards: `SalesDashboardPage`, `PurchaseDashboardPage`, `QualityDashboardPage`, `InventoryDashboardPage` (superseded by workspaces but richer in places)
- 8 legacy mock `*Page.tsx` files (unwired dead code)

---

## Benchmark Reference — What Tier-1 ERPs Provide

| Capability area | Dynamics 365 | SAP Business One | SAP S/4 Fiori | Oracle Fusion Mfg | Vasant ERP |
|-----------------|-------------|------------------|---------------|-------------------|------------|
| Role-based launchpad / home | ✅ Workspaces | ✅ Main menu | ✅ Fiori Launchpad | ✅ Redwood home | ⚠️ Module workspaces (partial) |
| Unified workflow inbox | ✅ Power Automate | ⚠️ Limited | ✅ My Inbox | ✅ Approval UI | ❌ Notification panel only |
| Shop floor execution UI | ✅ Production floor | ⚠️ Basic | ✅ SF-MUI / POD | ✅ Shop Floor | ⚠️ Job cards in WO detail |
| Production scheduling board | ✅ Gantt / planning | ⚠️ MRP only | ✅ PP/DS boards | ✅ Planning Central | ❌ MRP list only |
| Supply chain control tower | ✅ SCM Analytics | ❌ | ✅ IBP / Monitor | ✅ OTBI dashboards | ❌ |
| Manufacturing OEE / monitor | ✅ Real-time | ❌ | ✅ Monitor Production | ✅ Supervisor Workbench | ⚠️ Capacity % only |
| Mobile warehouse | ✅ WMS app | ⚠️ | ✅ Fiori mobile | ✅ Mobile INV | ❌ |
| AR / AP / GL workspaces | ✅ Full finance | ✅ Full | ✅ FI tiles | ✅ Financials | ⚠️ Invoice + payment only |
| CRM pipeline | ✅ Sales Hub | ✅ CRM | ✅ C4C integration | ✅ CRM | ✅ Sales pipeline |
| Quality workbench | ✅ | ⚠️ | ✅ QM notifications | ✅ Quality Mgmt | ✅ QC + NCR |
| Global search | ✅ | ✅ | ✅ Fiori search | ✅ | ✅ GlobalSearch (basic) |
| Embedded BI | ✅ Power BI | ⚠️ | ✅ SAC / embedded | ✅ OTBI | ⚠️ Recharts in workspaces |
| Document print center | ✅ | ✅ | ✅ Output mgmt | ✅ | ⚠️ PO print, gate pass, invoice |

---

## 1. Missing Operational Screens

Screens users perform daily transactions on — lists, forms, registers.

| # | Screen | Benchmark source | Vasant status | Priority | UX impact |
|---|--------|------------------|---------------|----------|-----------|
| 1 | **Dispatch Register** (routed list) | D365 Transfer orders · SAP Outbound delivery list | Built (`DispatchDashboardPage`) but **not routed** | **Critical** | +1.0 |
| 2 | **Invoice Register** + receivables list | All four — AR invoice list | Built (`InvoiceDashboardPage`) but **not routed** | **Critical** | +1.0 |
| 3 | **Shop Floor Job Queue** (by work center) | D365 Production floor · Fiori Monitor Production · Oracle Supervisor Workbench | Job cards buried in WO detail | **Critical** | +1.2 |
| 4 | **GRN Register** (operational shell) | SAP GRPO · D365 Product receipt | Exists — legacy `erp-table` | **Critical** | +0.5 |
| 5 | **PR / RFQ registers** (operational shell) | All — purchase requisition list | Legacy PageHeader pattern | **Critical** | +0.4 |
| 6 | **Payment Receipt Register** | SAP Incoming payment · D365 Customer payment | Payment on invoice detail only | **Critical** | +0.5 |
| 7 | **AR Aging / Collections** | All finance modules | No screen | **Critical** | +0.6 |
| 8 | **Inter-warehouse Transfer** | D365 Transfer order · SAP Stock transport | No screen | **Critical** | +0.5 |
| 9 | **Physical Inventory / Cycle Count** | All WMS modules | No screen | Important | +0.4 |
| 10 | **Subcontract Challan Register** | SAP Subcontracting · D365 Vendor collaboration | Partial in WO detail | Important | +0.3 |
| 11 | **Material Traceability / Genealogy** | Oracle Lot genealogy · SAP Batch where-used | Data in ledger; no trace UI | Important | +0.5 |
| 12 | **Engineering Change Order (ECO) Register** | PLM integration in all tier-1 | Product revision only | Important | +0.4 |
| 13 | **Vendor Performance Scorecard** | D365 Vendor analytics · SAP Supplier eval | Report data only | Important | +0.3 |
| 14 | **Capacity / Finite Schedule Board** | SAP PP/DS · Oracle Planning Central | No screen | Important | +0.8 |
| 15 | **Maintenance Work Orders** | SAP PM · D365 Asset management | No module | Important | +0.4 |
| 16 | **Return Material Authorization (RMA)** | All CRM/quality | No screen | Important | +0.3 |
| 17 | **Credit / Debit Note Register** | GST compliance screens | No screen | Important | +0.4 |
| 18 | **Gate Entry / Weighbridge Log** | Indian manufacturing practice | Gate pass print only | Important | +0.3 |
| 19 | **Label / Barcode Print Station** | Shop floor standard | No screen | Important | +0.4 |
| 20 | **Customer 360 / Account view** | D365 Account · SAP BP | Customer master detail only | Important | +0.3 |
| 21 | **Quotation comparison / revision diff** | SAP SD · D365 CPQ | Revision chain on detail | Nice to Have | +0.2 |
| 22 | **Blanket PO / Schedule agreements** | SAP SA · D365 | No screen | Nice to Have | +0.2 |
| 23 | **Consignment inventory** | SAP · Oracle | No screen | Nice to Have | +0.1 |
| 24 | **Tooling / fixture register** | Oracle MES | No screen | Nice to Have | +0.2 |
| 25 | **Calibration register** (QC instruments) | SAP QM · ISO audit | No screen | Nice to Have | +0.2 |
| 26 | **Expense / petty cash** | SAP B1 | No screen | Nice to Have | +0.1 |
| 27 | **HR / shift roster** (for shop floor) | All plant systems | No screen | Nice to Have | +0.2 |
| 28 | **Customer portal order status** | D365 Customer portal | No screen | Nice to Have | +0.3 |

---

## 2. Missing Workspace Screens

Module landing pages that orient users — KPIs, queues, quick actions, exception highlights. Pattern: **Workspace → Register → Document**.

| # | Workspace | Benchmark | Vasant status | Priority | UX impact |
|---|-----------|-----------|---------------|----------|-----------|
| 1 | **Production Command Center** (routed) | Fiori Production · D365 Production control | Built, **not routed** (`/work-orders` = list) | **Critical** | +0.8 |
| 2 | **Planning Workspace** (MRP + capacity + shortages) | SAP MRP Live cockpit · D365 Master planning | MRP dashboard only (StatCard + tables) | **Critical** | +0.7 |
| 3 | **Engineering Workspace** (BOM + routing + ECO) | SAP PLM · Oracle PDH | Scattered across Master Data | **Critical** | +0.5 |
| 4 | **Finance Workspace** (full — not invoice stub) | All ERP finance hubs | 4 KPIs + 2 quick actions | Important | +0.6 |
| 5 | **Subcontractor Workspace** | SAP Subcon monitor | Subcontract in WO detail only | Important | +0.4 |
| 6 | **Inventory Ops Workspace** upgrade | D365 Warehouse management hub | KPIWidget + raw tables | Important | +0.4 |
| 7 | **Procurement Workspace** upgrade | SAP MM analytics | Good base — needs exception queue widget | Important | +0.3 |
| 8 | **Sales Workspace** upgrade | D365 Sales Hub | Pipeline KPIs only — no funnel chart / forecast | Important | +0.4 |
| 9 | **Costing Workspace** | SAP Product cost collector | Single dashboard page | Important | +0.3 |
| 10 | **My Work / Unified Inbox** | Fiori My Inbox · D365 Approvals | Notification bell only | Important | +0.8 |
| 11 | **Admin / Settings Workspace** | All ERPs | No screen (settings in code only) | Nice to Have | +0.2 |
| 12 | **Compliance / Audit Workspace** | SAP GRC | Audit spec doc only | Nice to Have | +0.2 |

### Workspace maturity vs benchmarks

```
Enterprise pattern:  Workspace → Insights → Exception queues → Quick actions → Registers

Vasant today:
  Executive     ████████░░  80%  (good KPIs; mock trend data)
  Sales         ██████░░░░  60%  (KPIs + actions; no pipeline viz)
  Inventory     ██████░░░░  60%  (raw tables in workspace)
  Purchase      ███████░░░  70%  (command bar + PR table)
  Production    ██░░░░░░░░  20%  (screen exists, not routed)
  Quality       ███████░░░  70%  (chart + actions)
  Dispatch      ███████░░░  70%  (timeline + actions; register orphaned)
  Finance       ███░░░░░░░  30%  (stub; invoice register unrouted)
  Planning/MRP  ████░░░░░░  40%  (dashboard, not workspace)
```

---

## 3. Missing Control Tower Screens

Cross-module exception monitoring — what tier-1 calls "situation handling" or "control tower".

| # | Control tower | Benchmark | Purpose | Priority | UX impact |
|---|---------------|-----------|---------|----------|-----------|
| 1 | **Manufacturing Control Tower** | SAP Digital Manufacturing · D365 Supply Chain | Real-time WO, WIP, QC hold, bottleneck map | **Critical** | +1.0 |
| 2 | **Order Fulfillment Tower** (SO → FG → dispatch promise) | Oracle Order Management · D365 Order promising | OTIF, late SO, at-risk deliveries | **Critical** | +0.8 |
| 3 | **Supply Chain Exception Hub** | SAP IBP · D365 VMI | Material shortages, delayed PO, supplier risk | Important | +0.7 |
| 4 | **Quality Situation Board** | SAP QM notification monitor | NCR + rework + incoming reject heatmap | Important | +0.4 |
| 5 | **Dispatch / Logistics Tower** | Oracle TMS · D365 Transportation | Fleet, LR, POD, e-way bill exceptions | Important | +0.4 |
| 6 | **Inventory Health Tower** | All WMS | Negative stock, aging, slow movers in one view | Important | +0.5 |
| 7 | **Cash / Receivables Tower** | SAP FI-AR | Outstanding, overdue, collection actions | Important | +0.5 |
| 8 | **Plant OEE Dashboard** | Oracle MES · SAP MII | Availability, performance, quality by work center | Nice to Have | +0.6 |
| 9 | **Energy / utility monitor** | Smart factory add-on | Not in scope for trailer ERP | Nice to Have | +0.1 |

---

## 4. Missing Productivity Screens

Features that reduce clicks and speed daily work — Fiori "intent-based navigation", D365 quick create, Oracle voice/barcode.

| # | Productivity surface | Benchmark | Vasant status | Priority | UX impact |
|---|---------------------|-----------|---------------|----------|-----------|
| 1 | **Shop Floor Tablet UI** (large touch, scan-first) | All manufacturing ERPs | Desktop-only forms | **Critical** | +1.0 |
| 2 | **Global command palette** (⌘K actions + navigate + create) | Fiori search · VS Code pattern | GlobalSearch (nav only) | **Critical** | +0.6 |
| 3 | **Bulk actions on all DataGrids** | Standard enterprise grids | Partial (PO row select) | Important | +0.4 |
| 4 | **Saved views persistence** (user-level filter presets) | All modern ERPs | SmartFilterBar UI-only | Important | +0.5 |
| 5 | **Personal "My Recent Documents" panel** | Fiori recently used | Sidebar recent (partial) | Important | +0.3 |
| 6 | **Role-based home / launchpad** | Fiori Launchpad · D365 role centers | Same home for all users | Important | +0.6 |
| 7 | **Keyboard shortcut map** | Power-user standard | None documented | Important | +0.2 |
| 8 | **Quick create menu** (global + contextual) | D365 "+" menu | Per-page command bars | Important | +0.3 |
| 9 | **Document attachment hub** | All ERPs | Per-entity attachments only | Important | +0.3 |
| 10 | **Print / output center** | SAP Output management | Scattered print routes | Important | +0.4 |
| 11 | **Mobile-responsive warehouse flows** | RF scanning | Desktop forms | Nice to Have | +0.5 |
| 12 | **Offline / sync indicator** | Shop floor reality | None | Nice to Have | +0.2 |
| 13 | **AI copilot / natural language query** | D365 Copilot · SAP Joule | None | Nice to Have | +0.4 |
| 14 | **Personal task list / to-do** | My Inbox tasks | None | Nice to Have | +0.3 |

---

## 5. Missing Executive Dashboards

C-suite and functional leader views — beyond the operational Command Center.

| # | Dashboard | Audience | Benchmark | Vasant status | Priority | UX impact |
|---|-----------|----------|-----------|---------------|----------|-----------|
| 1 | **CFO Financial Dashboard** | CFO | D365 CFO · SAP FI analytics | None | **Critical** | +0.7 |
| 2 | **COO Operations Dashboard** | COO | Oracle OTIF · SAP PP analytics | Partial (Executive CC) | Important | +0.6 |
| 3 | **Plant Manager Live Board** | Plant head | Shop floor TV boards | None | Important | +0.5 |
| 4 | **Sales Forecast vs Plan** | Sales director | D365 Forecasting | Pipeline value only | Important | +0.4 |
| 5 | **Margin / Profitability by Product** | GM | Oracle profitability | Costing module partial | Important | +0.5 |
| 6 | **Vendor / Procurement Analytics** | Procurement head | SAP MM analytics | Purchase reports only | Important | +0.3 |
| 7 | **Quality Executive Scorecard** | Quality head | SAP QM analytics | Quality workspace chart | Important | +0.3 |
| 8 | **On-Time In-Full (OTIF) Dashboard** | Customer service | All SCM | Delivery commitments report only | Nice to Have | +0.4 |
| 9 | **Safety / compliance KPI board** | EHS | ISO dashboards | None | Nice to Have | +0.2 |
| 10 | **Board pack / PDF export bundle** | Board | Embedded BI export | Manual per report | Nice to Have | +0.3 |

### Executive Command Center — current vs target

| Element | Today | Tier-1 standard | Gap |
|---------|-------|-------------------|-----|
| KPI strip | 8 KPIWidgets | Role-configurable scorecards | Important |
| Trend charts | Static seed data (4 weeks) | Live from ledger | Critical |
| Exception drill-down | Attention list (6 items) | Situation handling with actions | Important |
| Cross-module timeline | Activity feed (5 items) | Full audit + transaction stream | Important |
| Drill to register | Click KPI → module | Click KPI → filtered register | ✅ Partial |
| Mobile / TV mode | No | Plant floor displays | Nice to Have |

---

## Priority Summary

### Critical (16 items) — blocks enterprise parity

**Route wiring (zero design — ship immediately):**
1. Route `DispatchDashboardPage` → `/dispatch/register`
2. Route `ProductionWorkspacePage` → `/production` (move WO list → `/work-orders/list` or keep `/work-orders`)
3. Route `InvoiceDashboardPage` → `/invoices/register` or replace Finance Workspace content

**Operational:**
4. Shop Floor Job Queue screen
5. GRN / PR / RFQ operational shell conversion
6. Payment receipt register
7. AR aging screen
8. Inter-warehouse transfer

**Workspace / tower:**
9. Production workspace (route + upgrade)
10. Planning workspace
11. Engineering workspace
12. Manufacturing control tower
13. Order fulfillment tower

**Productivity / executive:**
14. Shop floor tablet UI
15. Global command palette (actions + create)
16. CFO financial dashboard

**Estimated impact: +5.5 UX points**

### Important (35 items) — expected in mature ERP

Covers workspace upgrades, remaining operational registers, control towers, productivity patterns, and functional executive dashboards.

**Estimated impact: +2.0 UX points** (cumulative with Critical → ~95/100)

### Nice to Have (22 items) — differentiators, not blockers

Mobile offline, AI copilot, OEE, customer portal, blanket PO, etc.

**Estimated impact: +1.5 UX points** (beyond 95 target)

---

## UX Maturity Impact Model

| Score band | Meaning | Screen characteristics |
|------------|---------|------------------------|
| 79 | Pre-Phase 1 | Mixed layouts, raw tables, KPIWidget sprawl |
| 88 | **Current** | Operational shell on major lists; workspaces exist; orphans unrouted |
| 91 | Phase 2 | All registers routed + operational shell; workspaces upgraded |
| 93 | Phase 3 | Control towers + shop floor queue + planning workspace |
| 95 | **Target** | Role launchpad + exec dashboards + productivity layer complete |
| 98+ | Tier-1 parity | Mobile MES, APS board, embedded BI, workflow inbox |

### Impact by workstream

| Workstream | Effort | UX delta | Notes |
|------------|--------|----------|-------|
| Route orphan screens | 1 day | +2.0 | Highest ROI |
| Phase 2 operational shell (GRN, PR, RFQ, Invoice) | 1 sprint | +1.5 | Reuse existing components |
| Workspace upgrade (PageInsightsStrip, DataGrid, no raw tables) | 1 sprint | +1.0 | No new design |
| Shop floor job queue | 1 sprint | +1.2 | New screen; reuse JobCardPanel |
| Planning + Engineering workspaces | 1 sprint | +0.8 | Compose existing data |
| Control towers (2) | 2 sprints | +1.5 | Cross-module metrics exist |
| Productivity (command palette, saved views, roles) | 1 sprint | +0.8 | Extend uiStore |
| Executive dashboards (CFO + COO) | 1 sprint | +0.7 | Live data from stores |
| **Total to 95** | **~6 sprints** | **+7** | **88 → 95** |

---

## Roadmap to 95/100 ERP UX Maturity

### Phase 2 — Route & Register Completion (Week 1–2) → **91/100**

**Goal:** No orphan screens; all transaction lists use operational shell.

- [ ] Wire routes: Production Workspace, Dispatch Register, Invoice Register
- [ ] Fix nav: separate workspace path from register path per module
- [ ] Convert GRN Register to `OperationalPageShell` + DataGrid + quick view
- [ ] Convert PR List + RFQ List to operational shell
- [ ] Convert Invoice list (route `InvoiceDashboardPage` or merge into shell)
- [ ] Upgrade MRP Dashboard → Planning Workspace (insights strip, no raw tables)
- [ ] Upgrade all module workspaces: replace `KPIWidget` → `PageInsightsStrip`, `erp-table` → `DataGrid`

**Deliverable:** `PHASE2_UI_ROLLOUT_REPORT.md`

---

### Phase 3 — Shop Floor & Productivity (Week 3–4) → **93/100**

**Goal:** Match D365 Production floor / Fiori POD minimum viable experience.

- [ ] **Shop Floor Job Queue** — filter by work center, status, team; start/complete without opening WO detail
- [ ] **Global Command Palette** — ⌘K: navigate, create PR/lead/WO, run actions
- [ ] **Saved views persistence** — localStorage per user per page
- [ ] **Bulk grid actions** — export, status update, assign (where applicable)
- [ ] **Print Center** — single page listing all printable documents
- [ ] Payment receipt register + AR aging (operational shell)

**Deliverable:** Shop floor usable on tablet viewport (responsive, touch targets)

---

### Phase 4 — Control Towers (Week 5–7) → **94/100**

**Goal:** SAP-style situation handling for exceptions.

- [ ] **Manufacturing Control Tower** — WO status map, WIP by warehouse, QC holds, late jobs, capacity heatmap
- [ ] **Order Fulfillment Tower** — SO promise date vs WO/dispatch progress, OTIF risk
- [ ] **Supply Chain Exception Hub** — shortages + delayed PO + incoming QC reject (compose existing metrics)
- [ ] **Unified My Work Inbox** — approvals (PR, PO, quotation, inspection) in one queue with actions

**Deliverable:** `/control-tower` hub with 4 sub-views

---

### Phase 5 — Executive & Role Experience (Week 8–9) → **95/100**

**Goal:** Fiori Launchpad / D365 role center parity for leadership.

- [ ] **Role-based home** — Plant Manager, Procurement, Sales, Finance, Shop Supervisor presets
- [ ] **CFO Dashboard** — revenue, outstanding AR, GST liability, collection forecast (live from invoice store)
- [ ] **COO Dashboard** — OTIF, late WO, capacity, dispatch pipeline, quality FPY
- [ ] **Executive Command Center** — replace mock trend with live 12-week data from stores
- [ ] **Engineering Workspace** — BOM/routing/ECO queue + release pipeline
- [ ] Inter-warehouse transfer operational screen

**Deliverable:** `ERP_UX_MATURITY_95_REPORT.md`

---

### Beyond 95 (Optional — Tier-1 parity track)

| Item | Benchmark | Target score |
|------|-----------|--------------|
| Finite capacity schedule board | SAP PP/DS | 96 |
| Mobile warehouse RF UI | D365 WMS | 97 |
| Embedded BI / Power BI style | D365 | 97 |
| AI copilot (natural language) | D365 Copilot / SAP Joule | 98 |
| Customer / vendor portals | All tier-1 | 98 |
| OEE + machine connectivity | Oracle MES | 99 |

---

## Module Screen Coverage Scorecard

Comparison vs **minimum viable screen set** for discrete manufacturing (benchmark union of four ERPs):

| Module | Screens needed (benchmark) | Vasant has | Coverage | Priority gap |
|--------|---------------------------|------------|----------|--------------|
| Masters | 12 | 12 | 100% | — |
| Sales | 10 | 9 | 90% | Forecast dashboard |
| Inventory | 12 | 8 | 67% | Transfer, cycle count, mobile |
| MRP / Planning | 8 | 3 | 38% | Schedule board, planning workspace |
| Purchase | 10 | 8 | 80% | Vendor scorecard |
| Production | 12 | 5 | 42% | Shop floor queue, workspace route |
| Quality | 10 | 8 | 80% | Calibration, RMA |
| Dispatch | 8 | 6 | 75% | Register route, logistics tower |
| Finance | 10 | 3 | 30% | Invoice route, AR, AP, credit note |
| Costing | 6 | 2 | 33% | Standard cost revision UI |
| Analytics | 15 | 18 | 120% | ✅ Strong (tabular; needs charts) |
| Executive | 8 | 2 | 25% | CFO/COO boards, live trends |
| Productivity | 8 | 2 | 25% | Command palette, roles, tablet |
| **Weighted average** | | | **~58%** | |

*UX maturity (88/100) is higher than screen coverage (58%) because existing screens use a consistent design system and cover the anchor path deeply.*

---

## Immediate Actions (This Week)

1. **Route orphan screens** — 3 path additions in `routes/index.ts` + nav update (~4 hours)
2. **Dispatch workspace** — link "Dispatch Register" → `/dispatch/register` instead of self-loop
3. **Finance workspace** — link to invoice register, not `/invoices` stub loop
4. **Production nav** — `/production` workspace + `/work-orders` register (match Sales pattern)
5. **Document screen map** — add to `navigation.ts` comment: workspace vs register vs report paths

---

## Appendix — Screen Path Convention (Target)

Align with SAP Fiori / D365 pattern:

```
/{module}                    → Workspace (command center)
/{module}/{entity}           → Register (operational list)
/{module}/{entity}/new       → Create form
/{module}/{entity}/:id       → Detail document
/{module}/{entity}/:id/edit  → Edit form
/control-tower/{view}        → Cross-module exception hub
/reports/{domain}/{report}   → Analytics
/print/{type}/:id            → Print layouts
```

**Example (Dispatch — target state):**

```
/dispatch                    → DispatchWorkspacePage
/dispatch/register           → DispatchDashboardPage (operational list)
/dispatch/plan               → DispatchPlanPage
/dispatch/:id                → DispatchDetailPage
/dispatch/:id/gate-pass      → GatePassPrintPage
```

---

*Generated from live route audit (`src/routes/index.tsx`), navigation config, workspace modules, and Phase 1 UI rollout report. Benchmarks reflect standard discrete manufacturing modules in Dynamics 365 Supply Chain, SAP Business One 10.0, SAP S/4HANA Fiori PP/QM/MM, and Oracle Fusion Manufacturing Cloud (2025/2026 documentation).*
