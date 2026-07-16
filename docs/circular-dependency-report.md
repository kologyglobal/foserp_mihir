# Circular Dependency Report

**Date:** 2026-07-11  
**Method:** Static analysis of known barrel exports, store↔bridge↔api patterns, bootstrap chains

---

## Executive summary

| Severity | Count | Action |
|----------|-------|--------|
| Confirmed cycles | 0 (runtime) | Monitor |
| High risk patterns | 4 | Avoid new barrels; lazy imports |
| Medium risk | 6 | Document; fix during migration |
| Low risk | 10+ | Acceptable |

No production-blocking circular dependency confirmed, but **several patterns could become cycles** during restructuring if barrels are expanded carelessly.

---

## High-risk patterns

### 1. Store ↔ Bridge ↔ Store

```
crmStore.ts → (dynamic) import crmApiBridge
crmApiBridge.ts → import useCrmStore, useSalesStore, useMasterStore
```

**Status:** Bridge uses `useXStore.setState` not hooks — **no React cycle**.  
**Risk:** If bridge imports store actions that import bridge synchronously → cycle.  
**Mitigation:** Keep bridge as leaf; stores use dynamic `import()` for API mode (already done in crmStore).

### 2. `components/crm/index.ts` barrel

Exports quotation components that import from `store/` and `types/`.

**Risk:** If `crmStore` ever imports from `components/crm/index.ts` → cycle.  
**Current:** Store does not import component barrel — **safe**.  
**Mitigation:** Do not import barrels from stores.

### 3. AuthProvider ↔ crmApi

```
AuthProvider → crmApi (re-exports auth)
crmApi.ts → types from crm/sales
client.ts → config
```

**Status:** Linear — **safe**.

### 4. `design-system/index.ts` ↔ modules

Some design-system workspace components import CRM types for generic panels.

**Mitigation:** Keep domain types out of design-system; use generics/props.

---

## Medium-risk patterns

| Pattern | Files | Notes |
|---------|-------|-------|
| Dynamic bootstrap import | `crmStore` → `store/bootstrap/crmBootstrap` | Async — safe |
| `crmApi.ts` re-exports auth | `crmApi` → `crmApiAuth` | Fine if auth doesn't import crmApi |
| Master store seeds | `masterStore` → `data/masters/seed` | data must not import store |
| ERP startup | `main.tsx` → `bootstrap/erpStartup` → stores | One-way |
| Route page → component → store → bridge | Common | OK if bridge doesn't import page |
| Test scripts → src stores | scripts import stores directly | Test-only |

---

## Barrel exports inventory

| Barrel | Re-exports | Cycle risk |
|--------|------------|------------|
| `components/crm/index.ts` | CRM + quotation UI | Medium |
| `components/erp/index.ts` | ERP primitives | Low |
| `components/premium/index.ts` | Dashboard widgets | Low |
| `design-system/index.ts` | All DS modules | Low |
| `modules/crm/index.ts` | Pages only | Low |
| 12× `modules/*/index.ts` | Module pages | Low |

**Recommendation:** During migration, **do not** create `services/index.ts` or `store/index.ts` mega-barrels.

---

## Known async breakers (not cycles)

| Issue | Location | Fix phase |
|-------|----------|-----------|
| `crmApi.ts` parse error on bad `extends import()` | Fixed in P0-2 | Done |
| HMR Fast Refresh incompatible exports | Multiple components | Document only |

---

## Forbidden import rules (for structure test)

```
store/*           → MUST NOT import from modules/*
store/*           → MUST NOT import from components/* (except types via type-only)
design-system/*   → MUST NOT import from modules/*
data/*            → MUST NOT import from store/* or services/*
services/api/*    → MUST NOT import from store/*
bootstrap/*       → MAY import store (orchestration layer)
modules/*         → MAY import components, store, hooks, services/bridges
```

---

## Detection plan (Phase 22)

Add to `scripts/test-folder-structure.ts`:

1. `madge --circular src/` (if added as devDep) OR custom DFS on import graph  
2. Fail on `store → components` imports  
3. Fail on `data → services` imports  
4. Warn on barrel depth > 2  

---

## Actions before Phase 4+ moves

- [ ] Run `npm run typecheck` baseline  
- [ ] Add circular import check to freeze gate  
- [ ] Ban new barrel exports without review  
- [ ] Prefer `import type` for cross-layer type sharing  

---

## Verdict

**No mandatory cycle fixes before migration.** Proceed with incremental moves and compat re-exports. Re-run this report after Phase 5 (quotations split) — highest cycle risk phase due to store extraction.
