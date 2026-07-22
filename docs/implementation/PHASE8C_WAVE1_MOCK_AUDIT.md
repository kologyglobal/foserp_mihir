# Phase 8C Wave 1 — Mock / Demo Leakage Audit

**Date:** 2026-07-21  
**Closes:** `8B-R-010` (pilot SOP routes)  
**Prior audit:** [`docs/audit/PHASE8A_MOCK_DEMO_AUDIT.md`](../audit/PHASE8A_MOCK_DEMO_AUDIT.md)  
**Mode under test:** `VITE_USE_API=true` (pilot / production configuration)

---

## 1. Executive summary

| Metric | Count |
|--------|------:|
| Phase 8A P1 leakage candidates re-audited | **16** |
| **BLOCKING** findings on pilot SOP routes after remediation | **0** |
| BLOCKING findings remapped to hard-stop / redirect | **15** (+ prior mfg accounting gate) |
| CONTROLLED_DEMO services retained (route-gated) | **5** allowlisted in isolation gate |
| TEST_ONLY / SAFE_CONSTANT / NON_PILOT / DEAD_CODE | documented below |

**Verdict:** With `VITE_USE_API=true`, pilot SOP routes cannot silently render seed/demo operational records. Demo mode (`VITE_USE_API=false`) remains intact and shows a global **Demo mode — sample data** indicator.

---

## 2. Classification legend (Wave 1)

| Class | Meaning |
|-------|---------|
| **BLOCKING** | Mock/demo can appear during normal pilot API operation |
| **CONTROLLED_DEMO** | Explicit demo flag path; impossible under pilot `VITE_USE_API=true` |
| **TEST_ONLY** | Tests / fixtures only |
| **DEAD_CODE** | Unreachable / superseded |
| **NON_PILOT** | Reachable but outside frozen pilot SOP (still gated where risky) |
| **SAFE_CONSTANT** | Labels, permission maps, non-transactional metadata |

---

## 3. Burn-down of Phase 8A §3 (16 candidates)

| # | Surface (8A) | Classification after Wave 1 | Fix | Status |
|---|--------------|-----------------------------|-----|--------|
| 1 | Manufacturing Accounting workspace | CONTROLLED_DEMO (prior 8B-R-011) | `ManufacturingAccountingApiGate` | **CLOSED** |
| 2 | Legacy AR `/accounting/receivables/*` | CONTROLLED_DEMO | API mode → `Navigate` Money In | **CLOSED** |
| 3 | Legacy AP `/accounting/payables/*` | CONTROLLED_DEMO | API mode → `Navigate` Money Out | **CLOSED** |
| 4 | Financial reports UI | CONTROLLED_DEMO | `demoOnlyRoute` hard-stop | **CLOSED** |
| 5 | Bank accounts / cash / transactions seed | CONTROLLED_DEMO | `demoOnlyRoute` hard-stop | **CLOSED** |
| 6 | Live activity mock chrome | CONTROLLED_DEMO | `useLiveActivityMock` no-ops when `isApiMode()` | **CLOSED** |
| 7 | Live factory pulse store linkage | CONTROLLED_DEMO | `useLiveFactoryPulse` skips mock + store reads in API mode | **CLOSED** |
| 8 | Quality NCR / rework / reports | CONTROLLED_DEMO | `demoOnlyRoute` on those routes; incoming remains EXCLUDED | **CLOSED** (pilot path) |
| 9 | Dispatch demo plan/scan/reports/gate-pass | CONTROLLED_DEMO | `demoOnlyRoute`; workbench/register stay dual LIVE_API | **CLOSED** (pilot path) |
| 10 | Legacy BOM register | CONTROLLED_DEMO | Redirect → `/manufacturing/setup/boms` | **CLOSED** |
| 11 | Legacy routes / production plan | CONTROLLED_DEMO | Routes redirect; plan gated | **CLOSED** |
| 12 | Job work register | LIVE_API / CONTROLLED_DEMO | Service already dual-mode (`isApiMode` → API) | **CLOSED** |
| 13 | Manufacturing settings | CONTROLLED_DEMO | `demoOnlyRoute` | **CLOSED** |
| 14 | Manufacturing reports | LIVE_API | Catalog already switches `isApiMode()` → ops reports API | **CLOSED** |
| 15 | WO edit path | CONTROLLED_DEMO | Redirect → live WO detail | **CLOSED** |
| 16 | CoA / vouchers legacy | CONTROLLED_DEMO / REDIRECT | Prior redirects retained; CoA service allowlisted | **CLOSED** |

---

## 4. New / related findings this session

| File | Finding | Classification | Pilot impact | Fix | Status |
|------|---------|----------------|--------------|-----|--------|
| `hooks/useLiveActivityMock.ts` | Mock ticker always on | BLOCKING → CONTROLLED_DEMO | Fake events on workspaces | Gate with `!isApiMode()` | **FIXED** |
| `hooks/useLiveFactoryPulse.ts` | Merged mock + demo Zustand | BLOCKING → CONTROLLED_DEMO | Fake pulse | Full disable in API mode | **FIXED** |
| `routes/inventoryRoutes.tsx` | Entire inventory SPA demo | BLOCKING → CONTROLLED_DEMO | Fake stock | All routes → `ApiModeDemoGatePage` | **FIXED** (also 8B-R-015) |
| `routes/productionRoutes.tsx` | MRP + barcode scan demo posts | BLOCKING → CONTROLLED_DEMO | False success risk | `demoOnlyRoute` / redirects | **FIXED** |
| `routes/dispatchFinanceRoutes.tsx` | Invoices / costing demo | BLOCKING → CONTROLLED_DEMO | Fake AR/cost | `demoOnlyRoute` | **FIXED** |
| `components/layout/AppShell.tsx` | No global demo indicator | — | Operator confusion in demo | Amber badge when `!isApiMode()` | **FIXED** |
| `services/accounting/taxComplianceApiComposer.ts` | API composer imported `TAX_PERIODS` seed | NON_PILOT / hygiene | Seed period list in API helper | Compute periods without seed import | **FIXED** |
| `utils/roleExperienceMetrics.ts` | Home KPIs from demo Zustand | NON_PILOT / residual | Empty or stale counters on `/home` in API mode (not transactional docs) | Documented residual — empty when stores empty; not SOP transactional screens | **OPEN residual** |
| `services/erpAnalyticsService.ts` | Same family as role metrics | NON_PILOT / residual | Same | Same | **OPEN residual** |

---

## 5. Grep inventory (Wave 1 pass)

Patterns searched under `frontend/src` (selected): `mock`, `mockData`, `demoData`, `seedData`, `fallbackData`, `fakeData`, `fixture`, `isDemo`, `demoMode`, `useMock`, `VITE_USE_MOCK`, `Math.random`, `Promise.resolve`, `localStorage`, `useLiveActivityMock`.

| Pattern | Result |
|---------|--------|
| `useLiveActivityMock` / pulse | Gated — CONTROLLED_DEMO |
| `Math.random` in live ticker | Only inside gated mock hook |
| Seed imports in `src/services/` | Isolation gate PASS with explicit CONTROLLED_DEMO allowlist |
| `VITE_USE_API` | Single source: `environment.useApi` → `isApiMode()` |
| Catch → mockData on pilot pages | Not found on dual-routed SOP pages |

---

## 6. Demo / API separation (Part 5)

| Rule | Evidence |
|------|----------|
| One config source | `frontend/src/config/environment.ts` → `useApi: VITE_USE_API === 'true'` |
| Default for pilot | Local `.env` and host package: `VITE_USE_API=true` |
| No mixed records on gated pages | Gate mounts **instead of** demo page — demo services never run |
| Visible demo indicator | AppShell amber pill when `!isApiMode()` |
| Isolation test | `npm run test:demo-api-isolation` PASS |
| Wave 1 static gate | `npm run test:phase8c-wave1` **55/55** PASS |

Allowlisted CONTROLLED_DEMO services (cannot render via pilot SOP routes in API mode):

- `workOrderService.ts` (legacy form/detail)
- `routeService.ts` (legacy routing UI)
- `purchaseService.ts` (purchase demo — NON_PILOT)
- `chartOfAccountsService.ts` (legacy CoA)
- `financialReportsService.ts` (reports gated)

---

## 7. API response unwrapping (Part 6)

Confirmed retained correct after Wave 0:

| Area | Pattern |
|------|---------|
| `dispatchApi.ts` | `apiRequest(path, RequestInit)` + unwrap |
| `qualityApi.ts` | same |
| Store workbench | unwraps `ApiResponse.data` |
| Incoming QC | unwraps `ApiResponse.data` |

No additional double-unwrap defects found on pilot SOP dual-route pages in this pass. New route gates do not call APIs (hard-stop UI).

---

## 8. Automated evidence

```text
frontend: npm run test:phase8c-wave1          → 55 passed, 0 failed
frontend: npm run test:demo-api-isolation     → PASSED
frontend: npm run test:route-integrity        → PASSED (baseline refreshed 855 paths)
frontend: npx tsc -b --force                  → exit 0
frontend: npm run build                       → exit 0
backend:  npx tsc --noEmit                    → exit 0 (after unrelated packing/pagination fixes)
```

---

## 9. Closure for 8B-R-010

| Criterion | Met? |
|-----------|------|
| Every pilot SOP route has identified data source | **Yes** — route matrix |
| No pilot API route silently displays mock records | **Yes** |
| Demo mode isolated and explicitly controlled | **Yes** |
| API failures show errors (AppShell hydrate + page patterns) | **Yes** |
| Empty ≠ failure | **Yes** on dual-route pages |
| Automated tests prove API mode cannot invoke mock fallback | **Yes** (`test:phase8c-wave1` + isolation) |
| Audit evidence documented | **This file** |

**Residual (accepted for internal UAT):** Home/executive chrome may show empty or zero KPIs derived from empty demo Zustand slices — not transactional SOP screens; operators use Today / WO / QC / Money In-Out.
