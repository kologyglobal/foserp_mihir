# Enterprise Readiness Review

**Plant:** Vasant Trailers · Pune  
**Review date:** 23 June 2026  
**Baseline:** Functional flow validated · 307 integration tests · Go-live 9/9 · MRP foundation PASS  
**Scope:** Navigation, workspaces, Entity 360, role-based daily-work coverage (80% rule in ≤3 modules)  
**Method:** Codebase audit — routes, `navigation.ts`, workspaces, control towers, entity360, metrics hooks

---

## Executive Summary

| Dimension | Maturity (1–10) | Status |
|-----------|-----------------|--------|
| Navigation completeness | **8.5** | Strong sidebar + search; no role-based nav |
| Workspace completeness | **7.0** | 10 landing workspaces; some are KPI shells |
| Entity 360 completeness | **6.0** | 5 master 360s done; no transaction 360s |
| Shop-floor readiness | **6.5** | Job queue + WO detail; no WO 360 / tablet UX |
| Executive visibility | **8.0** | Dashboard + inbox; no board export |
| Planner visibility | **8.0** | MRP dashboard + workbench |
| Buyer visibility | **7.0** | Purchase workspace; RFQ/GRN split across modules |
| Quality visibility | **8.0** | Command center + queues |
| Dispatch visibility | **7.5** | Command center + register |
| Traceability visibility | **2.0** | Engine proven in simulation; **no UI** |

**Overall enterprise UX maturity:** **2.4 / 3.0** (Functional+, not yet Enterprise Command Layer)

The ERP is **factory-operable** for the anchor scenario. It is **not yet enterprise-ready** for multi-role daily work without cross-module hopping — especially COO, Store Manager, and Accounts Manager.

---

## 1. Navigation Completeness

### What exists

| Category | Routes | Discovery |
|----------|--------|-----------|
| Executive | `/`, `/inbox` | Sidebar · search · favorites |
| Master Data | 11 entity registers + hub | Full CRUD + 360 on item/vendor/customer/product/BOM |
| Sales | Workspace + 5 registers | Pipeline workspace |
| Inventory | Workspace + 6 txn pages | Ledger, reservations, stock detail |
| Planning | MRP dashboard + workbench + run | Control-tower grade workbench |
| Procurement | Workspace + PR/RFQ/PO/GRN/reports | Purchase workspace |
| Production | Control tower + shop floor + WO + costing | Sidebar “Shop Floor” group |
| Quality | Workspace + 4 queues/registers | Quality command center |
| Logistics | Workspace + register + plan | Dispatch command center |
| Finance | Workspace + invoice register | Thin finance hub |
| Analytics | Reports hub + 18 operational reports | Indexed in nav |

**103 routed screens** (per `SCREEN_DISCOVERY_AUDIT.md`).

### Gaps

| Gap | Priority | UX impact |
|-----|----------|-----------|
| No **Traceability** nav entry (lot/serial, RM→FG chain) | **Critical** | Compliance & recall readiness blocked |
| No **role-based navigation** (CEO vs buyer vs store) | Important | Cognitive load; wrong screens for role |
| **COO Operations** view not in nav (cross-module exception board) | **Critical** | COO opens 5+ modules daily |
| Document 360s (WO/SO/PO) not linked from list row actions as “360 View” | Important | Users don’t discover intelligence layer |
| `ProductionWorkspace` deprecated alias — only Control Tower exposed | Nice | Naming clarity only |
| Finance nav has only 2 items (no AR aging, payments, GST) | Important | Accounts role under-served |

---

## 2. Workspace Completeness

### Workspace inventory

| Workspace | Route | Depth | Role anchor |
|-----------|-------|-------|-------------|
| Executive Dashboard | `/` | Deep — KPIs, chart, attention list | CEO |
| Unified Inbox | `/inbox` | Medium — approvals, tasks, alerts (not role-filtered) | All |
| Master Data Hub | `/masters` | Medium — tiles to registers | Engineering |
| Sales Workspace | `/sales` | Medium — pipeline KPIs + quick actions | Sales |
| Inventory Workspace | `/inventory` | Light — KPIs + low stock + quick actions | Store |
| MRP Dashboard | `/mrp` | Medium — run summary, SO readiness | Planner |
| Purchase Workspace | `/purchase` | **Good** — at-risk PO, recent PR, KPIs | Buyer |
| Production Control Tower | `/production` | **Good** — 6 queues (running/late/QC/shortage/capacity/rework) | Production Mgr / COO |
| Quality Command Center | `/quality` | **Good** — FPY, defect trend, NCR aging | Quality Mgr |
| Dispatch Command Center | `/dispatch` | Medium — schedule timeline, KPIs | Dispatch Mgr |
| Finance Workspace | `/invoices` | **Light** — 4 KPIs + 3 quick actions | Accounts |
| Reports Hub | `/reports` | Medium — 18 report links | Analyst / CEO |

### Missing workspaces

| Missing workspace | Priority | Who needs it |
|-------------------|----------|--------------|
| **COO Operations Dashboard** — exceptions across prod/purchase/quality/dispatch | **Critical** | COO |
| **Store Operations Hub** — inward (GRN), issue, ledger, reservations in one shell | Important | Store Manager |
| **Accounts Receivable Hub** — outstanding, aging, collections, GST summary | Important | Accounts Manager |
| **Traceability Explorer** — search by SO/WO/lot/trailer/chassis | **Critical** | Quality, COO, Compliance |
| **Buyer Inbox** — PR approval + RFQ + delayed PO (subset of unified inbox) | Nice | Purchase Manager |

---

## 3. Entity 360 Completeness

### Shipped (Entity360Shell)

| Entity | Route | Tabs / intelligence |
|--------|-------|---------------------|
| Item | `/masters/items/:id` | Overview, inventory, purchase, consumption, MRP, transactions, timeline |
| Vendor | `/masters/vendors/:id` | Overview, purchase, quality, spend, performance |
| Customer | `/masters/customers/:id` | Overview, sales, dispatch, financial, quality |
| BOM | `/masters/bom/:id` | Structure tree, cost, revision, usage, risk, impact analysis |
| Product | `/masters/products/:id` | Revision, BOM, routing, cost, quality, sales, production, dispatch, warranty |

### Missing 360 pages (high daily-use documents)

| Entity | Priority | Daily users | Why it matters |
|--------|----------|-------------|----------------|
| **Work Order 360** | **Critical** | Production, Quality, COO | Materials, ops, QC, cost, WIP, SA/FG in one place |
| **Sales Order 360** | **Critical** | Sales, COO, Dispatch | Pegging SO→MRP→WO→dispatch→invoice |
| **Purchase Order 360** | Important | Buyer, Store | Lines, GRNs, amendments, vendor score |
| **PR 360** | Important | Buyer | Approval trail, RFQ conversion, MRP peg |
| **GRN 360** | Important | Store, Quality | QC gate, stock impact, PO closure |
| **Dispatch 360** | Important | Dispatch, Sales | Trailer identity, POD, invoice link |
| **Invoice 360** | Important | Accounts | GST, payment, SO/dispatch trace |
| **NCR 360** | Nice | Quality | Investigation, WO/item impact |
| **Routing 360** | Nice | Engineering | WC mapping, WIP path, products using |

**360 coverage score:** 5 / 14 enterprise-critical entities ≈ **36%**

---

## 4. Shop-Floor Readiness

### Strengths

- **Production Control Tower** — running/late/QC hold/shortage/capacity/rework queues
- **Shop Floor Job Queue** — team filter, start/pause/complete, inline QC checklist
- **Work Order Detail** — materials, job cards, WIP flow, costing panel, QC tab
- Job cards linked from inbox tasks

### Gaps

| Gap | Priority | UX impact |
|-----|----------|-----------|
| No **WO 360** — WO detail is deep but not unified intelligence workspace | **Critical** | Supervisors open WO + QC + inventory separately |
| No **tablet / large-touch** layout for shop floor | Important | Desktop-first UX on floor |
| No **barcode / scan** entry for issue/receipt | Important | Store & floor speed |
| Subcontract send/receive not in shop-floor queue | Important | Paint/subcon WOs need WO detail hop |
| No **shift / crew dashboard** (today’s plan by work center) | Important | Foreman visibility |
| Material issue not actionable from control tower | Nice | Shortage queue links out but no inline issue |

**Shop-floor readiness:** Operable for demo WO flow; **not yet enterprise shop-floor UX**.

---

## 5–10. Visibility by Function

### 5. Executive visibility — **8/10**

**Screens:** Executive Dashboard (`/`), Unified Inbox, Reports Hub, notification bell.

**KPIs:** Order book, revenue, WIP, FG value, open NCR, delayed orders, capacity chart, attention feed.

**Gaps:** No period comparison, no plant/line drill-down, no PDF board pack, no margin vs cost bridge on dashboard.

---

### 6. Planner visibility — **8/10**

**Screens:** MRP Dashboard, **MRP Planner Workbench** (shortages, late supply, expedite, reschedule, at-risk), MRP run detail.

**Strengths:** Best-in-class for this ERP — workbench matches enterprise MRP planner pattern.

**Gaps:** No finite capacity view, no pegging tree SO→WO→PR→PO visual, reschedule is re-run MRP not Gantt drag.

---

### 7. Buyer visibility — **7/10**

**Screens:** Purchase Workspace, PR/RFQ/PO registers, GRN register, purchase reports, **Vendor 360**.

**Strengths:** At-risk PO heatmap, pending PR, expected deliveries.

**Gaps:** RFQ comparison lives on RFQ detail (4th module), GRN is separate module from buyer workspace, no dedicated buyer inbox filter, Vendor 360 not linked from workspace KPIs.

---

### 8. Quality visibility — **8/10**

**Screens:** Quality Command Center, QC Queue, Incoming QC, Rework Workbench, NCR Register, quality reports.

**Strengths:** FPY, defect trend, NCR aging KPIs; inspection detail routed.

**Gaps:** Vendor quality in reports not workspace; no batch/lot trace UI; no NCR 360.

---

### 9. Dispatch visibility — **7.5/10**

**Screens:** Dispatch Command Center, Dispatch Register (OperationalPageShell), Dispatch Plan, dispatch reports.

**Strengths:** Ready/loading/dispatched/POD KPIs; schedule timeline; gate pass print.

**Gaps:** POD → invoice still hops to Finance; no dispatch 360; no transporter performance view.

---

### 10. Traceability visibility — **2/10**

**Backend:** Go-live simulation validates **RM → SA → FG** with 18 pegged movements (`test:go-live` check #9).

**Frontend:** **No traceability screen, route, or nav item.** No search by trailer no, chassis, GRN lot, or WO peg chain.

| Priority | Gap |
|----------|-----|
| **Critical** | Traceability Explorer workspace |
| **Critical** | Item 360 → “Where used / pegged to” deep link from ledger |
| Important | SO 360 pegging tree |
| Important | Export trace report for customer audit |

---

## Role Assessment — 80% Daily Work in ≤3 Modules?

**Rule:** Can this person complete ~80% of typical daily tasks without opening more than **3 top-level modules** (workspace / control tower / register groups)?

| Role | Pass? | Ideal 3-module home | Modules actually needed | Gap |
|------|-------|---------------------|-------------------------|-----|
| **CEO** | ✅ **Yes** | Executive Dashboard · Unified Inbox · Reports | `/` · `/inbox` · `/reports` | Board export, comparative KPIs |
| **COO** | ❌ **No** | COO Ops · Production Tower · Unified Inbox | `/` · `/production` · `/mrp/workbench` · `/quality` · `/purchase` · `/dispatch` | **Missing COO dashboard** — 5–6 modules for exception triage |
| **Production Manager** | ✅ **Yes** (borderline) | Production Tower · Shop Floor · Work Orders | `/production` · `/shop-floor` · `/work-orders` | WO 360; subcon in 4th (WO detail) |
| **Purchase Manager** | ✅ **Yes** (borderline) | Purchase WS · Requisitions · PO Register | `/purchase` · `/purchase/requisitions` · `/purchase/orders` | RFQ + GRN often 4th–5th; Vendor 360 discovery |
| **Store Manager** | ❌ **No** | Store Ops Hub · Stock Ledger · Material Issue | `/inventory` · `/inventory/ledger` · `/inventory/issue` · **`/purchase/grns`** | **GRN in Procurement module**; no store-centric hub |
| **Quality Manager** | ✅ **Yes** | Quality WS · QC Queue · NCR Register | `/quality` · `/quality/queue` · `/quality/ncr` | Vendor quality → reports (4th) |
| **Dispatch Manager** | ✅ **Yes** | Dispatch WS · Register · Plan | `/dispatch` · `/dispatch/register` · `/dispatch/plan` | Invoice/POD completion → Finance (4th) |
| **Accounts Manager** | ❌ **No** | AR Hub · Invoice Register · Customer 360 | `/invoices` · `/invoices/register` · **`/masters/customers/:id`** · **`/reports`** | **Thin finance workspace**; no AR aging, payment register, GST hub |

### Role pass summary

| Result | Count | Roles |
|--------|-------|-------|
| ✅ Pass | 5 | CEO, Production Mgr, Purchase Mgr, Quality Mgr, Dispatch Mgr |
| ❌ Fail | 3 | **COO, Store Manager, Accounts Manager** |

---

## Gap Backlog (Classified)

### Critical — blocks enterprise daily-work promise

| # | Gap | Affects | Est. UX maturity lift |
|---|-----|---------|------------------------|
| C1 | **Traceability Explorer** workspace + nav | COO, Quality, Compliance, Customer audits | +0.3 overall |
| C2 | **COO Operations Dashboard** (cross-module exception board) | COO | +0.2 overall |
| C3 | **Work Order 360** | Production Mgr, COO, Quality | +0.15 overall |
| C4 | **Sales Order 360** (SO→MRP→WO→dispatch→invoice pegging) | Sales, COO, Dispatch | +0.15 overall |
| C5 | **Store Operations Hub** (GRN + inward + issue + ledger unified) | Store Manager | +0.1 overall |
| C6 | **Role-filtered Unified Inbox** (or role inbox presets) | All managers | +0.1 overall |

### Important — significant friction, not blocking anchor scenario

| # | Gap | Affects | Est. UX maturity lift |
|---|-----|---------|------------------------|
| I1 | **Accounts Receivable Hub** (aging, collections, GST summary) | Accounts Manager | +0.1 overall |
| I2 | **Purchase Order 360** + **GRN 360** | Buyer, Store | +0.08 overall |
| I3 | **Dispatch 360** + POD→invoice inline | Dispatch, Accounts | +0.05 overall |
| I4 | List row actions labeled **“360 View”** on masters + documents | Discovery | +0.05 overall |
| I5 | **Buyer Inbox** preset (PR + delayed PO + RFQ pending) | Purchase Mgr | +0.05 overall |
| I6 | Shop-floor **tablet layout** + work-center shift board | Production | +0.08 overall |
| I7 | Executive **board export** (PDF/Excel snapshot) | CEO | +0.03 overall |
| I8 | **Vendor 360** linked from Purchase Workspace KPIs | Purchase Mgr | +0.03 overall |

### Nice to Have — polish & engineering depth

| # | Gap | Affects |
|---|-----|---------|
| N1 | NCR 360, Invoice 360, PR 360, Routing 360 | Quality, Accounts, Buyer, Engineering |
| N2 | Barcode scan on issue/GRN | Store |
| N3 | Finite capacity planner view | Planner |
| N4 | Role-based sidebar (hide irrelevant modules) | All |
| N5 | Customer 360 linked from Finance outstanding list | Accounts |
| N6 | Pegging Gantt / visual tree on MRP workbench | Planner |

---

## Recommended Build Order (Enterprise Layer)

Aligns with prior 360 rollout + this review:

```
Phase E1 (Critical path — 3 roles unblocked)
  1. COO Operations Dashboard
  2. Store Operations Hub
  3. Accounts Receivable Hub
  4. Traceability Explorer

Phase E2 (360 expansion — operations)
  5. Work Order 360
  6. Sales Order 360

Phase E3 (360 expansion — supply chain + logistics)
  7. Purchase Order 360
  8. GRN 360
  9. Dispatch 360

Phase E4 (Inbox & discovery)
  10. Role inbox presets
  11. 360 View labels on all list pages
```

---

## UX Maturity Impact Estimate

| Milestone | Current | After E1 | After E1+E2 | After full E1–E4 |
|-----------|---------|----------|-------------|------------------|
| Overall UX score | **2.4** | **2.7** | **2.9** | **3.1** (Enterprise) |
| Roles passing 80%/3-module rule | **5 / 8** | **8 / 8** | **8 / 8** | **8 / 8** |
| 360 entity coverage | 36% | 36% | **64%** | **86%** |
| Traceability visibility | 2/10 | **7/10** | 7/10 | **8/10** |

*Scores are relative to the 0–3 module audit scale used in `ERP_PERFECTION_AUDIT.md`, extended for enterprise command-layer criteria.*

---

## Conclusion

**Functional readiness:** Proven (307 tests, go-live, MRP foundation).  
**Enterprise readiness:** **Partial** — strong executive, planner, quality, and production command layers; weak traceability, COO consolidation, store-centric UX, and finance depth.

**Three roles fail the 80%-in-3-modules test today:** COO, Store Manager, Accounts Manager. Closing **Phase E1** (4 screens) addresses all three without new business logic — mostly aggregation, navigation, and workspace shells on existing stores.

**Highest ROI next builds:**

1. Traceability Explorer (compliance + customer trust)  
2. Work Order 360 (production nerve center)  
3. COO Operations Dashboard (single pane for plant health)  
4. Store Operations Hub (GRN + stock in one module)

---

*Generated from live codebase audit — routes, `navigation.ts`, workspaces, control towers, entity360, `controlTowerMetrics.ts`, `workspaceMetrics.ts`.*
