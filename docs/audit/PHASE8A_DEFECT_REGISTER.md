# Phase 8A — Defect Register (start)

**Date:** 2026-07-21  
**Policy:** Document defects; no feature implementation in this phase step.  
**Sources:** [`PHASE8A_BASELINE_RESULTS.md`](PHASE8A_BASELINE_RESULTS.md), [`PHASE8A_MOCK_DEMO_AUDIT.md`](PHASE8A_MOCK_DEMO_AUDIT.md), [`PHASE8A_FEATURE_FLAG_MATRIX.md`](PHASE8A_FEATURE_FLAG_MATRIX.md), [`PHASE8A_DATABASE_MIGRATION_AUDIT.md`](PHASE8A_DATABASE_MIGRATION_AUDIT.md), [`PHASE8A_VERIFIED_CAPABILITY_MATRIX.md`](PHASE8A_VERIFIED_CAPABILITY_MATRIX.md).

Severity: **P0** = blocks trustworthy API-mode / schema gate · **P1** = misleading ops data or significant gap · **P2** = polish / deferred.

---

## P0

| ID | Title | Evidence | Status | Notes |
|----|-------|----------|--------|-------|
| **8A-P0-1** | `BankConnectorConsent` schema integrity | Baseline: `prisma-cli validate` exit 1 — type missing while Tenant relation referenced (`schema.prisma` ~221). Migration folder `20260721120000_finance_phase5d3_bank_connector_consent` existed. | **Mitigated in tree?** | Current schema includes `model BankConnectorConsent` (~10993). **Re-run validate + migrate status** before closing. Until green, treat as open P0 for deploy. |
| **8A-P0-2** | Migration history drift | Baseline `migrate status` exit 1 — pending local folders vs DB-only renamed migrations (`PHASE8A_BASELINE_RESULTS` §4; migration audit §1) | **Open** | Blocks confident `migrate deploy` on shared DBs. No force-reset in Phase 8A. |
| **8A-P0-3** | Backend + frontend typecheck failing | Baseline: BE `tsc` exit 2; FE `tsc -b` exit 2; FE build fails at typecheck | **Open** | Themes below — blocks CI/ship confidence even where runtime paths work. |

### Typecheck themes (summary — not exhaustive)

From `PHASE8A_BASELINE_RESULTS.md`:

| Area | Theme |
|------|--------|
| Fixed assets | Approval document type / Prisma update fields / missing repository import paths |
| Bank connectors | SFTP client default import; missing `z` in enums file |
| Treasury liquidity | Unused symbols; `JsonArray` → control item casts |
| Dispatch | `ParsedQs` / controller casts; FE `CommandBarButton` / `DetailLayout` prop mismatches |
| Quality | `samplingMethod` create typing; readonly filter arrays; FE `qualityApi` `BodyInit` misuse |
| Manufacturing FE | WO register status string vs union |
| Tax FE | `finance.tax.view` / `finance.tax.extract` missing from FE permission union (BE routes already require `finance.tax.view`) |

---

## P1

| ID | Title | Evidence | Status | Notes |
|----|-------|----------|--------|-------|
| **8A-P1-MOCK** | 16 API-mode mock/demo leakages | Full list: [`PHASE8A_MOCK_DEMO_AUDIT.md`](PHASE8A_MOCK_DEMO_AUDIT.md) §3 | **Open** | Do **not** duplicate all rows here. Highest pilot risk: mfg costing UI (#1), legacy AR/AP (#2–3), bank account cards (#5), dispatch (#9), quality NCR/incoming UI (#8), WO edit demo (#15), live-activity chrome (#6–7). |
| **8A-P1-FLAG-1** | Manufacturing Accounting FE ignores `MANUFACTURING_ACCOUNTING` | [`PHASE8A_FEATURE_FLAG_MATRIX.md`](PHASE8A_FEATURE_FLAG_MATRIX.md) D2; FE always serves seed at `/accounting/manufacturing/**` | **Open** | BE posting gated (safe); FE looks live → operator false confidence. |
| **8A-P1-FLAG-2** | No FE UI for `FinanceFeatureKey` toggles | Feature flag matrix D1; `FeaturesPage.tsx` edits posting limits only | **Open** | Ops cannot enable/disable keys in product UI. |
| **8A-P1-MIG** | Migration drift / timestamp collisions | Migration audit §1–2; multiple `20260721010000_*` folders | **Open** | Same root cause family as 8A-P0-2; track ops remediation. |
| **8A-P1-QC-IN** | Quality incoming blocked by missing Purchase GRN | `backend/src/modules/quality/workspace.service.ts` — `incomingNotReady()` / note requiring Purchase Receipt/GRN; BE purchase = requisitions only; FE `/purchase/grn*` demo | **Open** | Capability matrix: **BLOCKED_BY_DEPENDENCY**. |
| **8A-P1-TAX-PERM** | `finance.tax.*` used by routes but absent from permissions catalog | `tax-compliance.routes.ts` vs `backend/src/constants/permissions.ts` (no `finance.tax.*`); FE typecheck on tax perms | **Open** | Extract may 403 for seeded roles unless permissions added manually. |
| **8A-P1-INV-FE** | Inventory SPA not dual-mode gated | `inventoryRoutes.tsx` + matrix: BE Phase 3A shipped; pages lean demo | **Open** | Pilot should issue materials via WO API path, not inventory demo registers. |
| **8A-P1-DISPATCH** | Pick / pack / challan not implemented | Dispatch 7C0 confirm only; `ApiOutboundDispatchPages` comments; mock audit #9 | **Open** | Out of narrow manufacturing pilot path. |
| **8A-P1-MRP** | Classic MRP FE without BE engine | `productionRoutes.tsx` `/mrp/*`; no BE MRP module | **Open** | Use production plans (6A) only if planning needed. |
| **8A-P1-STORE** | Store workbench FE missing | Perm `manufacturing.store_workbench.view`; no route in `manufacturingRoutes.tsx` | **Open** | Warehouse mapping BE only. |

---

## P2 / watchlist

| ID | Title | Notes |
|----|-------|-------|
| 8A-P2-1 | Legacy CoA/voucher demo services still on disk | Redirects shipped; residual call risk (`MOCK` #16) |
| 8A-P2-2 | Unused `FinanceFeatureKey` values | Schema without gates (`RECEIVABLES`, `PAYABLES`, …) — false confidence if SQL-enabled |
| 8A-P2-3 | Production host API HTML risk | `PROJECT_STATUS` — redeploy `.htaccess` pending |
| 8A-P2-4 | FE `MOCK_USER` before auth sync | Documented production-risk brief window in mock audit |

---

## Closed / not defects

| Item | Reason |
|------|--------|
| Money Out requiring API mode | Intentional (`requireApiMode`) |
| Manufacturing Accounting GL off by default | Intentional flag gate |
| Full MRP / GRN / PSD2 deferred | Deferred by design |

---

## Suggested remediation order (for later phases)

1. Confirm schema validate green (8A-P0-1) + migration reconcile plan (8A-P0-2).  
2. Typecheck themes (8A-P0-3) — unblock CI.  
3. Gate or redirect API-mode leakages that sit on pilot path (mfg costing, legacy AR/AP, bank account cards).  
4. Wire FE to `MANUFACTURING_ACCOUNTING` / add feature-key settings.  
5. GRN foundation before incoming QC.

*End of defect register (start).*
