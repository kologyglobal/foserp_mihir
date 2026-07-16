# ERP Go-Live Readiness Assessment

**Generated:** 2026-06-25 11:42:09  
**Plant:** Vasant Trailers · Pune  
**Simulation:** ABC Cement · SO-0001 · 2× 45 M3 Bulker Trailer  
**Simulation Result:** ✅ PASS (9/9 checks)  
**Overall Readiness:** **Prototype — not factory ready**  
**Average Module Score:** 2.2 / 3.0

---

## Scoring Scale

| Score | Rating | Meaning |
|-------|--------|---------|
| 0 | Missing | Not implemented |
| 1 | Prototype | Seed/demo only; not operable by factory staff |
| 2 | Functional | End-to-end works for anchor scenario; gaps remain |
| 3 | Production Ready | Persisted, tested, UI complete, factory-operable |

---

## Module Readiness Matrix

| Module | Score | Rating | Simulation Evidence |
|--------|-------|--------|---------------------|
| **Inventory** | 3 | Production Ready | Ledger reconcile PASS · reservations · ISSUE_TO_WO · SA/FG receipt · DISPATCH issue · WIP transfers |
| **MRP** | 3 | Production Ready | MRP-0001 · 11 material lines · 4 WO reqs · SO pegging · auto-reserve |
| **Purchase** | 2 | Functional | PR-0001 → 3 POs → 3 GRNs posted to inventory |
| **Production** | 3 | Production Ready | 5 WOs · per-SA mode · routing/job cards · subcontract paint · FG receipt · integrity 0 errors |
| **Quality** | 2 | Functional | QC rework on WO-0001 welding · re-inspection PASS · QC gates block next op · 1 rework(s) in sim |
| **Costing** | 2 | Functional | FG actual ₹46,40,324 · roll-up ₹43,01,128 · variance 52.8% vs BOM standard |
| **Dispatch** | 2 | Functional | DC-0001 · loading checklist · trailer/chassis · transport · POD · FG yard issue |
| **Sales** | 1 | Prototype | Seed SO-0001 consumed · status machine to closed · no SO CRUD UI · no inquiry/quotation pipeline |
| **Traceability** | 2 | Functional | 18 pegged movements · WO genealogy 5 nodes · MRP pegging fields · dispatch line → invoice line |

---

## Module Detail & Gaps

### Inventory — 3/3 (Production Ready)

Ledger reconcile PASS · reservations · ISSUE_TO_WO · SA/FG receipt · DISPATCH issue · WIP transfers

**Gaps:** None critical for anchor scenario.

### MRP — 3/3 (Production Ready)

MRP-0001 · 11 material lines · 4 WO reqs · SO pegging · auto-reserve

**Gaps:** Re-MRP can duplicate PRs · No formal SO approval gate before MRP

### Purchase — 2/3 (Functional)

PR-0001 → 3 POs → 3 GRNs posted to inventory

**Gaps:** GRN not on dedicated register route · No incoming QC hold on receipt · RFQ comparison optional only

### Production — 3/3 (Production Ready)

5 WOs · per-SA mode · routing/job cards · subcontract paint · FG receipt · integrity 0 errors

**Gaps:** WO status timestamps not always set on completion · No shop-floor tablet/barcode UI · one_per_trailer mode less tested

### Quality — 2/3 (Functional)

QC rework on WO-0001 welding · re-inspection PASS · QC gates block next op · 1 rework(s) in sim

**Gaps:** No incoming material QC · No standalone QC certificate print · NCR workflow not in simulation path

### Costing — 2/3 (Functional)

FG actual ₹46,40,324 · roll-up ₹43,01,128 · variance 52.8% vs BOM standard

**Gaps:** High cost variance vs standard — rates need calibration · No standard cost revision workflow tied to BOM release

### Dispatch — 2/3 (Functional)

DC-0001 · loading checklist · trailer/chassis · transport · POD · FG yard issue

**Gaps:** Browser localStorage only — no server-side challan archive · Photos stored as base64 demo blobs

### Sales — 1/3 (Prototype)

Seed SO-0001 consumed · status machine to closed · no SO CRUD UI · no inquiry/quotation pipeline

**Gaps:** Must pre-seed sales orders — no create/confirm UI · No Lead → Inquiry → Quotation → Approval · Dual SO model (legacy mock vs mrpStore)

### Traceability — 2/3 (Functional)

18 pegged movements · WO genealogy 5 nodes · MRP pegging fields · dispatch line → invoice line

**Gaps:** No single traceability report UI · No serial number master at FG receipt · Lot/batch not enforced on RM


---

## Simulation Verification Summary

| Check | Status |
|-------|--------|
| No orphan BOM/routing/WC references | ✅ PASS |
| No inventory mismatch (ledger = on-hand) | ✅ PASS |
| FG cost rollup includes child SA costs | ✅ PASS |
| No WO completion with open QC hold | ✅ PASS |
| FG receipt only after SA receipts posted | ✅ PASS |
| FG Yard stock after dispatch | ✅ PASS |
| Dispatch issues FG from yard | ✅ PASS |
| Invoice GST and payment closes SO | ✅ PASS |
| Material traceability RM → SA → FG | ✅ PASS |

---

## End-to-End Flow Validated

```
Sales Order (seed SO-0001)
  → MRP → PR → PO → GRN
  → Reservation → Work Orders (5)
  → Material Issue → Operations → QC Rework
  → SA Receipt → FG WO → FG Receipt
  → Cost Rollup → Dispatch → Customer POD
  → Tax Invoice → Payment → SO Closed
```

**Timeline events:** 59  
**Work orders:** 5  
**Tax invoice:** INV-2026-0001 (₹67,26,000)

---

## Factory Deployment Blockers (Critical)

| # | Blocker | Impact | Modules Affected |
|---|---------|--------|------------------|
| 1 | No backend database — all transactional data in browser localStorage (single-user, no HA) | Data loss, no multi-user | All |
| 2 | Sales order entry requires seed data — commercial front (Lead/Inquiry/Quote) not built | Cannot take live orders | Sales, MRP |
| 3 | No user authentication, roles, or audit trail for shop-floor transactions | No accountability | All |
| 4 | Standard costs diverge significantly from actuals — costing master data needs plant calibration | Wrong margins | Costing, Finance |
| 5 | GRN and purchase audit trail lacks dedicated list/register pages | Operational friction | Various |
| 6 | No ECO / engineering change control — BOM/routing revisions are manual | Operational friction | Various |
| 7 | No barcode/scanner integration for material issue and FG dispatch at gate | Operational friction | Various |
| 8 | No email/PDF server dispatch for tax invoice — print-only in browser | Operational friction | Various |
| 9 | Multi-plant / multi-company not supported | Operational friction | Various |
| 10 | Simulation uses stock top-ups for shortages — real plant needs strict negative-stock prevention at issue | Operational friction | Various |

---

## Go-Live Recommendation

| Phase | Scope | Readiness |
|-------|-------|-----------|
| **Pilot (desk)** | MRP → Production → Costing on SO-0001 class orders | ✅ Ready now |
| **Pilot (shop floor)** | Job cards + QC on 1 bay | ⚠️ Needs tablet UI + user login |
| **Pilot (dispatch)** | FG dispatch + tax invoice for ABC Cement pattern | ✅ Ready now |
| **Production go-live** | Live SO entry, multi-user, server DB | ❌ Blocked — see above |

**Verdict:** The ERP can execute a **complete manufacturing and fulfillment cycle** for the anchor bulker scenario using existing modules. It is **not yet ready for unattended factory production** without addressing server persistence, sales order entry, authentication, and cost calibration.

---

## Automated Test Coverage (existing scripts)

| Script | Area |
|--------|------|
| `npm run test:wo-flow` | Production WO lifecycle |
| `npm run test:dispatch` | Dispatch + POD |
| `npm run test:invoice` | GST invoice + receivable |
| `npm run test:costing` | Cost engine |
| `npm run test:quality` | QC + rework |
| `npm run simulate:go-live` | Full end-to-end (this report) |

---

*Generated by `scripts/go-live-simulation.ts` · No new modules created.*
