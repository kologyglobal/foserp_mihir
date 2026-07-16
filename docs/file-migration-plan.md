# File Migration Plan

**Date:** 2026-07-11  
**Status:** Phase 1 complete — **no file moves executed yet**  
**Strategy:** Incremental by domain; verify after each phase

---

## Phase 0 — Prerequisites (this session)

| # | Task | Output | Status |
|---|------|--------|--------|
| 0.1 | Structure audit | 6 analysis docs | ✅ |
| 0.2 | Folder placement rules | `FILE_PLACEMENT_RULES.md` | ✅ |
| 0.3 | Route path snapshot | Phase 4 test spec | Pending |

---

## Phase 1 — Foundation (low risk, no page moves)

| # | Task | Files | Depends | Verify |
|---|------|-------|---------|--------|
| 1.1 | Add path aliases | `tsconfig.app.json`, `vite.config.ts` | — | `npm run typecheck` |
| 1.2 | Create `config/` layer | `environment.ts`, `apiConfig.ts`, `appConfig.ts`, `featureFlags.ts` | — | Re-export from old `config.ts` |
| 1.3 | Create `bootstrap/index.ts` | Wire `erpStartup`, `crmBootstrap`, API sync entry | 1.2 | Demo + API login |
| 1.4 | Add `services/bridges/` | Move 4 bridge files with compat re-exports | 1.1 | `test:crm-integration` |
| 1.5 | Rename `crmApiAuth.ts` → `authApi.ts` | Compat re-export | — | Login flow |
| 1.6 | Add `scripts/test-folder-structure.ts` | Structure gate | — | `test:folder-structure` |
| 1.7 | Add route integrity test | Snapshot 282 paths | 2.x | CI |

**Estimated files touched:** ~15 new, ~10 modified, 0 deleted

---

## Phase 2 — Routes split

| # | Task | Source | Target |
|---|------|--------|--------|
| 2.1 | Extract auth routes | `routes/index.tsx` | `routes/authRoutes.tsx` |
| 2.2 | Extract CRM routes | same | `routes/crmRoutes.tsx` |
| 2.3 | Extract quotation routes | same | `routes/quotationRoutes.tsx` |
| 2.4 | Extract master routes | same | `routes/masterRoutes.tsx` |
| 2.5 | Extract purchase routes | same | `routes/purchaseRoutes.tsx` |
| 2.6 | Extract inventory routes | same | `routes/inventoryRoutes.tsx` |
| 2.7 | Extract production/MRP routes | same | `routes/productionRoutes.tsx` |
| 2.8 | Extract quality routes | same | `routes/qualityRoutes.tsx` |
| 2.9 | Extract mobile routes | same | `routes/mobileRoutes.tsx` |
| 2.10 | Compose in `routes/index.tsx` | — | `< 80 lines imports + spread |

**Verify:** Route integrity test, manual URL spot-check, `npm run build`

---

## Phase 3 — Auth module

| File | From | To | Compat export |
|------|------|-----|---------------|
| LoginPage | `pages/auth/LoginPage.tsx` | `modules/auth/LoginPage.tsx` | `pages/auth/LoginPage.tsx` re-export (temp) |
| ApiAuthGate | same file | `modules/auth/ApiAuthGate.tsx` | — |

---

## Phase 4 — CRM (pages stay, components tidy)

| # | Task | Risk |
|---|------|------|
| 4.1 | Move `CrmCardFormShell` to `components/crm/` | Low |
| 4.2 | Optional subfolders `modules/crm/leads/`, `opportunities/` | Medium — many imports |
| 4.3 | Split `crmApi.ts` — keep CRM core, no quotation endpoints | Medium |
| 4.4 | Ensure no new direct API calls in pages | Low |

**Verify:** `test:crm-integration`, `test:crm-live` (backend)

---

## Phase 5 — Quotations module

| # | Task | Risk |
|---|------|------|
| 5.1 | Create `modules/quotations/` | — |
| 5.2 | Move 3 quotation pages from `modules/crm/` | Medium — routes update |
| 5.3 | Move `components/crm/Quotation*` → `components/quotations/` | Medium |
| 5.4 | Extract `quotationApi.ts` from `crmApi.ts` | Medium |
| 5.5 | Extract `quotationApiBridge.ts` | Medium |
| 5.6 | Extract `store/quotationStore.ts` from `salesStore` | **High** — defer if blocked |
| 5.7 | Move `data/crm/quotationTemplates.ts` → `data/quotations/` | Low |

**Verify:** Quotation list/editor/360, `test:quotation-template-builder`, quotation E2E

---

## Phase 6 — Masters

| # | Task | Risk |
|---|------|------|
| 6.1 | Consolidate `data/masters/` (already good) | Low |
| 6.2 | Move root `data/*.ts` legacy into domain folders | Medium |
| 6.3 | `masterRoutes.tsx` already in Phase 2 | — |

---

## Phase 7 — Purchase, inventory, production, quality

One domain per PR:

1. Route file already split  
2. Audit `modules/{domain}/` for misplaced shared components  
3. Move to `components/{domain}/`  
4. Run domain test script  

---

## Phase 8 — Demo / data isolation

| # | Task |
|---|------|
| 8.1 | Create `demo/seeds/`, `demo/factories/`, `demo/scenarios/` |
| 8.2 | Move factory logic from `store/bootstrap/crmBootstrap.ts` |
| 8.3 | Add test: API mode must not import `data/**/seed` in services |
| 8.4 | Gate: `isApiMode()` guards unchanged |

---

## Phase 9 — Utils & types split

| # | Task |
|---|------|
| 9.1 | `utils/formatters/` ← `format.ts`, currency helpers |
| 9.2 | `utils/permissions/` ← `permissions.ts`, `crmPermissions.ts` |
| 9.3 | `utils/dates/` ← date helpers |
| 9.4 | `types/quotation.ts` ← extract from `crm.ts` + `sales.ts` |
| 9.5 | Compat re-exports from old paths (temporary) |

---

## Phase 10 — Backend alignment (optional, low priority)

| # | Task |
|---|------|
| 10.1 | Document `backend/src/shared/` consolidation plan |
| 10.2 | Add `entity.mapper.ts` where missing (quotations?) |
| 10.3 | Do **not** move quotations out of `crm/` |

---

## Phase 11 — Cleanup

- Remove compat re-exports  
- Remove empty folders (`pages/`)  
- Remove confirmed duplicate UI (documented first)  
- Run full freeze gate  

---

## Rollback strategy

Each phase is one git commit. Rollback = revert single commit. Temporary re-exports allow old import paths for 1–2 phases max.

---

## Effort estimate

| Phase | Effort | Blocking |
|-------|--------|----------|
| 1 Foundation | 0.5–1 day | None |
| 2 Routes | 1 day | Phase 1 aliases |
| 3 Auth | 0.5 day | Phase 2 |
| 4 CRM | 1–2 days | Phase 2 |
| 5 Quotations | 2–3 days | Phase 4 |
| 6–7 Other domains | 3–5 days | Phase 2 |
| 8–11 | 2–3 days | Prior phases |

**Total:** ~2–3 weeks incremental, not one operation.

---

## Final verdict target

**Conversion Complete** only when structure integrity test + freeze gate + CRM/quotation live E2E pass.

**Current verdict:** **Conversion Blocked on Phase 1 mapping** → ready to begin Phase 1 foundation after review.
