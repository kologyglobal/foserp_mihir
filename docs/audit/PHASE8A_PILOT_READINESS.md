# Phase 8A — Pilot Readiness

**Date:** 2026-07-21  
**Question:** Is FOS ERP ready for a **controlled manufacturing pilot** (narrow path)?  
**Evidence:** Capability matrix, baseline results, mock/demo audit, feature-flag matrix, migration audit, defect register.

---

## Decision

# READY WITH CONDITIONS

Not **READY** (open P0 schema/migrate/typecheck + mock leakages).  
Not **NOT READY** for a carefully scoped shop-floor pilot that stays on verified dual-mode paths and avoids demo/mock surfaces.

---

## What IS safe (narrow path)

Assume: `VITE_USE_API=true`, healthy JWT tenant, migrations applied for the phases below, operators trained to use **canonical** routes only.

| Step | Capability | Classification | Safe use |
|------|------------|----------------|----------|
| 1 | Finance setup + journals (if finance ops in pilot) | VERIFIED_SHIPPED | `/accounting/settings/*`, `/accounting/entries/journals*` |
| 2 | Mfg setup masters | VERIFIED_SHIPPED | `/manufacturing/setup/*`, profiles, WC, machines, BOM/routing setup — **not** legacy `/manufacturing/bom` |
| 3 | WO create / release / progress | VERIFIED_SHIPPED | `/manufacturing/work-orders` list/create/detail (**API** pages) |
| 4 | Today / Control Room / Daily Update / My Work | VERIFIED_SHIPPED | Canonical `/manufacturing/today|control-room|daily-update|my-work` |
| 5 | Materials issue | VERIFIED_SHIPPED (CONDITIONAL) | From **API WO detail** materials actions — requires real `InventoryStockBalance`; do **not** trust demo inventory registers |
| 6 | Runtime changes / WIP transfers / corrections | VERIFIED_SHIPPED | WO drawers + `/manufacturing/corrections` |
| 7 | Quality in-process/final (queue) | VERIFIED_SHIPPED (CONDITIONAL) | `/quality/queue`, `/quality/inspections/:id`, plans/parameters — **not** NCR/incoming/reports demo pages |
| 8 | CRM SO → demand convert | PARTIAL / CONDITIONAL | Commercial SO + convert API; verify demand appears before WO create |
| 9 | Money In / Money Out / Bank core | VERIFIED_SHIPPED | Only if pilot includes finance — use `/accounting/money-in|money-out|bank-cash` liquidity/statements/recon/transfers/cheques — **avoid** legacy receivables/payables and bank-account seed cards |

**FG receipt:** PARTIAL — BE `POST …/movements/fg-receipt` exists; use only if smoke-tested on the pilot tenant; do not assume full UI parity with materials.

**Job Work:** dual-mode service exists — CONDITIONAL smoke before including in pilot SOP.

---

## What is NOT safe

| Area | Why |
|------|-----|
| Manufacturing Accounting UI (`/accounting/manufacturing/**`) | Seed KPIs in API mode; BE GL **flag-gated off** by default |
| Classic MRP (`/mrp/*`) | DEMO_ONLY — no BE engine |
| Quality incoming / Purchase GRN | BLOCKED_BY_DEPENDENCY / demo GRN |
| Dispatch pick / pack / challan | DEMO_ONLY / NOT_FOUND beyond 7C0 confirm |
| Budgeting | DEMO_ONLY |
| Store workbench | FE NOT_FOUND |
| Legacy AR/AP, financial reports seed, live-activity tickers | MOCK_DATA_DEPENDENT |
| Relying on green CI typecheck / clean migrate status | Baseline failures (P0) |

---

## Conditions (must hold)

1. **Ops SOP** lists allowed routes only (table above); deep links to legacy/demo surfaces forbidden.  
2. **Inventory:** opening stock / receipts established via API (or seed scripts) so materials issue does not fail empty balances; inventory SPA treated as non-authoritative.  
3. **Feature flags:** leave `MANUFACTURING_ACCOUNTING` **off** unless BE enablement + FE gating fixed — do not “trust” costing dashboard.  
4. **Schema/migrate:** resolve or explicitly accept 8A-P0-1/2 for the pilot environment (validate green; known drift documented).  
5. **Quality:** no incoming GRN QC; NCR UI not authoritative until dual-routed.  
6. **No** full MRP, full dispatch, or purchase RFQ/PO/GRN expectations.  
7. Typecheck debt acknowledged — prefer smoke scripts (`manufacturing-phase*`, `inventory-phase3a`, quality 4a/4b) on the pilot DB over “build is green.”

---

## Blockers to upgrade to READY

| Blocker | Defect ID |
|---------|-----------|
| Prisma validate / consent + migrate drift clean | 8A-P0-1, 8A-P0-2 |
| Backend + frontend typecheck green (or scoped exemptions) | 8A-P0-3 |
| Gate mfg costing + top mock leakages on pilot path | 8A-P1-MOCK, 8A-P1-FLAG-1 |
| Optional: GRN if incoming QC required | 8A-P1-QC-IN |

---

## Verdict sentence

A **controlled manufacturing pilot** focused on **WO progress + real materials issue + optional real quality queue** is **READY WITH CONDITIONS**; broader finance-ops can ride along on Money In/Out and Bank & Cash core routes. Full factory (MRP, GRN QC, dispatch pick/pack, costing GL, store workbench) is **not** ready.

*Evidence: `docs/audit/PHASE8A_*.md`.*
