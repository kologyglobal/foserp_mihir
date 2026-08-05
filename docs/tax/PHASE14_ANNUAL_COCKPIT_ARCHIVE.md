# Phase 14 — Annual returns, FY cockpit & multi-year archive

**Date:** 2026-08-05  
**Status:** **READY WITH CONDITIONS**  
**Does not claim:** FULL GST COMPLIANT · portal GSTR-9 / 9C submit · GSTR-9C CA certification · ledger purge on archive

---

## Scope (backlog after plan Phase 12)

The official `TAX_IMPLEMENTATION_PLAN.md` ends at **Phase 12 portal filing**. Phase 14 is the next coherent **books-side residual**:

| Area | Behaviour |
|------|-----------|
| GSTR-9 / 9C worksheet | Persist `gst_annual_returns` with OPEN → DRAFT → LOCKED → MARKED_FILED_EXTERNAL → ARCHIVED |
| FY cockpit | Score from monthly `GstrReturnPeriod`, RCM open rows, Phase 15 notices (soft), Phase 12 filing sessions (simulated trail) |
| Multi-year archive | `gst_fy_archives` retention flag only — **no** ledger delete |

Notices CRUD + period ops audit packs remain under **Phase 15** (`/ops/*`). Portal monthly filing remains **Phase 12**.

---

## Migration

`backend/prisma/migrations/20260805260000_gst_phase14_annual_cockpit_archive`

Tables:

- `gst_annual_returns`
- `gst_fy_archives`

Ordered **after** `20260805240000_gst_phase12_portal_filing` (room for Phase 13 @ 250000 if added later).

Feature flag: `GST_PHASE14_ANNUAL_ENABLED` (default **true**).

---

## Permissions

| Code | Use |
|------|-----|
| `tax.gst.annual.view` | Read annual / cockpit / archives |
| `tax.gst.annual.prepare` | Prepare / lock / unlock worksheet |
| `tax.gst.annual.archive` | Archive annual row or FY retention |

Also accepted: `tax.gst.returns.prepare` / `lock` / `mark_filed`, `tax.gst.setup.manage`, `tax.gst.view`, `finance.tax.view`.

Finance Manager role pack includes Phase 14 annual perms. Run `db:sync-permissions` after deploy.

---

## API (`…/tax-compliance/annual`)

| Method | Path |
|--------|------|
| GET | `/capability-matrix` |
| GET | `/returns` |
| GET | `/return?legalEntityId&financialYear&returnType?` |
| POST | `/returns/prepare` |
| POST | `/returns/lock` |
| POST | `/returns/unlock` |
| POST | `/returns/mark-filed-external` |
| POST | `/returns/archive` |
| GET | `/cockpit` |
| GET/POST | `/fy-archives` |

---

## Frontend

- Nav: **Annual / FY archive** → `/accounting/tax-compliance/gst/annual`
- Dual-mode: demo cockpit matrix + empty worksheet; mutations require API mode

---

## Tests

```bash
cd backend
npx vitest run tests/gst-annual-phase14.test.ts
```

Pure unit tests (FY math, lifecycle gates, snapshot warnings, cockpit score, capability honesty).

---

## READY WITH CONDITIONS

1. `migrate deploy` including `20260805260000_gst_phase14_annual_cockpit_archive`  
2. `db:sync-permissions` for `tax.gst.annual.*`  
3. Monthly GSTR-1/3B prep + SI/VI ledger rows for meaningful annual totals  
4. Disable with `GST_PHASE14_ANNUAL_ENABLED=false` if needed  
5. Notices enhancement optional (Phase 15 table) — cockpit degrades gracefully if empty  

---

## Collision notes (12 / 13 / 15 / 16)

| Sibling work | Phase 14 stance |
|--------------|-----------------|
| Phase 12 portal filing (`GstrFilingSession`, `/filing/*`) | Reused for cockpit “simulated filing” counts only — not reimplemented |
| Phase 13 | **Not present** on disk as `PHASE13_*` / `*gst_phase13*` at ship time |
| Phase 15 ops (`gst_compliance_notices`, audit packs, `/ops/*`) | Notices **not** recreated in Phase 14 migration (avoids dual notices schema); cockpit reads Phase 15 notices when available |
| Phase 16 rate-ops / health variants mid-flight | Orthogonal paths; Phase 14 uses `/annual/*` only |

---

## Still NOT ready

- FULL GST COMPLIANT  
- Portal GSTR-9 / 9C submit  
- Official GSTR-9 table JSON / 9C CA pack  
- Physical record retention workflow beyond FY flag  

**Stop for review before any full-compliance product label.**
