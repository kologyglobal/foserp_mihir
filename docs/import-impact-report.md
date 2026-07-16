# Import Impact Report

**Date:** 2026-07-11  
**Scope:** Estimated import churn for planned migration phases

---

## Summary

| Migration action | Files affected (est.) | Import statements (est.) | Severity |
|------------------|----------------------|--------------------------|----------|
| Add path aliases only | 0 required initially | 0 (opt-in adoption) | Low |
| Split `routes/index.tsx` | 1 → 11 | ~150 import lines redistributed | Medium |
| Move `pages/auth/` → `modules/auth/` | ~5 | ~8 | Low |
| Move bridges to `services/bridges/` | 4 bridges + ~40 consumers | ~60 | Medium |
| Rename `crmApiAuth` → `authApi` | ~5 | ~5 | Low |
| Split `crmApi.ts` (quotations) | ~15 | ~20 | Medium |
| Move quotation pages/components | ~25 | ~80 | High |
| Extract `quotationStore` from `salesStore` | ~50+ | ~100+ | **Critical** |
| Utils subfolder moves | ~80 | ~200 | Medium (automatable) |
| Config layer extraction | ~30 | ~30 | Medium |

**Total estimated import updates (full migration):** 500–800 statements

---

## High-fanout files (change these carefully)

These files are imported most widely; any move requires compat re-exports:

| File | Importers (est.) | Role |
|------|------------------|------|
| `store/crmStore.ts` | 80+ | CRM state |
| `store/salesStore.ts` | 60+ | Sales + quotations |
| `store/masterStore.ts` | 50+ | Masters |
| `store/uiStore.ts` | 40+ | Shell UI |
| `services/api/crmApiBridge.ts` | 15+ | CRM writes |
| `services/api/client.ts` | 20+ | HTTP |
| `services/api/config.ts` | 25+ | API mode |
| `components/crm/index.ts` | 30+ | Barrel — quotation exports |
| `routes/index.tsx` | 1 (router) | 150+ page imports |
| `context/AuthProvider.tsx` | 10+ | Auth |
| `utils/format.ts` | 50+ | Dates/currency |
| `types/crm.ts`, `types/sales.ts` | 100+ | Types |

---

## Direct API imports from pages (audit)

**Finding:** No `services/api/crmApi` or `client` imports detected directly under `modules/**/*.tsx` via static grep.

**Allowed direct API hooks (keep):**

| Hook / util | Imports API | OK |
|-------------|-------------|-----|
| `hooks/useEntityNotes.ts` | `crmApi` | ✓ |
| `hooks/useEntityAttachments.ts` | `crmApi` | ✓ |
| `hooks/useCrmDashboardApiMetrics.ts` | `crmApi` | ✓ |
| `hooks/useCrmGlobalSearch.ts` | `crmApi` | ✓ |
| `hooks/useCrmReport.ts` | `crmApi` | ✓ |
| `hooks/useItemLookup.ts` | `masterBatchApi` | ✓ |
| `hooks/useMasterApiSync.ts` | bridge | ✓ |
| `hooks/useCrmApiSync.ts` | bridge | ✓ |
| `pages/auth/LoginPage.tsx` | auth + config | ✓ |

**Pages using bridges indirectly:** All CRM pages via Zustand store actions.

---

## Relative import depth problem

Without path aliases, deep modules use fragile paths:

```
../../../store/crmStore
../../../services/api/crmApiBridge
../../../../components/crm/QuotationBuilder
```

**Impact of `@/` aliases:** Reduces move churn by ~40% — imports become stable when folders shift.

---

## Barrel export import impact

| Barrel | Exports | Cycle risk |
|--------|---------|------------|
| `components/crm/index.ts` | 30+ components + quotation widgets | Medium — imports store types |
| `design-system/index.ts` | Re-exports all DS | Low |
| `modules/crm/index.ts` | Page exports | Low |
| `store/selectors/index.ts` | Selectors | Low |

**Rule for migration:** Do not add new barrels until cycles resolved. Prefer direct imports during moves.

---

## Test import paths

~90 scripts under `trailer-erp/scripts/` import from `../src/...`. Any store/service move must update:

- `scripts/test-crm-integration.ts`
- `scripts/test-quotation-template-builder.ts`
- `scripts/frontend-freeze-gate.ts`
- `scripts/test-integrity-check.ts`

**Estimate:** 40–60 script files reference `src/` paths.

---

## Backend import impact

Backend restructuring is **minimal**:

- Optional `shared/` folder move affects ~20 internal imports
- **No** frontend import impact
- **No** API URL changes

---

## Recommended import migration tooling

1. TypeScript language service rename/move (IDE)  
2. `rg` verification after each phase  
3. `npm run typecheck` gate  
4. Temporary compat files:

```typescript
// services/api/crmApiBridge.ts (compat)
export * from '../bridges/crmApiBridge.ts'
```

5. Remove compat after 1 phase when `rg` shows zero old paths

---

## Phase 1 import changes (safe first step)

Only these files need import updates in Phase 1:

| New file | Imports from |
|----------|--------------|
| `config/environment.ts` | `import.meta.env` |
| `config/apiConfig.ts` | wraps environment |
| `config/appConfig.ts` | composes configs |
| `services/api/config.ts` | re-exports `config/apiConfig` (compat) |

**Zero page import changes** if compat re-exports maintained.
