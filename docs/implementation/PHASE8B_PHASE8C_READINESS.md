# Phase 8B → Phase 8C Readiness Decision

**Date:** 2026-07-21 (Wave 1 close-out)  
**Inputs:** Phase 8A pilot readiness, remediation register (Wave 0 **CLOSED**, Wave 1 **CLOSED**), technical readiness T1–T5 filled locally, Wave 1 evidence pack.

---

## Decision template

Choose one:

| Option | Meaning |
|--------|---------|
| **READY FOR UAT** | Internal UAT may start on frozen pilot scope without further engineering gates |
| **READY WITH CONDITIONS for internal UAT** | Internal UAT may start; listed conditions must be tracked; client pilot not yet authorised |
| **NOT READY** | Do not start UAT; Wave 0/1 blockers must close first |

---

## Current decision

# READY FOR UAT (internal)

**Wave 0** (2026-07-21): validate, migrate status, BE/FE typecheck exit **0** on local engineering DB.  
**Wave 1** (2026-07-21): `8B-R-010` mock leakage and `8B-R-015` inventory SPA gate **VERIFIED_CLOSED**.

**Does not authorise:** client pilot · production deployment · client data migration · external UAT · go-live.

---

## Closed findings (Wave 1)

| ID | Title | Evidence |
|----|-------|----------|
| 8B-R-010 | Mock leakage on pilot SOP routes | [`PHASE8C_WAVE1_MOCK_AUDIT.md`](PHASE8C_WAVE1_MOCK_AUDIT.md), `npm run test:phase8c-wave1` 55/55 |
| 8B-R-015 | Inventory SPA direct-route / refresh gate | [`PHASE8C_WAVE1_SPA_GATE.md`](PHASE8C_WAVE1_SPA_GATE.md), `node scripts/verify-spa-routing.mjs` local 16/16 |
| Route inventory | Pilot SOP matrix | [`PHASE8C_WAVE1_ROUTE_MATRIX.md`](PHASE8C_WAVE1_ROUTE_MATRIX.md) |

---

## Open findings / residual risks

1. **Host / prod-like evidence (T6–T20)** still UNKNOWN — re-run SPA verify + health/TLS/backup on the UAT host before client exposure.  
2. **Manufacturing Accounting** remains **OFF**; API-mode UI gated (8B-R-011 CLOSED).  
3. **Exclusions enforced:** incoming QC, dispatch pick/pack, MRP, budgeting ops, mfg GL, FX/IC, live bank AIS. Inventory SPA hard-stopped (not authoritative).  
4. **Home / executive KPI chrome** may show empty counters from empty demo Zustand slices in API mode — NON_PILOT residual; not transactional SOP screens.  
5. **Job Work / FG receipt** stay CONDITIONAL until smoke PASS.  
6. **Backend vitest** still has intermittent uniqueness failures on some finance reversal suites (pre-existing dirty DB / parallel noise) — not introduced by Wave 1 SPA/mock work; track separately before client pilot.  
7. Client pilot / go-live date **not** authorised — cutover draft stays prepare-only.

---

## Required host actions

```bash
node scripts/verify-spa-routing.mjs https://<UAT_HOST>
# Expect: SPA deep links → HTML; /api/v1/health → JSON; unknown /api → JSON 404
```

Confirm Apache/nginx uses packaged `.htaccess` / `nginx.conf` (never rewrite `/api` to `index.html`).

---

## Exit to upgrade decision

| To reach… | Required |
|-----------|----------|
| **READY FOR UAT** (unqualified internal) | ~~Wave 0~~ **MET** · ~~Wave 1~~ **MET 2026-07-21** |
| **READY FOR CLIENT PILOT** | Internal UAT pack PASS/PASS WITH CONDITIONS + named support roster + backup evidence (T16) + host health (T6/T18) |
| **NOT READY** (regress) | Critical smoke failure on WO/materials/QC path or data integrity incident |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product / Implementation lead | TBD | | |
| Tech lead | TBD | | |

*Next: Run host evidence T6–T20, then execute UAT-01 through UAT-17.*
