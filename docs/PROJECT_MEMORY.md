# FOS ERP — Project Memory

> Source of truth for AI agents and developers. When docs and code disagree, **code wins**. Last verified: **2026-07-17** (Phase 2A ledger foundation).

---

## Product

| Attribute | Value |
|-----------|-------|
| **Product name** | FOS ERP (frontend package: `trailer-erp`) |
| **Target market** | Indian manufacturing companies (trailers, fabrication, discrete manufacturing) |
| **Target company turnover** | Approximately ₹5 crore to ₹100 crore |
| **Architecture** | React SPA + Node.js/Express API + MySQL 8 |
| **Tenancy** | Multi-tenant SaaS — shared database, shared schema |
| **Tenant scope** | Every tenant-owned record scoped by `tenantId` |
| **Current backend scope** | Auth, RBAC, CRM, masters; finance Phase 1 setup; Phase 2A ledger foundation; Phase 2B internal posting engine; Phase 2C1 manual journal drafts; Phase 2C2A approvals; Phase 2C2B post approved journals to GL; Phase 3A1 AR database foundation; Phase 3A2 AR sales invoice calculation engine; Phase 3A3 AR sales invoice draft workflow; Phase 3A4 AR atomic sales invoice posting; Phase 3A5 AR reporting; Phase 3A6 Money In AR frontend; Phase 3B1 customer receipt & allocation DB foundation; **Phase 3B2 customer receipt calculation & validation preview** |
| **Deferred backend** | Finance **Phase 3B3+** receipt draft/post APIs + credit notes; **Phase 2C3** journal reversal; purchase/inventory/production; SO MRP/dispatch/invoice beyond CRM Phase 1 |

---

## Technology stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite 8, React Router 7, Zustand, Tailwind, Recharts, React Hook Form + Zod |
| Backend | Node.js, Express 5, TypeScript, Prisma 6, MySQL 8, JWT (access + refresh), bcrypt, Zod validation |
| API docs | Swagger/OpenAPI (`/api/docs` in development) |
| Attachments | Local filesystem storage (`CRM_UPLOAD_DIR`) — cloud abstraction deferred |
| Testing (FE) | `tsx` scripts under `trailer-erp/scripts/` (Vitest not used on frontend) |
| Testing (BE) | Vitest + Supertest under `backend/tests/` |

---

## Repository layout

```text
trailer-erp 2/
├── frontend/                   # Active Frontend SPA (Vite) — prefer this over trailer-erp/
│   ├── src/
│   ├── Dockerfile              # multi-stage → nginx
│   └── nginx.conf              # SPA + /api/ proxy to backend
├── trailer-erp/                # Legacy / parallel FE tree (some older scripts)
├── backend/                    # Express API
│   ├── src/modules/            # auth, tenants, users, roles, crm, masters, items, vendors
│   ├── prisma/                 # schema.prisma, migrations, seed.ts
│   ├── Dockerfile              # multi-stage Node runtime
│   └── scripts/docker-entrypoint.sh  # migrate deploy → node dist/server.js
├── docker-compose.yml          # Production Compose: mysql + backend + frontend
├── .env.production.example     # Compose secrets template (copy → .env.production)
├── scripts/deploy-prod.sh      # Linux/macOS deploy wrapper
├── scripts/deploy-prod.ps1     # Windows deploy wrapper
├── docs/                       # Project memory + DEPLOYMENT.md
└── .cursor/rules/              # Cursor agent rules (fos-erp-project.mdc)
```

**Production deploy:** see [`docs/DEPLOYMENT.md`](DEPLOYMENT.md) (Docker Compose on a VPS; TLS at host reverse proxy).

---

## Development modes (`VITE_USE_API`)

Controlled by `trailer-erp/src/services/api/config.ts`:

| Env var | Default | Meaning |
|---------|---------|---------|
| `VITE_USE_API` | `false` | `true` = API mode; `false` = demo/localStorage mode |
| `VITE_API_BASE_URL` | `http://localhost:5000/api/v1` | Backend base URL |
| `VITE_TENANT_SLUG` | `vasant-trailers` | Default tenant slug |

### Demo mode (`VITE_USE_API=false`)

- No login gate (`ApiAuthGate` passes through).
- All modules use Zustand stores with seeded demo data.
- CRM, purchase, production, inventory, etc. are fully interactive in the browser.
- Frontend regression scripts run against stores only.

### API mode (`VITE_USE_API=true`)

- JWT login required; `useCrmApiSync()` + `useMasterApiSync()` **replace** store slices (no seed merge).
- Writes via bridge modules (`crmApiBridge`, `masterApiBridge`, `masterBatchApiBridge`).
- Entity notes/attachments via `useEntityNotes` / `useEntityAttachments`.
- Activity/follow-up Notes drawers on all required 360 pages.
- Dashboard KPIs, panels, chart series from `/crm/dashboard/metrics`.
- Server CSV exports via `runCrmExport()` for companies, contacts, leads, opportunities, quotations.
- Quotations: CRUD + lifecycle + convert-to-SO via API bridges; CRM UI uses shared conversion dialog (permissions, not Won-first gate).

### CRM commercial funnel (canonical)

```text
Lead (Qualified) → Opportunity → Quotation → Approve → Convert to SO (marks opp Won)
```

**Diagrams & UI routes:** [`docs/CRM_WORKFLOW.md`](CRM_WORKFLOW.md) (happy path, stages, quotation/SO lifecycle, permissions).

**Opportunity pipeline stages (canonical):** `opportunity-stages` CRM master + default `CrmPipelineStage` slugs — `new_lead` → `qualified` → `requirement_discussion` → `technical_review` → `quotation_prepared` → `quotation_sent` → `negotiation` → `won` / `lost` / `on_hold`. UI forms, Kanban, and API stage moves resolve from this master / default pipeline (not hard-coded divergent lists).

- Convert lead API requires **qualified** (`lead.workflow.assertLeadConvertible`).
- Approve sets `customerApproval` in the same transaction (no Accept API). **Accepted** = approved + `customerApproval=approved`.
- Convert quotation: `POST …/quotations/:id/convert-to-sales-order` requires `crm.quotation.convert` + `crm.sales_order.create`; creates Open SO; wins linked opportunity (or links if already Won). Direct draft SO also via `POST /crm/sales-orders`.
- SPA: `/crm/leads*` canonical; `/sales/leads*` redirects.

### Critical rule: never mix demo and API data

In API mode, bridges **replace** store arrays from API responses. Do not merge Zustand seed data with API hydration. Demo and API data must never be combined in the same session slice.

---

## Multi-tenant rules

1. **Tenant from authenticated context** — JWT embeds `tenantId`; middleware resolves route slug → id.
2. **Route tenant must match JWT tenant** (unless Super Admin with `tenant.manage`).
3. **Do not trust `tenantId` from request bodies** — always use `req.tenantId` from middleware.
4. **Every tenant-owned query** must filter `tenantId` + `deletedAt: null` (`tenantActiveFilter()`).
5. **Cross-tenant relationships rejected** — FK targets must belong to same tenant.
6. **Tenant isolation tested** for every new module (`crm-tenant-isolation.test.ts` pattern).
7. **Unique constraints** scoped per tenant: `@@unique([tenantId, …])`.
8. **Code series** generates tenant-scoped codes (LEAD, CONTACT, CRM_COMPANY, OPPORTUNITY).
9. **Soft delete** — set `deletedAt`; no hard delete in normal flows.
10. **Super Admin** can switch tenant via `x-tenant-id` header.

Route patterns (authoritative):

```text
/api/v1/t/:tenantSlug/…          ← frontend uses this (tenantPath)
/api/v1/tenants/:tenantId/…      ← equivalent backend mount
```

---

## Backend environment (names only — never commit values)

| Variable | Purpose |
|----------|---------|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` | MySQL connection |
| `DATABASE_URL` | Alternative to `DB_*` vars |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Token signing (min 32 chars) |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | Token TTL |
| `PORT` | Backend listen port (default 5000) |
| `FRONTEND_URL` | CORS origin |
| `CRM_UPLOAD_DIR`, `CRM_MAX_UPLOAD_BYTES` | Attachment storage |
| `RUN_CRM_E2E` | Set `true` to enable live MySQL tests (`test:crm-live` script sets this) |

**Setup:** `cd backend && npm run db:setup` (generate + migrate deploy + seed).

**CI / automation:** `npx tsx scripts/prisma-cli.ts migrate deploy` — not `npm run db:migrate` (interactive `migrate dev` prompt).

---

## Seed roles (development)

Seeded in `backend/prisma/seed.ts`: Super Admin, Tenant Admin, CRM Admin, Master Data Manager, Purchase Manager, Inventory Manager, Sales Manager, Production Manager, Sales Executive, Viewer. Permissions in `backend/src/constants/permissions.ts` (140+ strings).

---

## Key integration entry points

| Concern | Location |
|---------|----------|
| CRM sync | `hooks/useCrmApiSync.ts` → `crmApiBridge.syncAllCrmFromApi()` |
| Master sync | `hooks/useMasterApiSync.ts` → `masterApiBridge` + `masterBatchApiBridge` |
| Auth | `context/AuthProvider.tsx` → `crmApiAuth.ts` |
| Permissions (FE) | `utils/crmPermissions.ts` (`canCrmPermission`) |
| Dashboard charts | `utils/crmDashboardApiCharts.ts` → `buildCrmDashboardChartSeries()` |
| Server exports | `utils/crmServerExport.ts` → `runCrmExport()` |
| Notes panel | `components/crm/shared/EntityNotesPanel.tsx` |
| Notes drawer | `components/crm/shared/CrmEntityDetailDrawer.tsx` |

---

## Session start checklist (for AI agents)

1. Read `.cursor/rules/fos-erp-project.mdc`
2. Read `docs/PROJECT_MEMORY.md` (this file)
3. Read `docs/PROJECT_STATUS.md`
4. Read `docs/REMAINING_WORK.md`
5. Read latest entry in `docs/SESSION_CHANGELOG.md`
6. Verify relevant code before continuing — do not trust chat summaries alone

---

## Related docs

| File | Purpose |
|------|---------|
| `docs/CRM_WORKFLOW.md` | CRM commercial workflow Mermaid diagrams (as implemented) |
| `docs/PROJECT_STATUS.md` | Module completion matrix |
| `docs/API_CONVENTIONS.md` | Route & response patterns |
| `docs/DATABASE_CONVENTIONS.md` | Schema & migrations |
| `docs/FRONTEND_BACKEND_INTEGRATION.md` | Bridges & field maps |
| `docs/ARCHITECTURE_DECISIONS.md` | ADRs with rationale |
| `docs/TESTING_STATUS.md` | Verified test results |
| `docs/REMAINING_WORK.md` | Prioritized backlog |
| `docs/MASTER_REGISTRY.md` | Canonical master routes, aliases, dual-source warnings |
| `docs/master-module-audit.md` | Master UI / API coverage audit |
