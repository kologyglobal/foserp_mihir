# Backend Folder Structure

**Application:** `backend/` (separate Node.js + Express + Prisma app)

---

## Current layout (2026-07-11)

```
backend/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── src/
│   ├── app.ts              # Express mount, CORS, route registration
│   ├── server.ts
│   ├── config/             # env, database, swagger
│   ├── constants/          # permissions.ts
│   ├── shared/             # Cross-module helpers (Phase 10)
│   │   ├── prisma/         # tenantActiveFilter, toIso, mapAuditFields
│   │   └── users/          # resolveUserNames
│   ├── middleware/         # auth, tenant, permission, validation, error
│   ├── modules/
│   │   ├── auth/
│   │   ├── tenants/
│   │   ├── users/
│   │   ├── roles/
│   │   ├── crm/            # Nested submodules per entity
│   │   │   ├── leads/
│   │   │   ├── opportunities/
│   │   │   ├── quotations/  # Stays under CRM (ADR)
│   │   │   ├── companies/
│   │   │   └── ...
│   │   ├── masters/
│   │   ├── items/
│   │   └── vendors/
│   ├── services/           # codeSeries, fileStorage
│   ├── types/
│   └── utils/              # pagination, response, password, asyncHandler
├── tests/
└── scripts/
```

---

## Target alignment (Phase 10 — partial)

```
backend/src/
├── shared/                 # Phase 10 — prisma helpers, audit, user resolution
│   ├── prisma/
│   └── users/
│   # Future: errors/, responses/, pagination/, validation/
├── services/
│   ├── code-series/
│   ├── audit/
│   └── storage/
└── modules/                # Unchanged domain ownership
```

**Do not** move quotations out of `crm/` without ADR approval.

---

## Entity module pattern (required)

Every backend entity:

| File | Responsibility |
|------|----------------|
| `*.routes.ts` | Express router, `requirePermission`, Zod middleware |
| `*.controller.ts` | HTTP status codes, calls service |
| `*.service.ts` | Business logic, workflows |
| `*.repository.ts` | Prisma queries only |
| `*.validation.ts` | Zod schemas |
| `*.types.ts` | DTOs |
| `*.mapper.ts` | Optional Prisma ↔ DTO mapping |

---

## API mount points

```
/api/v1/auth/*
/api/v1/t/:tenantSlug/crm/*
/api/v1/t/:tenantSlug/masters/*
/api/v1/t/:tenantSlug/masters/items/*
/api/v1/t/:tenantSlug/masters/vendors/*
```

Frontend uses slug routes exclusively via `tenantPath()`.

---

## Related docs

- `API_CONVENTIONS.md`
- `DATABASE_CONVENTIONS.md`
- `ARCHITECTURE_DECISIONS.md`
- `ADDING_A_NEW_MODULE.md`
