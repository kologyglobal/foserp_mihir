# Phase 12 — GST Portal Filing Foundation

**Date:** 2026-08-05  
**Status:** **READY WITH CONDITIONS (SIMULATED)**  
**Does not claim:** FULL GST COMPLIANT · live GSP/GSTN submit · certified portal filing

---

## Scope (from plan)

- GSTR-1 / 3B file path with provider mode + maker-checker  
- Prerequisites: Phases 1–11 exist in code; this phase is packaging + simulated submit only  
- Exit candidacy for **FULL GST COMPLIANCE READY** only after live IRN/e-Way, recon, payment, multi-GSTIN, and statutory UAT — **not** this phase

---

## Shipped

| Area | Behaviour |
|------|-----------|
| Filing session model | `GstrFilingSession` linked to Phase 5 `GstrReturnPeriod` |
| Package | From **LOCKED** return only — freezes `snapshotJson` (no second return engine) |
| Submit | **SIMULATED** by default → deterministic `SIM-ARN-*` + request/response audit JSON |
| LIVE | Hard-gated (`GST_PORTAL_FILING_*` envs); even when “ready”, core has **no** HTTP transport factory → `LIVE_BLOCKED` |
| Maker-checker | Optional `requireChecker` → `PENDING_CHECKER` (checker ≠ maker) → `PACKAGE_READY` |
| ARN | `capture-arn` or simulated response |
| Mark filed | Session → reuses Phase 5 `markFiledExternally` (ledger `FILED`, period `MARKED_FILED_EXTERNAL`) |
| Audit | `createAuditLog` on package / approve / submit / ARN / mark-filed |
| FE | `/accounting/tax-compliance/gst/portal-filing` dual-mode |
| Capability | Specials matrix `portal_filing` = **PARTIAL** |

---

## Migration

`20260805240000_gst_phase12_portal_filing`

Runs after Phase 11 `20260805230000_gst_phase11_specials`.

---

## Permissions

| Code | Use |
|------|-----|
| `tax.gst.returns.file` | Create package, checker approve, submit, capture ARN |
| `tax.gst.returns.mark_filed` | Mark filed from session (wires Phase 5) |
| `tax.gst.view` / `finance.tax.view` | List / capability |

Finance Manager pack includes `tax.gst.returns.file`. Run `db:sync-permissions` after deploy.

---

## Env (LIVE gates — never default on)

| Variable | Role |
|----------|------|
| `GST_PORTAL_FILING_PROVIDER_MODE` | `SIMULATED` (default) \| `LIVE` |
| `GST_PORTAL_FILING_LIVE_UAT_CERTIFIED` | Must be `true` after certified UAT |
| `GST_PORTAL_FILING_HTTP_TRANSPORT_READY` | Must be `true` after connector ships |
| `GST_PORTAL_FILING_API_BASE_URL` | GSP URL |
| `GST_PORTAL_FILING_USERNAME` / `PASSWORD` | Creds |
| `GST_PORTAL_FILING_CLIENT_ID` / `CLIENT_SECRET` | OAuth client |

---

## API (`…/tax-compliance/filing`)

| Method | Path |
|--------|------|
| GET | `/capability` |
| GET | `/sessions?legalEntityId&returnPeriod?` |
| POST | `/sessions` — body: LE, period, returnType, optional `requireChecker` |
| GET | `/sessions/:id` |
| POST | `/sessions/:id/approve-checker` |
| POST | `/sessions/:id/submit` |
| POST | `/sessions/:id/capture-arn` |
| POST | `/sessions/:id/mark-filed` |

---

## Tests

```bash
cd backend
npx vitest run tests/gst-portal-filing-phase12.test.ts tests/gst-specials-phase11.test.ts
```

---

## READY WITH CONDITIONS

1. `migrate deploy` including `20260805240000_gst_phase12_portal_filing`  
2. `npx prisma generate` (client models)  
3. `db:sync-permissions` for `tax.gst.returns.file`  
4. Phase 5 workflow: **prepare → lock** before package  
5. Keep `GST_PORTAL_FILING_PROVIDER_MODE=SIMULATED` for all non-UAT environments  
6. Do **not** label product **FULL GST COMPLIANT** after this phase

---

## Still NOT ready

| Claim | Why |
|-------|-----|
| FULL GST COMPLIANT | Requires live IRN, e-Way, recon, payment, multi-GSTIN + signed statutory UAT |
| Live GSTR-1 / 3B portal submit | No GSP HTTP transport in core; LIVE always blocks until connector + UAT |
| Auto-file without human ARN/check | Out of scope by design |

---

## Verdict

**GST PORTAL FILING (SIMULATED) — READY WITH CONDITIONS**

Stop for product review / UAT before any LIVE connector work.
