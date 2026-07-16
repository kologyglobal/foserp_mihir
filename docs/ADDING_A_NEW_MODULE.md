# Adding a New Module

Step-by-step guide for adding a new ERP business area to FOS ERP (frontend + backend).

---

## 1. Plan the domain

- Choose domain slug: e.g. `quotations`, `purchase`, `inventory`
- List route pages (list, create, edit, 360)
- List reusable components (tables, forms)
- Decide: demo-only, API-only, or dual-mode

---

## 2. Frontend — folders to create

```
modules/{domain}/           # Route pages
components/{domain}/          # Reusable widgets
data/{domain}/                # Demo seeds (if demo mode)
types/{domain}.ts             # Shared types
store/{domain}Store.ts        # Zustand slice
routes/{domain}Routes.tsx     # Route definitions
```

Optional (API mode):

```
services/api/{domain}Api.ts
services/bridges/{domain}ApiBridge.ts
hooks/use{Domain}ApiSync.ts   # if full hydration needed
```

---

## 3. Frontend — routes

1. Add routes to `routes/{domain}Routes.tsx`
2. Import route group in `routes/index.tsx`
3. Preserve URL prefix convention: `/{workspace}/{resource}`
4. Add route path to integrity test snapshot

---

## 4. Frontend — store pattern

```typescript
// store/exampleStore.ts
import { isApiMode } from '@/config/appConfig'
import * as bridge from '@/services/bridges/exampleApiBridge'

export const useExampleStore = create(
  persist(
    (set, get) => ({
      items: [],
      createItem: async (input) => {
        if (isApiMode()) {
          const result = await bridge.createItemViaApi(input)
          if (!result.ok) return result
          // bridge updates store
          return { ok: true }
        }
        // demo: local mutation
        set((s) => ({ items: [...s.items, newItem] }))
        return { ok: true }
      },
    }),
    {
      partialize: (s) => ({
        items: isApiMode() ? [] : s.items,
      }),
    },
  ),
)
```

---

## 5. Frontend — API bridge

```typescript
// services/bridges/exampleApiBridge.ts
import * as api from '@/services/api/exampleApi'
import { useExampleStore } from '@/store/exampleStore'

export async function syncExamplesFromApi() {
  const rows = await api.fetchAllPages('/examples')
  useExampleStore.setState({ items: rows })
}

export async function createItemViaApi(input: CreateInput) {
  const res = await api.createExample(input)
  useExampleStore.setState((s) => ({
    items: [mapDto(res.data), ...s.items],
  }))
  return { ok: true }
}
```

---

## 6. Backend — module scaffold

```
backend/src/modules/{parent}/{entity}/
  entity.routes.ts       # requirePermission + validateBody/Query
  entity.controller.ts   # sendSuccess / sendPaginated
  entity.service.ts      # business rules
  entity.repository.ts   # Prisma only
  entity.validation.ts   # Zod schemas
  entity.types.ts
```

1. Add Prisma model + migration  
2. Add permissions to `constants/permissions.ts`  
3. Seed permissions in `prisma/seed.ts`  
4. Register router in parent `*.routes.ts`  
5. Add live E2E test  

---

## 7. Permissions

Naming: `{module}.{resource}.{action}`

Example: `crm.quotation.create`, `purchase.order.view`

Frontend: check session permissions via `canCrmPermission()` or generic helper.

---

## 8. Tests to add

| Layer | Test |
|-------|------|
| Frontend unit | `scripts/test-{domain}.ts` |
| Frontend integration | Store + bridge smoke |
| Backend unit | Vitest in `backend/tests/` |
| Backend live E2E | Extend `crm-e2e.test.ts` or new file |
| Structure | Route in folder-structure test |

---

## 9. Documentation

Update after implementation:

- `docs/API_CONVENTIONS.md` — new endpoints  
- `docs/FRONTEND_BACKEND_INTEGRATION.md` — bridge entry  
- `docs/PROJECT_STATUS.md` — module status  
- `docs/SESSION_CHANGELOG.md` — session entry  

---

## 10. Checklist

- [ ] Pages in `modules/{domain}/` only  
- [ ] Reusable UI in `components/{domain}/`  
- [ ] No direct fetch in pages (except approved hooks)  
- [ ] Demo/API separation enforced  
- [ ] Routes registered and integrity test updated  
- [ ] Permissions seeded  
- [ ] typecheck + build pass  
- [ ] Domain regression script pass  

---

## Reference implementations

Copy patterns from these mature modules:

| Pattern | Reference |
|---------|-----------|
| Full API CRUD + bridge | CRM opportunities (`crmApiBridge.ts`) |
| 360 + notes/attachments | `Opportunity360Page`, `useEntityNotes` |
| Master registry | Backend `masters/master.registry.ts` |
| Paginated sync | `fetchAllCrmPages` in `crmApi.ts` |
| Workflow actions | Quotation approval lifecycle |
