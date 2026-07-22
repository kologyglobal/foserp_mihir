# Production Module — Phase Plan

> Phase 0–**2B** shipped 2026-07-20. Next: Phase 3 Inventory (separate approval).  
> Trailer is reference template #1 only.

---

## Phase 0 — Discovery (this phase)

| | |
|--|--|
| **Scope** | Audit, ADRs (Proposed), docs only |
| **Deliverables** | 8 PRODUCTION_*.md docs + status updates |
| **Not in scope** | Schema, APIs, UI, permissions seed changes, migrations |

---

## Phase 1 — Foundation and Masters

| Area | Status |
|------|--------|
| **Database** | **Done** — migration `20260720140000_manufacturing_phase1_foundation` |
| **Backend** | **Done** — CRUD + activate lifecycle; tenant isolation |
| **Frontend** | **Done** — API-mode setup under `/manufacturing/setup/*`; demo fallback retained |
| **Integrations** | MasterItem/UOM/Warehouse FKs only |
| **Tests** | Backend 12/12; FE smoke 37/37 |
| **Acceptance** | Met for masters scope 2026-07-20 |
| **Deferred** | Production Order execution, Inventory, Quality |

See `docs/manufacturing/PRODUCTION_PHASE1_README.md`.

---

## Phase 2 — Production Order and Visibility

| Area | Status |
|------|--------|
| **Database** | **Done (2A+2B)** — Demand, WO, snapshots, ledger; assignments, daily batches, issues, downtime |
| **Backend** | **Done (2A+2B)** — convert/release/progress + Daily Production / My Work / assignments / issues |
| **Frontend** | **Done (2A+2B)** — WO/Today/Control Room + Daily Update / My Work / Issues |
| **Integrations** | CRM SO conversion; soft shift/employee refs |
| **Tests** | Backend 31 (1+2a+2b); FE smoke phase2a + phase2b |
| **Acceptance** | Met for Phase 2A+2B scope 2026-07-20 |
| **Deferred** | Physical stock; PR; QC; OEE; costing |

See `docs/manufacturing/PRODUCTION_PHASE2A_README.md`, `PRODUCTION_PHASE2B_README.md`.

---

## Phase 2B — Daily Production & Operator UX (detail)

| Area | Status |
|------|--------|
| **Database** | **Done** — migration `20260720160000_manufacturing_phase2b_daily_ops` |
| **Backend** | **Done** — assignments, my-work, daily-production, issues, downtime |
| **Frontend** | **Done** — `/daily-update`, `/my-work`, `/issues` + WO/Today enhancements |
| **Tests** | Backend 8/8; FE 77/77 |
| **Deferred** | Inventory/PR/QC integrations from issue types |

---

## Phase 3 — Inventory, Store and Purchase

| Area | Status |
|------|--------|
| **3A Inventory foundation** | **Done** — stock balance/ledger/reservation/issue/FG receipt APIs |
| **3B Purchase PR** | **Done** — PR header/lines + lifecycle + production shortage endpoint |
| **3C Production materials** | **Done** — reserve/issue/return/shortage→PR/FG gate on WO (`PRODUCTION_PHASE3C_README.md`) |
| **Deferred** | Full MRP; bin/heat; RFQ/PO/GRN; Inventory/Purchase SPA dual-mode |

---

## Phase 4 — Quality and Subcontracting

| Area | Scope |
|------|-------|
| **4A (done 2026-07-20)** | `QualityInspection` + `QualityNcr`; `/quality` API; stage QC gate; WO blockers — see `docs/quality/QUALITY_PHASE4A_README.md` |
| **Depends on** | Quality inspection API (parallel or thin) — **4A foundation shipped** |
| **Backend (remaining)** | Inspection plans/parameters; incoming GRN QC; Job Work lifecycle + vendor |
| **Frontend (remaining)** | Full dual-mode Quality SPA; Job Work API mode |
| **Tests** | `quality-phase4a.test.ts` — hold blocks completion; PASS promotes; REJECT → NCR |
| **Acceptance** | Final QC required before FG when flagged — **enforced in 4A** |
| **Deferred** | Instruments/calibration |

---

## Phase 5 — Runtime Flexibility

| Area | Scope |
|------|-------|
| **Database** | RuntimeChange, SplitLink, Issue+maintenance stub link |
| **Backend** | Qty/BOM/op changes with approval; split; downtime |
| **Frontend** | Runtime change drawer; split wizard |
| **Tests** | Approval gates; split qty conservation |
| **Acceptance** | ETO-style change without new product code |
| **Deferred** | Full CMMS |

---

## Phase 6 — Planning and Costing

| Area | Scope |
|------|-------|
| **6A (done 2026-07-20)** | Production Plan + netting + draft WO generation — see `PRODUCTION_PHASE6A_README.md` |
| **6B (done 2026-07-20)** | `ProductionAccountingEvent` + flag-gated GL — see `PRODUCTION_PHASE6B_README.md` |
| **Database** | Plan header/lines shipped; costing / MRP run tables deferred |
| **Backend** | Plan → WO shipped; cost preview / GL later |
| **Frontend** | Production plan dual-mode; costing tab later when flagged |
| **Integrations** | Inventory free qty for netting; posting engine later |
| **Tests** | Phase 6A vitest + FE smoke |
| **Acceptance** | 6A: plan lifecycle + draft WOs; 6B: flag off = events only; flag on = balanced vouchers |
| **Deferred** | Advanced MRP/CRP; full FA integration; multi-level MRP |

---

## Phase 7A — Warehouse, Material Reconciliation, Physical WIP & FG (done 2026-07-21)

| Area | Status |
|------|--------|
| **7A1–7A5** | Warehouse mapping, material position/recon, WIP position, FG receipts + close readiness, store workbench |
| **Semantics** | ADR-037 — `ISSUE_TO_WO` = WO custody (no double stock-out) |
| **Docs** | `PRODUCTION_PHASE7A_README.md` + mapping / recon / WIP / FG / close / inventory integration |
| **Deferred** | Incoming GRN QC, dispatch/pick/pack, SO delivery/invoice, OEE, finite scheduling, full WMS, auto mfg GL, InventoryLot/Serial masters, WO split |

**Next (separate approval):** Phase 7B — Incoming / in-process / final Quality completion.

---

## Phase 7D — Production / Quality / Dispatch Reporting (done core 2026-07-21)

| Area | Status |
|------|--------|
| **Scope** | Read-only reporting over operational ledgers: registry + executors, saved views, CSV export (≤10k sync), shopfloor live board (30s poll), cross-module traceability, operational exception centre |
| **Reports** | 25 keys — 21 READY, 2 PARTIAL (`production-quality`, `invoice-readiness`), 2 UNAVAILABLE (`delivery-challans`, `supplier-quality`) |
| **SoT** | Operational ledgers stay SoT; no second warehouse/stock ledger; WIP = issued − returned custody; no OEE/cost; cost reporting flag-gated |
| **Docs** | `docs/reports/PHASE7D_REPORTING_README.md` + architecture / catalogue / calculation / saved-view / export / shopfloor / WIP ageing / quality / dispatch / traceability / exception / performance; ADR-038 |
| **Tests** | backend `ops-reports-phase7d.test.ts` 13/13; FE `test:manufacturing-phase7d` 64/64; **no 10k-row volume suite run — targets documented** |
| **Deferred** | Delivery Challan + supplier/incoming QC reports (need 7C1–7C5 / GRN), invoice posting, OEE, 10k volume benchmark |

**Decision:** READY WITH CONDITIONS. Do not claim Delivery Challan or Incoming QC reports as live.

---

## Phase 7E — Costing & Accounting Productionisation (done core 2026-07-21)

| Area | Status |
|------|--------|
| **Scope** | Costing policies + built-in provisional fallback; versioned WO cost snapshots + idempotent cost entries; accounting readiness; manual absorption/variance post + retry; financial close (residual variance); proportional FG capitalisation + compensating `MANUFACTURING_REVERSAL`; accounting workspace + reconciliation |
| **Costing method** | `ACTUAL` / `PLANNED_AS_PROVISIONAL` only — **`STANDARD_WITH_VARIANCE` deferred** (not an enum value) |
| **Material cost** | `InventoryStockMovement.value` with provisional fallback (`qty × standardRate`) when value ≤ 0; **no moving-average/FIFO engine**; no historical rewrite |
| **Mapping / GL** | Reuses `DefaultAccountMapping` (no parallel table); GL only via central `post()`; `MANUFACTURING_ACCOUNTING` flag **off by default** — ADR-039 |
| **Rollout** | Stage 1 costing / Stage 2 manual post / Stage 3 pilot / **Stage 4 auto NOT enabled** |
| **Docs** | `PRODUCTION_PHASE7E_README.md` + costing policy / WO / material / labour+machine / job-work / WIP / FG / variance / posting events / mapping / reversal / feature-flag / reconciliation; ADR-039 |
| **Migration** | `20260721190000_manufacturing_phase7e_costing` (additive) |
| **Tests** | `manufacturing-phase7e.test.ts` **7/7**; `manufacturing-phase6b.test.ts` **4/4** regression |
| **Deferred** | Auto-posting (Stage 4), payroll, ABC/OEE, COGS/Delivery Challan/Sales Invoice/revenue, scrap/rework cost capture, variance decomposition |

**Decision:** READY FOR MANUAL ACCOUNTING PILOT. **Next (separate approval): Phase 8 pilot hardening — not auto-started.**

---

## Cross-phase rules

1. Never mark Production complete without UI+API+DB+perms+tenant tests.  
2. Demo mode must keep working (`VITE_USE_API=false`).  
3. No trailer-only schema.  
4. Inventory remains physical SoT.  
5. Manufacturing GL remains flagged off until Phase 6 acceptance.  
6. Canonical routes stay `/manufacturing/*`.

---

## Suggested sequencing dependency

```text
Phase 1 Masters
  → Phase 2 WO + SO demand
    → Phase 3 Inventory + PR (hard dependency on Inventory/Purchase backends)
      → Phase 4 Quality + Job Work
        → Phase 5 Runtime
          → Phase 6 Plan + Costing/GL
            → Phase 7A Warehouse / FG / Store workbench
              → Phase 7B Quality completion (separate)
```

If Inventory backend is delayed, Phase 2 can still ship **visibility + stage ledger only**, with materials shown as “availability pending.”
