# Backend Shared Layer — Consolidation Plan (Phase 10)

**Date:** 2026-07-11  
**Status:** Phase 10 started — CRM cross-cutting helpers moved to `src/shared/`

---

## Goal

Align backend layout with `BACKEND_FOLDER_STRUCTURE.md` without breaking domain module ownership or moving quotations out of CRM.

---

## Current state (after Phase 10)

```
backend/src/
├── shared/                    # NEW — cross-module helpers
│   ├── prisma/
│   │   ├── helpers.ts         # tenantActiveFilter, toIso, decimalToNumber
│   │   └── audit.ts           # mapAuditFields, AuditUserNames
│   ├── users/
│   │   └── resolveUserNames.ts
│   └── index.ts
├── modules/crm/
│   ├── crm.shared.ts          # Compat shim → shared/
│   └── quotations/
│       ├── quotation.types.ts # DTOs + pricing helpers
│       └── quotation.mapper.ts # Prisma ↔ DTO (NEW)
├── utils/                     # HTTP/pagination/response (unchanged for now)
├── middleware/
└── services/
```

---

## Completed (Phase 10)

| Task | Status |
|------|--------|
| 10.1 Document `shared/` consolidation | ✅ This doc |
| 10.2 `quotation.mapper.ts` extracted | ✅ |
| 10.3 Quotations stay under `crm/` | ✅ ADR-019 |
| CRM `crm.shared.ts` → `shared/` shim | ✅ |
| `test:backend-structure` gate | ✅ |

---

## Deferred (Phase 11+)

| Item | From | To | Risk |
|------|------|-----|------|
| `utils/response.ts` | `utils/` | `shared/http/response.ts` | Low — 20 imports |
| `utils/pagination.ts` | `utils/` | `shared/http/pagination.ts` | Low |
| `utils/errors.ts` | `utils/` | `shared/errors/index.ts` | Medium |
| `middleware/validation` helpers | `middleware/` | `shared/validation/` | Medium |
| Per-entity `*.mapper.ts` | `*.types.ts` | split when file > 200 lines | Low, incremental |
| `services/codeSeries` | `services/` | `services/code-series/` | Low |

**Do not move** without compat shims and `test:backend-structure` update.

---

## Entity module pattern (enforced)

| File | Responsibility |
|------|----------------|
| `*.routes.ts` | Express router, permissions, Zod middleware |
| `*.controller.ts` | HTTP status, calls service |
| `*.service.ts` | Business logic, workflows |
| `*.repository.ts` | Prisma queries only |
| `*.validation.ts` | Zod schemas |
| `*.types.ts` | DTO interfaces + pure helpers |
| `*.mapper.ts` | Prisma ↔ DTO mapping (when non-trivial) |

**Quotations** now follow the mapper split; other CRM entities keep mappers in `*.types.ts` until touched.

---

## Quotations under CRM (ADR-019)

- Routes: `/api/v1/t/:tenantSlug/crm/quotations/*`
- Frontend bridge: `quotationApiBridge.ts` (not a top-level sales module)
- Backend SO: **Phase 1 shipped** — convert + `POST/PATCH/DELETE` draft + confirm/close (`sales-order.routes.ts` + `salesOrderApiBridge`). Fulfilment (MRP/dispatch/invoice) still deferred.
- **Never** extract to `modules/quotations/` without ADR + frontend route migration

---

## Verification

```powershell
cd backend
npm run test:backend-structure
npm run typecheck
npm run test:crm-live
```

---

## Related

- `docs/BACKEND_FOLDER_STRUCTURE.md`
- `docs/ARCHITECTURE_DECISIONS.md` — ADR-019
- `docs/structure-migration-checklist.md` — Phase 10
