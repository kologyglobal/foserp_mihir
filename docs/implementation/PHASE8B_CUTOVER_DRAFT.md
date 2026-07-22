# Phase 8B — Cutover Draft (Prepare Only)

**Status:** DRAFT — **no go-live date set**  
**Purpose:** Checklist to prepare environments and people; scheduling happens only after Phase 8C readiness gate.

---

## A. Pre-cutover (engineering)

| # | Item | Owner | Done |
|---|------|-------|------|
| A1 | Wave 0: prisma validate green (or accepted waiver) | Platform | ☐ |
| A2 | Wave 0: migrate status understood on pilot DB | DBA | ☐ |
| A3 | Wave 0: typecheck green or scoped waiver recorded | Tech lead | ☐ |
| A4 | Feature flags applied per `PHASE8B_FEATURE_FLAG_PLAN.md` | Admin | ☐ |
| A5 | Pilot tenant provisioned (`pilot-client` or agreed slug) | Admin | ☐ |
| A6 | Backup / restore drill evidence (or UNKNOWN documented) | Ops | ☐ |
| A7 | Smoke scripts on pilot DB (mfg phase*, inventory 3a, quality 4a/4b) | QA | ☐ |

## B. Data

| # | Item | Owner | Done |
|---|------|-------|------|
| B1 | Masters loaded from templates (`docs/implementation/templates/`) | Impl | ☐ |
| B2 | 3–5 pilot products + BOM/routing/profiles | Planner | ☐ |
| B3 | Opening stock loaded and spot-checked | Stores | ☐ |
| B4 | Users/roles (~10–15) invited and permissioned | Admin | ☐ |
| B5 | Demo/seed data not mixed into API tenant | Admin | ☐ |

## C. People & process

| # | Item | Owner | Done |
|---|------|-------|------|
| C1 | SOP training completed (SOP index) | Impl | ☐ |
| C2 | Prohibited screens communicated | Supervisor | ☐ |
| C3 | Manual controls owners named | Impl | ☐ |
| C4 | UAT pack internal PASS / PASS WITH CONDITIONS | QA | ☐ |
| C5 | Support roster + escalation (placeholders filled) | Impl | ☐ |

## D. Explicit non-goals at cutover

- No MRP, GRN incoming QC, dispatch pick/pack, mfg GL, budgeting, FX/IC, live PSD2.  
- No production go-live date in this document.

## E. Go-live scheduling (later)

| Field | Value |
|-------|-------|
| Proposed pilot start | **TBD — not set** |
| Proposed hypercare end | **TBD** |
| Approver | **TBD** |

*Do not fill E until `PHASE8B_PHASE8C_READINESS.md` allows client pilot (not only internal UAT).*
