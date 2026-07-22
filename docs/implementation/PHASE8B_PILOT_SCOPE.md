# Phase 8B — Pilot Scope (Frozen)

**Phase:** 8B implementation pack  
**Decision basis:** [`PHASE8A_PILOT_READINESS.md`](../audit/PHASE8A_PILOT_READINESS.md) — **READY WITH CONDITIONS**  
**Freeze date:** 2026-07-21  
**Go-live date:** *not set* (prepare-only; see `PHASE8B_CUTOVER_DRAFT.md`)

---

## 1. Controlled manufacturing pilot — locked parameters

| Parameter | Frozen value |
|-----------|--------------|
| Plants | **One** plant only |
| Frontend mode | `VITE_USE_API=true` (never mix demo + API data) |
| Tenant (UAT) | Prefer existing **`vasant-trailers`** for internal UAT |
| Tenant (pilot client placeholder) | `pilot-client` — replace when client tenant provisioned |
| Users | ~**10–15** named users (roles below) |
| Duration | **TBD** — placeholder: 2–4 weeks shop-floor UAT after internal UAT gate |
| Support | **TBD** — placeholder: 1 implementation lead + 1 tech on-call during pilot hours |

---

## 2. Products (3–5) — selection criteria + placeholders

Select **3–5** finished/semi-finished products that exercise the verified path without needing GRN, MRP, or dispatch.

| Slot | Template code | Selection criteria | Placeholder product | Include? |
|------|---------------|--------------------|---------------------|----------|
| P1 | SIMPLE | Single-level BOM, 2–4 ops, no subcontract, no serial | `PILOT-FG-SIMPLE` | **Required** |
| P2 | MULTILEVEL | Parent + ≥1 make child (or phantom), clear stage groups | `PILOT-FG-MULTI` | **Required** |
| P3 | QUALITY | Routing ops with `qualityRequired`; in-process and/or final plan | `PILOT-FG-QC` | **Required** |
| P4 | JOB_WORK | Optional Job Work path (dual-mode smoke first) | `PILOT-FG-JW` | **Optional** — CONDITIONAL |
| P5 | VARIANT | Optional simple variant of P1 (same WC set) | `PILOT-FG-VAR` | **Optional** |

**Do not select products that require:** incoming GRN QC, classic MRP netting, pick/pack dispatch, barcode, OEE, or manufacturing GL posting.

---

## 3. Allowed routes (canonical only)

From Phase 8A readiness — operators must use these only:

| Step | Capability | Allowed routes |
|------|------------|----------------|
| 1 | Finance setup + journals *(if finance in pilot)* | `/accounting/settings/*`, `/accounting/entries/journals*` |
| 2 | Mfg setup masters | `/manufacturing/setup/*`, profiles, WC, machines, BOM/routing setup — **not** legacy `/manufacturing/bom` |
| 3 | WO create / release / progress | `/manufacturing/work-orders` list/create/detail (**API** pages) |
| 4 | Today / Control Room / Daily Update / My Work | `/manufacturing/today`, `/control-room`, `/daily-update`, `/my-work` |
| 5 | Materials issue / return | From **API WO detail** materials actions |
| 6 | Runtime changes / WIP / corrections | WO drawers + `/manufacturing/corrections` |
| 7 | Quality in-process / final | `/quality/queue`, `/quality/inspections/:id`, plans/parameters |
| 8 | CRM SO → demand *(optional)* | Commercial SO + convert — verify demand before WO |
| 9 | Money In / Out / Bank core *(optional)* | `/accounting/money-in|money-out|bank-cash` liquidity/statements/recon/transfers/cheques |

**FG receipt:** allowed only after pilot-tenant smoke of `POST …/movements/fg-receipt`.  
**Job Work:** only if CONDITIONAL smoke PASS; otherwise exclude.

Full forbidden list: [`sops/PROHIBITED_ACTIONS.md`](sops/PROHIBITED_ACTIONS.md).

---

## 4. Explicit exclusions

| Excluded | Why | Manual control (summary) |
|----------|-----|--------------------------|
| Classic MRP (`/mrp/*`) | DEMO_ONLY | Planning via Excel / production plan 6A if needed |
| Incoming QC / Purchase GRN | BLOCKED / demo GRN | Paper/Excel incoming inspection; no ERP GRN |
| Dispatch pick / pack / challan | DEMO_ONLY / NOT_FOUND | Manual pack list + shipping docs outside ERP |
| Mfg Accounting GL / costing UI | Flag off + mock FE | Costing offline; flag stays **OFF** |
| Budgeting | DEMO_ONLY | Spreadsheet budgets |
| Legacy CoA / vouchers SPA | Residual demo risk | Use settings CoA + journals only |
| Inventory SPA as authoritative | Demo-leaning FE | Opening stock via API/scripts; issue via WO |
| Store workbench | FE NOT_FOUND | WO materials + warehouse mapping |
| OEE / barcode / auto-post mfg GL | Not pilot-ready | Leave off |
| FX / intercompany / live bank 5D2 | Deferred | Base currency only; bank file import / sandbox only |

Detail rows: [`PHASE8B_MANUAL_CONTROLS.md`](PHASE8B_MANUAL_CONTROLS.md).

---

## 5. Users & roles (~10–15)

| # | Role | Approx count | Primary screens |
|---|------|-------------:|-----------------|
| 1 | Tenant Admin / Implementation | 1–2 | Users, flags (SQL/SOP), setup |
| 2 | Production Planner / Supervisor | 2–3 | WO, Today, Control Room, Daily Update, Assign |
| 3 | Shop-floor Operator | 4–6 | My Work |
| 4 | Stores / Materials | 1–2 | WO materials issue/return |
| 5 | Quality Inspector | 1–2 | Quality queue / inspections |
| 6 | Finance (optional) | 0–2 | Journals, Money In/Out, Bank core |
| 7 | Viewer / Auditor | 0–1 | Read-only Control Room / reports agreed |

---

## 6. Duration & support (placeholders)

| Item | Placeholder | Fill before cutover |
|------|-------------|---------------------|
| Internal UAT window | TBD | Start after Wave 0 gate or **READY WITH CONDITIONS** acceptance |
| Client pilot window | TBD (suggest 2–4 weeks) | Client sign-off |
| Hypercare hours | TBD | Business hours IST |
| Escalation | TBD | Tech lead → product owner |
| Training | SOP index + walkthrough | Record attendance |

---

## 7. Success definition (pilot)

Pilot is **successful** when, for selected products:

1. WO released → progress (My Work and/or Daily Update) → materials issue with real stock → optional QC → corrections path understood → WO close / FG as smoke-approved.  
2. No reliance on prohibited screens for daily work.  
3. Daily reconciliation SOP completed for sample days.  
4. Open P0s either **FIXED** or explicitly **WAIVED** for the environment with residual risk accepted.

*Scope freeze: changes require written amendment to this file + remediation register note.*
