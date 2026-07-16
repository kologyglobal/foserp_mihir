# ERP Factory Go-Live Roadmap

**Document type:** Master deployment roadmap  
**Plant:** Vasant Trailers · Pune  
**Product:** 45 M³ Bulker Trailer (anchor) · ISO Tank · Side Wall (future)  
**Status:** **Prototype validated — factory go-live blocked**  
**Last updated:** June 2026  
**Anchor scenario:** ABC Cement · SO-0001 · 2× 45 M³ Bulker

---

## 1. Executive Summary

The ERP can execute a **complete manufacturing and fulfillment cycle** end-to-end in a controlled simulation:

```text
Sales Order → MRP → PR → PO → GRN → Work Orders → Issue → Operations → QC
  → SA/FG Receipt → Cost Rollup → Dispatch → Tax Invoice → Payment → SO Closed
```

**Simulation result:** ✅ **9/9 verifications passed** · 58 timeline events · avg module score **2.2 / 3.0**

**Factory go-live verdict:** ❌ **Not ready for unattended production**

The application is suitable today for a **desk pilot** (planners replay SO-0001 class orders). Production go-live requires **server database**, **authentication**, **audit trail**, **commercial order entry**, and **cost master calibration** — in that dependency order.

| Horizon | Scope | Status |
|---------|-------|--------|
| **H0 — Desk pilot** | MRP → Production → Costing → Dispatch → Invoice on seeded SO | ✅ Ready now |
| **H1 — Shop pilot** | Job cards + QC on 1 bay, 1 product line | ⚠️ Needs login + tablet UI |
| **H2 — Commercial pilot** | Live SO entry, no seed dependency | ❌ Sales module incomplete |
| **H3 — Factory go-live** | Multi-user, server DB, audit, calibrated costing | ❌ Blocked — see §4 |

---

## 2. Definition of Factory Ready

Factory go-live is achieved when **all** of the following are true:

| # | Criterion | Measure |
|---|-----------|---------|
| G1 | **Server source of truth** | PostgreSQL; no transactional data in `localStorage` |
| G2 | **Multi-user + RBAC** | JWT auth; 9 roles enforced per [`ERP_RBAC_PERMISSIONS.md`](./ERP_RBAC_PERMISSIONS.md) |
| G3 | **Audit trail** | Created/Modified/Approved on every transaction + `sys.audit_log` per [`ERP_AUDIT_TRAIL.md`](./ERP_AUDIT_TRAIL.md) |
| G4 | **Live commercial intake** | SO create/confirm without seed; optional Lead → Inquiry → Quotation |
| G5 | **Cost trust** | FG variance vs **released standard cost** < **10%** per [`ERP_COST_CALIBRATION.md`](./ERP_COST_CALIBRATION.md) |
| G6 | **Negative stock prevention** | Issue blocked when free qty insufficient (no simulation top-ups) |
| G7 | **Parity test** | `npm run simulate:go-live` passes against **API**, not localStorage |
| G8 | **Shop floor operable** | Material issue + job card + QC usable on tablet at 1 bay minimum |
| G9 | **Dispatch + compliance** | Tax invoice PDF/archive; dispatch challan retained server-side |
| G10 | **Runbook + training** | Role-based SOPs; rollback plan; backup/restore tested |

---

## 3. Current State (June 2026)

### 3.1 Module readiness

| Module | Score | Rating | Notes |
|--------|-------|--------|-------|
| Inventory | 3 | Production Ready | Ledger reconcile · reservations · SA/FG · dispatch issue |
| MRP | 3 | Production Ready | Explosion · pegging · auto-reserve |
| Production | 3 | Production Ready | Per-SA WOs · routing · job cards · subcontract · FG receipt |
| Purchase | 2 | Functional | PR → PO → GRN; no incoming QC hold |
| Quality | 2 | Functional | Op QC + rework; no incoming/NCR in sim path |
| Costing | 2 | Functional | Roll-up works; **52.8% vs BOM** (baseline issue — see calibration) |
| Dispatch | 2 | Functional | Checklist · trailer/chassis · transport · POD |
| Traceability | 2 | Functional | Pegged movements; no serial/lot enforcement |
| Sales | 1 | Prototype | Seed-only SO; no CRUD; no commercial pipeline |

*Source: [`ERP_GO_LIVE_READINESS.md`](./ERP_GO_LIVE_READINESS.md)*

### 3.2 Validated end-to-end flow

```text
SO-0001 (seed)
  → MRP-0001 → PR-0002 → 3 POs → 3 GRNs
  → 5 Work Orders (Tank · Chassis · Run Gear · Paint · FG)
  → Material issue → Operations → QC rework (Tank welding)
  → SA receipts → FG receipt → Cost rollup
  → Dispatch DC-0001 → INV-2026-0001 (₹67,26,000) → Payment → SO closed
```

*Source: [`GO_LIVE_SIMULATION_REPORT.md`](./GO_LIVE_SIMULATION_REPORT.md)*

### 3.3 Automated test gate (run before any release)

| Command | Checks | Current |
|---------|--------|---------|
| `npm run simulate:go-live` | Full E2E + readiness + cost calibration | 9/9 pass |
| `npm run test:wo-flow` | WO lifecycle | 60/60 |
| `npm run test:dispatch` | Dispatch + POD | 13/13 |
| `npm run test:invoice` | GST invoice | 18/18 |
| `npm run test:costing` | Cost engine | 18/18 |
| `npm run test:quality` | QC + rework | — |

---

## 4. Critical Blockers (Must Clear Before H3)

| Priority | Blocker | Impact | Resolution workstream | Target phase |
|----------|---------|--------|----------------------|--------------|
| **P0** | No backend database (`localStorage` only) | Data loss, single-user | Platform — [`ERP_BACKEND_MIGRATION_PLAN.md`](./ERP_BACKEND_MIGRATION_PLAN.md) | Phase 0–10 |
| **P0** | No authentication / RBAC | No accountability | Platform — [`ERP_RBAC_PERMISSIONS.md`](./ERP_RBAC_PERMISSIONS.md) | Phase 0 |
| **P0** | Audit trail not trustworthy | Compliance failure | Platform — [`ERP_AUDIT_TRAIL.md`](./ERP_AUDIT_TRAIL.md) | Phase 0 + all APIs |
| **P0** | Sales order requires seed data | Cannot take live orders | Commercial | Phase 4 + frontend |
| **P1** | Cost variance metric misleading (52.8% vs material-only BOM) | Wrong management decisions | Costing calibration | Phase 8 + pre-go-live |
| **P1** | Chassis BOM incomplete (missing structural RM) | MRP/cost wrong for chassis | Engineering master data | Phase 2 |
| **P1** | Subcontract cost double-count (paint WO) | Inflated actual cost | Cost engine fix | Phase 8 |
| **P2** | No barcode / gate scanner | Shop friction | Shop floor | Phase 11 |
| **P2** | No ECO workflow | Engineering change risk | Engineering | Post go-live |
| **P2** | Invoice PDF server archive | Finance compliance | Dispatch/Accounts | Phase 9 |

---

## 5. Roadmap Overview

```text
2026 Q3          Q4              2027 Q1           Q2
─────────────────────────────────────────────────────────────
│ Phase 0–3 │ Phase 4–6 │ Phase 7–9 │ Phase 10–11 │
│ Platform  │ Core txn  │ Fulfill   │ Cutover +   │
│ Auth+DB   │ MRP+Prod  │ QC+Cost   │ Pilot       │
─────────────────────────────────────────────────────────────
     ▲              ▲           ▲            ▲
   H0 desk      H2 commercial  H1 shop    H3 factory
   pilot OK     pilot target   pilot      go-live
```

**Estimated duration:** ~32 weeks backend + parallel frontend/calibration work  
**Critical path:** Phase 0 → 3 (ledger) → 6 (work orders) → 10 (cutover)

---

## 6. Phased Plan

### Phase A — Stabilize Prototype (Now → 4 weeks)

**Goal:** Fix known engine/master-data defects while backend planning is approved.

| # | Task | Owner | Exit criteria |
|---|------|-------|---------------|
| A1 | Fix subcontract material double-count in `costEngine.ts` | Dev | WO-0004 actual ≈ planned (±10%) |
| A2 | Add chassis structural RM to BOM Rev-A (or Rev-B) | Engineering | WO-0002 BOM std includes fabrication RM |
| A3 | Define **released standard cost** formula + type fields | Costing / Eng | Spec in costing types; not yet in UI |
| A4 | Add audit strip component (mock user until auth) | Dev | Detail pages show Created/Modified placeholders |
| A5 | SO list + create/confirm UI (API-agnostic, localStorage) | Dev | New SO without seed edit |
| A6 | Re-run simulation; update readiness report | QA | All test scripts green |

**Gate A:** Cost calibration report shows FG variance vs **released standard** (once implemented) trending toward < 15%; no P1 engine bugs open.

---

### Phase B — Platform Foundation (Weeks 1–9)

**Goal:** PostgreSQL + NestJS + Auth + Inventory ledger.  
*Maps to backend plan Phase 0–3.*

| # | Deliverable | Reference |
|---|-------------|-----------|
| B1 | NestJS monorepo, Prisma, PostgreSQL 16, Docker compose | Migration plan §Phase 0 |
| B2 | `sys.users`, JWT, RBAC guards, permission matrix | RBAC doc |
| B3 | `sys.audit_log` + audit interceptor on all mutations | Audit trail doc |
| B4 | Master data API (items, products, customers, vendors, warehouses) | Migration plan §Phase 1 |
| B5 | BOM + Routing API with approval/release gates | Migration plan §Phase 2 |
| B6 | Inventory ledger API (`inv.stock_movements`, reservations) | Migration plan §Phase 3 |
| B7 | Seed migration from TS seeds → SQL | `src/data/**/seed.ts` |

**Gate B:** On-hand from API matches ledger; 2 concurrent users cannot corrupt stock; audit_log records GRN post with real user.

---

### Phase C — Core Manufacturing (Weeks 9–20)

**Goal:** Live order → material → production on server DB.  
*Maps to backend plan Phase 4–6.*

| # | Deliverable | Reference |
|---|-------------|-----------|
| C1 | Sales Order CRUD + confirm + status machine | Gap analysis §Sales |
| C2 | MRP run API (explosion, shortage, WO reqs, pegging) | `mrpEngine.ts` |
| C3 | Purchase PR → RFQ → PO → GRN with audit | `purchaseStore` |
| C4 | Work Order full lifecycle (per-SA mode anchor) | `workOrderEngine.ts` |
| C5 | Job cards, routing ops, QC hold integration | WO flow tests |
| C6 | SA receipt + FG receipt + WIP transfers | Inventory ledger |
| C7 | Negative stock enforcement at issue | Blocker P0/G6 |

**Gate C:** API-driven replay of SO-0001 simulation — same 9 verifications without localStorage.

---

### Phase D — Quality, Costing, Fulfillment (Weeks 20–25)

**Goal:** Trustworthy costs + ship + bill.  
*Maps to backend plan Phase 7–9.*

| # | Deliverable | Reference |
|---|-------------|-----------|
| D1 | QC inspections, rework, NCR API | `qualityEngine.ts` |
| D2 | Released standard cost on product at BOM/routing release | Cost calibration §9 |
| D3 | Cost sheets + variance vs **released standard** (< 10% target) | `costEngine.ts` |
| D4 | Work center rate calibration (Finance sign-off) | Cost calibration §4 |
| D5 | Dispatch plan → confirm → POD → FG issue | Dispatch module |
| D6 | GST tax invoice + payment + SO close | `gstEngine.ts` |
| D7 | Invoice PDF generation + server storage | Phase 9 |

**Gate D:** FG variance vs released standard < 10% on SO-0001 replay; tax invoice archived; dispatch challan retrievable.

---

### Phase E — Cutover & Factory Pilot (Weeks 25–32)

**Goal:** Decommission localStorage; run 1 real order on shop floor.  
*Maps to backend plan Phase 10–11.*

| # | Deliverable | Reference |
|---|-------------|-----------|
| E1 | React stores → TanStack Query API clients | Migration plan §Phase 10 |
| E2 | Remove hardcoded audit users | Audit trail §8.4 |
| E3 | Role-based training + SOPs per department | RBAC roles |
| E4 | Shop tablet UI for job cards (1 bay pilot) | Readiness blocker #7 |
| E5 | Backup, restore, rollback drill | Ops |
| E6 | **Factory pilot order** — 1 live SO, 1 trailer, full cycle | Plant sign-off |
| E7 | Hypercare period (4 weeks post go-live) | Support roster |

**Gate E (Factory Go-Live):** All §2 criteria G1–G10 satisfied; plant head sign-off.

---

## 7. Workstreams

```text
                    Phase A    B      C      D      E
                    ─────────────────────────────────
Platform (DB/API)      ·    ████   ████   ██     ██
Auth + RBAC            ·    ████   ██     ·      ·
Audit trail            ·    ████   ████   ████   ██
Commercial (Sales)     ██   ·      ████   ·      ·
Engineering (BOM/RTG)  ██   ████   ██     ·      ·
Manufacturing          ·    ██     ████   ██     ████
Quality                ·    ·      ██     ████   ██
Costing / Finance      ██   ·      ·      ████   ██
Dispatch / Logistics   ·    ·      ·      ████   ████
Shop floor UX          ·    ·      ·      ██     ████
```

### 7.1 Cost calibration workstream (parallel from Phase A)

Must complete **before** management trusts margin reports at go-live.

| Step | Action | Owner | Doc |
|------|--------|-------|-----|
| 1 | Fix variance baseline (released standard, not material-only BOM) | Dev + Finance | [`ERP_COST_CALIBRATION.md`](./ERP_COST_CALIBRATION.md) |
| 2 | Complete chassis BOM (structural RM) | Engineering | Cost cal §WO-0002 |
| 3 | Add subcontract service rates (paint) | Purchase + Eng | Cost cal §WO-0004 |
| 4 | Validate work center rates ₹680–950/hr | Finance | Cost cal §4 |
| 5 | Time-study routing standard hours | Production | Routing seed |
| 6 | Confirm overhead % (currently 10%) | Finance | Cost cal §5 |
| 7 | Validate scrap % from NCR history | Quality | Cost cal §2 |

**Target metrics after calibration:**

| Metric | Target |
|--------|--------|
| FG variance vs released standard | < 10% |
| Material variance (issued vs BOM qty × rate) | < 5% |
| Labor variance (actual hrs vs routing) | < 8% |

---

## 8. Pilot Programs

### 8.1 H0 — Desk pilot (available now)

| Item | Detail |
|------|--------|
| **Users** | 1–2 production planners |
| **Orders** | SO-0001 pattern (seed or duplicate) |
| **Modules** | MRP · WO · Costing · Dispatch · Invoice |
| **Data** | Browser localStorage — **not production data** |
| **Duration** | 2–4 weeks familiarization |
| **Success** | Planner completes full cycle without dev support |

### 8.2 H1 — Shop pilot (after Phase B + partial C)

| Item | Detail |
|------|--------|
| **Users** | 1 bay supervisor + 1 storekeeper + 1 QC inspector |
| **Scope** | 1 tank or chassis WO; job cards on tablet |
| **Requires** | Login, server DB, audit on issue/complete |
| **Duration** | 4 weeks |
| **Success** | Real material issue + QC + SA receipt with audit trail |

### 8.3 H2 — Commercial pilot (after Phase C1)

| Item | Detail |
|------|--------|
| **Users** | Sales + planning |
| **Scope** | Live SO entry → MRP (no seed) |
| **Duration** | 2 weeks |
| **Success** | SO created, confirmed, pegged through MRP without manual seed |

### 8.4 H3 — Factory go-live (after Phase E)

| Item | Detail |
|------|--------|
| **Scope** | All modules; all bays; dispatch gate; accounts |
| **Cutover** | Big-bang or phased by module — recommend **module phased** (Stores+Prod first, then Dispatch+Accounts) |
| **Rollback** | Revert to parallel spreadsheet for 2 weeks if ledger integrity fails |

---

## 9. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| localStorage data loss during pilot | High | Medium | H0 is training only; no live stock |
| Backend delay blocks go-live | Medium | High | Phase A frontend fixes maintain momentum |
| Cost variance distrust at go-live | High | High | Calibration workstream + released standard |
| Shop floor rejects tablet UI | Medium | High | H1 pilot early; supervisor co-design |
| BOM errors cause wrong material issue | Medium | Critical | Engineering sign-off gate on BOM release |
| Dual SO model confusion | Low | Medium | Deprecate legacy `types/erp.ts` in Phase C |
| Schema naming drift (DDL vs TS) | Medium | Medium | Align Prisma to live domain per migration plan §2.5 |

---

## 10. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Jun 2026 | Anchor product = 45 M³ Bulker | SO-0001 simulation complete |
| Jun 2026 | Per-SA WO mode for bulker | Validated in simulation (5 WOs) |
| Jun 2026 | Backend = NestJS + PostgreSQL + Prisma | Migration plan approved for planning |
| Jun 2026 | Variance vs released standard (not material-only BOM) | Cost calibration investigation |
| Jun 2026 | Factory go-live blocked until G1–G3 | No trust without server + auth + audit |

---

## 11. Document Index

| Document | Purpose |
|----------|---------|
| [`ERP_FACTORY_GO_LIVE_ROADMAP.md`](./ERP_FACTORY_GO_LIVE_ROADMAP.md) | **This file** — master deployment roadmap |
| [`ERP_GO_LIVE_READINESS.md`](./ERP_GO_LIVE_READINESS.md) | Module scores + blockers (auto-generated) |
| [`GO_LIVE_SIMULATION_REPORT.md`](./GO_LIVE_SIMULATION_REPORT.md) | Full E2E simulation evidence |
| [`ERP_COST_CALIBRATION.md`](./ERP_COST_CALIBRATION.md) | Cost variance root cause + calibration checklist |
| [`ERP_BACKEND_MIGRATION_PLAN.md`](./ERP_BACKEND_MIGRATION_PLAN.md) | React → API → NestJS → PostgreSQL technical plan |
| [`ERP_RBAC_PERMISSIONS.md`](./ERP_RBAC_PERMISSIONS.md) | Roles + permission matrix |
| [`ERP_AUDIT_TRAIL.md`](./ERP_AUDIT_TRAIL.md) | Audit columns + event log specification |
| [`ERP_GAP_ANALYSIS.md`](./ERP_GAP_ANALYSIS.md) | Lifecycle stage gap detail |
| [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) | PostgreSQL DDL reference |
| [`ERP_FUNCTIONAL_BLUEPRINT.md`](./ERP_FUNCTIONAL_BLUEPRINT.md) | Functional scope |

---

## 12. Next Actions (This Week)

| # | Action | Owner |
|---|--------|-------|
| 1 | Approve backend migration budget + Phase 0 kickoff | Management |
| 2 | Engineering review chassis BOM gaps (Rev-B) | Engineering |
| 3 | Finance workshop: work center rates + overhead % | Finance |
| 4 | Fix subcontract double-count in cost engine | Dev |
| 5 | Begin SO CRUD UI (Phase A5) | Dev |
| 6 | Run `npm run simulate:go-live` weekly as regression gate | QA |

---

*The ERP proves the manufacturing story. Factory go-live proves the **trust** story — server data, real users, calibrated costs, and audit on every transaction.*
