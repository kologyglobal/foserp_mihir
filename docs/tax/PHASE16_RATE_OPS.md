# Phase 16 — GST Rate Master Ops & Determination Continuity

**Date:** 2026-08-05  
**Status:** **READY WITH CONDITIONS**  
**Does not claim:** FULL GST COMPLIANT · LIVE portal filing · silent re-tax of posted documents · full GSTR-9 tables · master CRUD replacement

---

## Why this phase

Implementation plan stops at Phase 12 (portal). Siblings mid-flight already cover:

| Phase | Theme (on disk) |
|-------|-----------------|
| 12 | Portal filing sessions (SIMULATED) |
| 13 | Compliance hardening util/service |
| 14 | GSTR-9 annual worksheet + FY archive |
| 15 | Compliance cockpit / notices / audit packs |

**Phase 16** therefore ships the remaining operational gap: **effective-dated GST rate master hygiene + posted snapshot continuity**, without re-implementing 12–15.

---

## Scope (shipped)

| Area | Behaviour |
|------|-----------|
| Coverage gaps | Active `MasterGstGroup` without ACTIVE `MasterGstRate` for SALES and/or PURCHASE as-of date |
| Expiring rates | `dateTo` within horizon (default 30d); CRITICAL ≤7d |
| Overlaps | Concurrent ACTIVE windows same group + applicability (resolve ambiguity) |
| Ledger drift | Advisory compare of GST ledger component rates vs current master (via snapshot itemId / HSN → group). **Never rewrites posted tax** |
| Usage impact | Period roll-up by GST group for change planning |
| Evidence runs | Persist full report JSON (`gst_rate_ops_runs`); optional acknowledge |
| Ledger stamp | Future SI/VI posts store `itemId` on `sourceSnapshot` for better drift matching |
| FE | `/accounting/tax-compliance/gst/rate-ops` dual-mode (demo fixture; API live) |

---

## Migration

`20260806010000_gst_phase16_rate_ops`

Creates only `gst_rate_ops_runs`. Does **not** alter master rate tables or posted tax tables.

Ordered after GST phases 12–15 migrations.

---

## Permissions

| Code | Use |
|------|-----|
| `tax.gst.rates.view` | Read coverage / drift / report / runs |
| `tax.gst.rates.manage` | Persist / acknowledge evidence runs |

Also accepted: `tax.gst.view`, `finance.tax.view`, `tax.gst.setup.manage`, `tax.gst.reconcile` (drift read).

Finance Manager role pack includes both.

---

## API (`…/tax-compliance/rate-ops`)

| Method | Path |
|--------|------|
| GET | `/capability` |
| GET | `/coverage?asOfDate&horizonDays` |
| GET | `/drift?legalEntityId&returnPeriod` |
| GET | `/report?legalEntityId&returnPeriod` |
| GET | `/runs?legalEntityId` |
| POST | `/runs` |
| POST | `/runs/:id/acknowledge` |

Feature flag: `GST_PHASE16_RATE_OPS_ENABLED` (default **true**).

---

## Tests

`backend/tests/gst-rate-ops-phase16.test.ts` — pure unit (coverage, expiry, overlap, drift, score, capability honesty).

Evidence (this session): run vitest on that file.

---

## READY WITH CONDITIONS

1. `npx tsx scripts/prisma-cli.ts migrate deploy` including `20260806010000_gst_phase16_rate_ops`  
2. `npm run db:sync-permissions` for `tax.gst.rates.*`  
3. Maintain HSN / GST group / item `gstGroupId` mappings in masters  
4. Treat drift as advisory — correct masters or issue CN/DN; do not re-open filed periods to silent re-rate  
5. Historical ledger rows without item/HSN linkage will produce INFO findings only  
6. Optional disable: `GST_PHASE16_RATE_OPS_ENABLED=false`

---

## Still NOT ready

- FULL GST COMPLIANT  
- LIVE GST portal GSTR submit (Phase 12 gated)  
- Automatic rate change bulk re-post of historical invoices  
- Cess first-class on `MasterGstRate` (still product backlog)  
- GSTR-9/9C certification / portal annual file  

---

## Collision notes (12–15)

- Did **not** touch portal filing sessions, compliance hardening, annual worksheets, notices, or audit packs.  
- Fixed missing Phase 14/15 schema imports on `tax-compliance.routes.ts` so sibling routes compile (import-only, no behaviour rewrite).  
- Parallel Phase 14 + 15 both defined notices migrations historically — that pre-existed; Phase 16 uses a **new** table only.

**Stop for product review before claiming broader tax “complete.”**
