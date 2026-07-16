# File Placement Rules

Quick decision guide for where new or moved files belong in FOS ERP frontend.

---

## Decision tree

```
Is it a route-level page (mounted by React Router)?
  YES → modules/{domain}/

Is it reusable UI used by 2+ pages or exported as widget?
  YES → Is it business-domain specific?
    YES → components/{domain}/
    NO  → Is it enterprise shell/grid/theme?
      YES → design-system/
      NO  → components/ui/ (primitives) or components/forms/

Is it static seed data or fixture (no React)?
  YES → data/{domain}/

Is it demo bootstrap, factory, or scenario generator?
  YES → demo/

Is it fetch, API client, or DTO mapping?
  YES → Is it HTTP for one resource?
    YES → services/api/{resource}Api.ts
    NO  → services/bridges/{resource}ApiBridge.ts

Is it Zustand state, selector, or persist rule?
  YES → store/

Is it app startup or hydration orchestration?
  YES → bootstrap/

Is it environment or feature flag?
  YES → config/

Is it a shared TypeScript interface/type?
  YES → types/{domain}.ts

Is it a reusable React hook?
  YES → hooks/

Is it a pure stateless helper?
  YES → utils/{category}/
```

---

## modules/ — route pages

**Belongs here:**
- List, create, edit, detail pages
- 360 workspaces
- Module dashboards and hubs
- Route composition pages

**Examples:**
- `modules/crm/CrmLeadListPage.tsx`
- `modules/quotations/Quotation360Page.tsx`
- `modules/purchase/PurchaseOrderListPage.tsx`

**Does NOT belong:**
- Tables, drawers, dialogs → `components/`
- API calls → `services/`
- Seed arrays → `data/`

---

## components/ — reusable UI

**Belongs here:**
- Domain tables (`CrmLeadsTable`)
- Import dialogs, quick-create drawers
- Print/document renderers shared across pages
- Layout chrome (`AppShell`, `Sidebar`)

**Subfolder rule:**
- Used only in CRM → `components/crm/`
- Used in 3+ domains → `components/forms/`, `components/tables/`, or `design-system/`
- Primitive button/input → `components/ui/`

**Does NOT belong:**
- Full pages with route params
- Zustand stores

---

## design-system/

**Belongs here:**
- Enterprise shells, workspace chrome, list-page frameworks
- Theme tokens, density provider
- Domain-agnostic status chips, KPI shells

**Does NOT belong:**
- CRM-specific quotation builder logic
- API calls
- Lead/opportunity business rules

---

## services/

| Subfolder | Contents |
|-----------|----------|
| `api/` | `client.ts`, `authApi.ts`, `crmApi.ts` — returns DTOs |
| `bridges/` | Maps DTOs → store models; called from stores |
| `analytics/` | Cross-module analytics engines |
| `exports/` | CSV/download helpers |

**Rules:**
- Pages → stores → bridges → api (not pages → api for CRM writes)
- One HTTP client: `services/api/client.ts`
- Stores must not contain raw `fetch`

---

## store/

- One store per business domain (not per page)
- API mode: do not persist server collections to localStorage
- Demo mode: current persistence behaviour preserved
- Selectors in `store/selectors/`
- Hydration helpers in `store/bootstrap/` or top-level `bootstrap/`

---

## data/ vs demo/

| | `data/` | `demo/` |
|---|---------|---------|
| Purpose | Static records, templates | How to seed/generate |
| API mode import | **Forbidden** in services | **Forbidden** |
| Demo mode import | Allowed in bootstrap/stores | Allowed |

---

## Dual-mode rules (critical)

```typescript
if (isApiMode()) {
  // hydrate from API via bridge — never merge demo seeds
} else {
  // use data/ seeds via demo bootstrap
}
```

Never import `data/**/seed*` from `services/api/*`.

---

## Backend file placement (separate app)

Each entity module:

```
backend/src/modules/{domain}/{entity}/
  entity.routes.ts
  entity.controller.ts
  entity.service.ts
  entity.repository.ts
  entity.validation.ts
  entity.types.ts
  entity.mapper.ts   # optional
```

Quotations stay under `backend/src/modules/crm/quotations/`.

---

## Anti-patterns (structure test will fail)

- Route page in `components/`
- `fetch()` in `store/*.ts`
- Demo seed import in `services/api/*`
- React component in `data/`
- CRM logic in `design-system/`
- New mega-barrel `export *` without review
