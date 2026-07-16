# React Update Loop Fix Report

**Date:** June 2026  
**Trigger route:** `/purchase/requisitions/new` (Manual PR create)  
**Error:** `Maximum update depth exceeded`

---

## Root Cause

Zustand selectors that **return a new array or object on every evaluation** — even when underlying store data is unchanged — cause React to schedule endless re-renders.

Common anti-patterns found after the UI/UX rollout:

```tsx
// BAD — new array every selector run → infinite loop
useMasterStore((s) => s.items.filter((i) => i.isActive))

// BAD — store getter returns new array every call
usePurchaseStore((s) => s.getPendingPrReport())

// BAD — inline function selector returns new closure
useWorkOrderStore((s) => (opId) => s.productionOperations.find(...))
```

Zustand compares selector output with `Object.is`. A freshly allocated array/object fails that check → re-render → selector runs again → loop until React throws.

Secondary contributor: **`trackPageVisit`** always wrote a new `recentPages` array (new `visitedAt`), causing unnecessary store churn on layout re-mounts / Strict Mode double effects.

---

## Files Fixed

| File | Change |
|------|--------|
| `src/hooks/useStableStoreData.ts` | **New** — stable derived-data hooks for reports, quality, sales, BOM, WO |
| `src/hooks/useMasterLists.ts` | Added `usePurchasableItems`, `useActiveCustomers` |
| `src/modules/purchase/ManualPrFormPage.tsx` | Use stable item/warehouse hooks |
| `src/modules/sales/SalesForms.tsx` | Stable customers/leads/products |
| `src/modules/sales/SalesPages.tsx` | `usePendingCustomerApprovals()` |
| `src/modules/quality/QualityPages.tsx` | Stable metrics / pending / rework / NCR hooks |
| `src/modules/quality/QualityProductionPages.tsx` | Stable report hooks |
| `src/modules/purchase/PurchaseProductionPages.tsx` | `usePurchaseReports()` |
| `src/modules/dispatch/DispatchProductionPages.tsx` | `useDispatchReports()` |
| `src/modules/workorder/WorkOrderPages.tsx` | Stable WO inspections & reworks |
| `src/modules/masters/product/ProductDetailPage.tsx` | `useProductBomHeaders()` |
| `src/modules/masters/work-center/WorkCenterPages.tsx` | `useActiveWarehouses()` |
| `src/modules/control-towers/ShopFloorJobQueuePage.tsx` | `useCallback` for operation lookup |
| `src/store/uiStore.ts` | Skip duplicate `trackPageVisit` within 500ms + console.warn |
| `src/components/layout/PageTracker.tsx` | Pathname-only effect; `getState()` for tracking |
| `src/components/layout/AppShell.tsx` | Wrap `<Outlet />` in `AppErrorBoundary` |
| `src/components/system/AppErrorBoundary.tsx` | **New** — friendly crash UI + route error page |
| `src/routes/index.tsx` | `errorElement: <RouteErrorPage />` on root route |

---

## Patterns Removed

1. `.filter()` / `.map()` inside Zustand selectors  
2. Store getter methods called inside selectors (`getMetrics()`, `getOpenPoReport()`, etc.)  
3. Inline function selectors returning new closures  
4. Unstable `useEffect` deps for page tracking (`trackPageVisit` in dependency array)  
5. Unconditional recent-page writes on every effect fire  

---

## Safe Patterns (use going forward)

```tsx
// GOOD — raw slice + useMemo
const items = useMasterStore((s) => s.items)
const purchasable = useMemo(() => items.filter(...), [items])

// GOOD — dedicated hook
const { pending, openPo } = usePurchaseReports()

// GOOD — stable effect for route tracking
useEffect(() => {
  useUIStore.getState().trackPageVisit({ path: pathname, label })
}, [pathname])

// GOOD — useCallback for derived lookups
const getOperation = useCallback(
  (id) => ops.find((o) => o.id === id),
  [ops],
)
```

---

## Routes Verified

- `/purchase/requisitions/new` — Manual PR create (**primary fix**)
- `/purchase/requisitions` — PR register
- `/sales/quotations` — previously fixed; re-verified via build
- `/quality`, `/quality/queue`, `/quality/ncr` — report/metrics pages
- `/masters/work-centers/new` — warehouse select form
- `/shop-floor` — job queue operation lookup
- All routes — `AppErrorBoundary` + `RouteErrorPage` on crash

---

## Test Results

| Command | Result |
|---------|--------|
| `npm run build` | ✅ Pass |
| `npm run test` | ✅ 52 checks pass |
| `npm run test:wo-flow` | ✅ 60 pass |
| `npm run test:quality` | ✅ 26 pass |

---

## Preventive Rules

1. **Never** call `.filter()`, `.map()`, or spread inside a Zustand selector.  
2. **Never** call store getter methods that return collections inside selectors — use `getState()` inside `useMemo` with raw slice deps.  
3. **Never** call `setState` / `store.set` / `trackPageVisit` during render.  
4. **Memoize** columns, filter chips, insights, and command bar actions with `useMemo` / `useCallback`.  
5. **Page tracking** — pathname-only `useEffect`, dedupe writes within 500ms.  
6. Prefer **`useStableStoreData`** / **`useMasterLists`** hooks for shared derived lists.  
7. Use **`AppErrorBoundary`** so users see a recovery screen instead of the React Router crash page.
