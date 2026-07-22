# Phase 8B — Remediation Register

**Started:** 2026-07-21  
**Source:** [`docs/audit/PHASE8A_DEFECT_REGISTER.md`](../audit/PHASE8A_DEFECT_REGISTER.md), [`PHASE8A_PHASE8B_RECOMMENDATION.md`](../audit/PHASE8A_PHASE8B_RECOMMENDATION.md)  
**Policy:** Track burn-down of 8A P0/P1 before expanding pilot scope. Wave 0 engineering work may update statuses later; this pack starts them as **OPEN** unless marked **ACCEPTED_OUTSIDE_PILOT**.

### Status legend

| Status | Meaning |
|--------|---------|
| **OPEN** | Not closed; blocks or conditions pilot confidence |
| **IN_PROGRESS** | Active Wave 0/1 work |
| **FIXED** | Exit criteria met + evidence linked |
| **VERIFIED_CLOSED** | Fixed + re-validated with command evidence this session |
| **WAIVED** | Explicit product waiver with owner + expiry |
| **ACCEPTED_OUTSIDE_PILOT** | Known gap; excluded from controlled pilot SOP (manual control applies) |

### Column definitions

| Column | Meaning |
|--------|---------|
| **ID** | Phase 8B tracking id |
| **Source 8A** | Originating defect / theme from Phase 8A |
| **Title** | Short defect title |
| **Severity** | P0 / P1 |
| **Wave** | 0 = engineering confidence · 1 = pilot safety · 3 = scope expansion (post-pilot) |
| **Owner** | Role accountable (placeholder until named) |
| **Status** | See legend |
| **Exit criteria** | What “done” means |
| **Evidence** | Link / command / ticket (fill as work completes) |
| **Notes** | Pilot impact |

---

## P0 — Engineering confidence (Wave 0)

| ID | Source 8A | Title | Severity | Wave | Owner | Status | Exit criteria | Evidence | Notes |
|----|-----------|-------|----------|------|-------|--------|---------------|----------|-------|
| 8B-R-001 | 8A-P0-1 | `BankConnectorConsent` schema integrity | P0 | 0 | Platform / Backend | **VERIFIED_CLOSED** | `npx tsx scripts/prisma-cli.ts validate` exit 0 | 2026-07-21 Wave 0 close: validate exit **0** (schema valid) | No DB reset |
| 8B-R-002 | 8A-P0-2 | Migration history drift | P0 | 0 | Platform / DBA | **VERIFIED_CLOSED** | `migrate status` understood on pilot DB; no silent force-reset; drift doc accepted | 2026-07-21 Wave 0 close: local `fos_erp` `migrate status` exit **0** — “Database schema is up to date!” (78 migrations). Ordering fix already in tree: `20260720260000_manufacturing_phase3c_pr_link_fk` (PR FK deferred after `purchase_requisitions`). Historical rolled-back rows may exist in `_prisma_migrations` (e.g. failed mid-deploy replay) — do **not** force-reset; use `migrate resolve` only with DBA review. | Fresh deploy path understood; no force-reset |
| 8B-R-003 | 8A-P0-3 | Backend + frontend typecheck failing | P0 | 0 | FE + BE leads | **VERIFIED_CLOSED** | `npm run typecheck` exit 0 in `backend/` and `frontend/` | 2026-07-21 Wave 0 close: BE exit **0** (FA disposal: UncheckedUpdateManyInput + repo import path); FE exit **0** (dispatch/quality `apiRequest` signatures, store workbench unwrap, WO status cast, CommandBar icons) | Green on local Wave 0 close |

---

## P1 — Pilot safety (Wave 1) or accepted outside pilot

| ID | Source 8A | Title | Severity | Wave | Owner | Status | Exit criteria | Evidence | Notes |
|----|-----------|-------|----------|------|-------|--------|---------------|----------|-------|
| 8B-R-010 | 8A-P1-MOCK | API-mode mock/demo leakages (16 candidates) | P1 | 1 | FE lead | **VERIFIED_CLOSED** | Mock audit re-run: 0 P1 leakages on pilot SOP routes | 2026-07-21 Wave 1: all 16 8A candidates gated/redirected; `DemoOnlyRouteGate`; live activity/pulse disabled in API mode; `npm run test:phase8c-wave1` 55/55; evidence [`PHASE8C_WAVE1_MOCK_AUDIT.md`](PHASE8C_WAVE1_MOCK_AUDIT.md) | Residual: home KPI chrome may be empty (NON_PILOT) |
| 8B-R-011 | 8A-P1-FLAG-1 | Mfg Accounting FE ignores `MANUFACTURING_ACCOUNTING` | P1 | 1 | FE + Finance | **VERIFIED_CLOSED** | FE hidden/disabled when flag off; no seed KPIs in API mode | 2026-07-21: `ManufacturingAccountingApiGate` wraps all `/accounting/manufacturing/*` routes; service `assertDemoModeOnly()`; empty “feature flag” state in API mode | BE posting already gated; leave flag **OFF** for pilot |
| 8B-R-012 | 8A-P1-FLAG-2 | No FE UI for `FinanceFeatureKey` toggles | P1 | 1 | Finance | **OPEN** | Ops can view/toggle keys in settings (or documented SQL SOP) | — | Pilot uses documented flag plan; not a shop-floor blocker |
| 8B-R-013 | 8A-P1-MIG | Migration drift / timestamp collisions | P1 | 0 | Platform / DBA | **VERIFIED_CLOSED** | Same family as 8B-R-002; reconcile folders vs `_prisma_migrations` | Closed with 8B-R-002: materials↔PR FK ordering fixed via `20260720260000_manufacturing_phase3c_pr_link_fk`; local migrate status up to date | Track with Wave 0 — closed |
| 8B-R-014 | 8A-P1-TAX-PERM | `finance.tax.*` missing from permissions catalog | P1 | 0 | Backend | **VERIFIED_CLOSED** | `finance.tax.view` / `finance.tax.extract` in catalog + FE union; extract not 403 for seeded roles | 2026-07-21: added to `backend/.../permissions.ts` (picked up by `FINANCE_PERMISSIONS`); FE `finance.ts` union + viewer/manager packs; FE typecheck no longer reports tax keys | Tenant Admin gets via FINANCE_PERMISSIONS filter |
| 8B-R-015 | 8A-P1-INV-FE | Inventory SPA not dual-mode gated | P1 | 1 | FE / Inventory | **VERIFIED_CLOSED** | Banner or redirect: non-authoritative in API mode | 2026-07-21 Wave 1: all `inventoryRouteChildren` → `ApiModeDemoGatePage` in API mode; SPA rewrite verified via `scripts/verify-spa-routing.mjs` (local host 16/16); JSON 404 for unknown `/api/*` in `app.ts`; evidence [`PHASE8C_WAVE1_SPA_GATE.md`](PHASE8C_WAVE1_SPA_GATE.md) | Pilot stock via WO materials + API/scripts only; re-run verify script on UAT host |
| 8B-R-016 | 8A-P1-QC-IN | Incoming QC blocked (no Purchase GRN) | P1 | 3 | Purchase + Quality | **ACCEPTED_OUTSIDE_PILOT** | GRN foundation + incoming queue dual-mode | — | Manual control: paper/Excel GRN QC if needed |
| 8B-R-017 | 8A-P1-DISPATCH | Pick / pack / challan not implemented | P1 | 3 | Dispatch | **ACCEPTED_OUTSIDE_PILOT** | Real stock-out + SO fulfilment APIs + UI | 2026-07-21: scan trailer/dispatch demoted `subNav:false` | Confirm-only (7C0) optional; pick/pack forbidden in SOP |
| 8B-R-018 | 8A-P1-MRP | Classic MRP FE without BE engine | P1 | 3 | Planning | **ACCEPTED_OUTSIDE_PILOT** | Explicit product decision + BE engine | 2026-07-21: removed from sidebar primary rail; MRP nav items `disabled`; Sales “Run Planning” demoted | Use production plans (6A) only if needed; `/mrp/*` prohibited |
| 8B-R-019 | 8A-P1-STORE | Store workbench FE missing | P1 | 3 | Manufacturing | **ACCEPTED_OUTSIDE_PILOT** | FE route + dual-mode workbench | — | Warehouse mapping BE only; stores use WO issue + API stock |

---

## Accepted outside pilot (capability gaps — not all in 8A P0/P1 table)

| ID | Source 8A | Title | Severity | Wave | Owner | Status | Exit criteria | Evidence | Notes |
|----|-----------|-------|----------|------|-------|--------|---------------|----------|-------|
| 8B-R-030 | Capability matrix | Budgeting module (demo-only) | P1 | 3 | Finance | **ACCEPTED_OUTSIDE_PILOT** | BE + dual-mode FE + tests | 2026-07-21: Budgeting primary Accounting tab demoted (`subNav:false`) | `/accounting/budgeting/**` prohibited |
| 8B-R-031 | Capability / baseline | Fixed Assets unfinished (Phase 4+) / typecheck noise | P1 | 3 | Finance FA | **WAIVED** (typecheck) / **ACCEPTED_OUTSIDE_PILOT** (Phase 4+) | FA Phase 4+ + typecheck clean on FA paths | 2026-07-21 Wave 0 close: FA disposal typecheck noise **fixed** (8B-R-003). Phase 4+ (reval/impairment/WDV/CWIP) remains outside pilot. | Pilot does not require FA ops; optional FA 1–3 only if smoke-passed |
| 8B-R-032 | Capability matrix | Bank 5D2 live connectors (SFTP / PSD2 OAuth) | P1 | 3 | Treasury | **ACCEPTED_OUTSIDE_PILOT** | Live SFTP/PSD2 product approval + evidence | — | Sandbox/REST scaffold OK; live bank APIs out of pilot |
| 8B-R-033 | Deferred by design | FX treasury / intercompany | P1 | 3 | Finance | **ACCEPTED_OUTSIDE_PILOT** | Product approval + shipped FX/IC | — | Keep `MULTI_CURRENCY` **OFF** unless tested |
| 8B-R-034 | Pilot readiness | Manufacturing Accounting GL / costing UI | P1 | 3 | Mfg Finance | **ACCEPTED_OUTSIDE_PILOT** | Flag on + FE gate + recon scripts green | — | Same theme as 8B-R-011; flag stays off |

---

## Wave 0 close summary (2026-07-21)

| Gate | Result |
|------|--------|
| 8B-R-001 validate | **VERIFIED_CLOSED** |
| 8B-R-002 / 8B-R-013 migrate | **VERIFIED_CLOSED** (local DB up to date; ordering documented) |
| 8B-R-003 typecheck | **VERIFIED_CLOSED** (BE + FE exit 0) |
| 8B-R-014 tax perms | **VERIFIED_CLOSED** (prior session) |

**Wave 0 engineering confidence: CLOSED.**  
**Wave 1 mock leakage + inventory SPA gate: CLOSED** (8B-R-010, 8B-R-015 — 2026-07-21).  
Next: fill host technical readiness T6–T20; execute UAT-01 through UAT-17.

## Suggested close order

1. ~~**Wave 0:** 8B-R-001 → 8B-R-002/013 → 8B-R-003 → 8B-R-014~~ **DONE 2026-07-21**
2. ~~**Wave 1 (pilot SOP routes):** 8B-R-011 → 8B-R-010 → 8B-R-015~~ **DONE 2026-07-21**
3. **Do not start Wave 3** items until host T6–T20 + UAT pack complete or waived.

*Wave 0 code remediations may flip OPEN → IN_PROGRESS / FIXED without revising this pack’s initial snapshot — update Evidence column when closing.*
