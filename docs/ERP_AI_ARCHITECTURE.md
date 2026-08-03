# FOS ERP — AI / OpenKB Integration Architecture Review

> **Wave 5 shipped (2026-08-03):** Global Copilot shell (suite bar + Ctrl+.) with ERP route context payload, RBAC-filtered record facts, knowledge RAG streaming, and thin SPA `/knowledge` workspace. Insights/admin still Wave 6.

---

## 1. Executive summary

| Attribute | Reality in FOS ERP |
|-----------|-------------------|
| Product | Multi-tenant manufacturing + services ERP (trailers / fabrication + `businessType=SERVICES`) |
| Stack | React 19 + Vite SPA · Express 5 + TypeScript · Prisma 6 · MySQL 8 · JWT RBAC |
| AI / KB today | **Waves 1–5** — schema, upload, index/search, chat, copilot shell; insights/admin deferred |
| Related UX | CRM keyword search; “Smart Context” / FactBox (business context panes, **not** LLM); document print engines |
| Attachments | Local filesystem (`uploads/*` via `fileStorage.service`), CRM entity attachments, multer (maintenance/statements/items) |
| Dual FE modes | `VITE_USE_API=false` demo Zustand · `VITE_USE_API=true` JWT + API SoT — **never mix** |
| OpenKB fit | New **tenant-scoped module** under `/api/v1/t/:tenantSlug/kb/…` + SPA `/knowledge/*` (later), reusing JWT, RBAC, Prisma, audit, response envelope |

**Directive for all later phases:** never overwrite CRM/Purchase/Accounting/etc. Ship KB as **additive** modules; follow existing thin-controller / service / repository layering; permissions via `constants/permissions.ts` + `sync-permissions`.

---

## 2. Current backend architecture

### 2.1 Process entry

| Piece | Path |
|-------|------|
| Process bootstrap | `backend/src/server.ts` — Prisma connect, `createApp()`, listen, IndiaMART + Bank Connector crons |
| Express app | `backend/src/app.ts` — helmet, CORS, JSON (size tied to CRM uploads), rate-limited `/auth`, health, Swagger (dev), module mounts, optional SPA static, error middleware |
| Config | `backend/src/config/` — `env`, `prisma`, `logger`, `swagger` |
| Prisma SoT | `backend/prisma/schema.prisma` + timestamped migrations; deploy via `npx tsx scripts/prisma-cli.ts migrate deploy` |

### 2.2 API surface (authoritative mounts)

Public / platform:

```text
GET  /api/v1/health
     /api/v1/auth/*
     /api/v1/webhooks/indiamart/*
     /api/v1/tenants/*
```

Tenant-scoped (two equivalent trees):

```text
/api/v1/t/:tenantSlug/<module>/…
/api/v1/tenants/:tenantId/<module>/…
```

Registered modules (from `app.ts`): users, roles, departments, modules, CRM, masters/items/vendors, inventory, accounting, organisation, manufacturing, maintenance, purchase, quality, dispatch, gate, reports, operations exceptions, executive.

**Frontend prefers slug paths** (`/api/v1/t/:tenantSlug/…`).

**Proposed OpenKB mount (do not use bare `/api/kb` unless product insists):**

```text
/api/v1/t/:tenantSlug/kb/…
/api/v1/tenants/:tenantId/kb/…
```

Reasons: tenant isolation parity with every other module; JWT `tenantId` enforcement already wired via `resolveTenant` / `requireTenantAccess`.

Optional external OpenKB/OpenAI calls stay **server-side only** (secrets in env; never in SPA).

### 2.3 Layering convention (follow for KB)

```text
*.routes.ts     → middleware chain + map verbs
*.controller.ts → parse req, call service, sendSuccess/sendError
*.service.ts    → business rules, orchestration
*.repository.ts → Prisma, always tenantId + soft-delete filters
*.validation.ts → Zod schemas
*.types.ts / errors → domain types & AppError subclasses
```

Reference modules: `modules/crm/*` (especially attachments, search, entities), `modules/maintenance` (multer uploads), `modules/modules` (feature flags).

**Controllers stay thin.** No generic PATCH for lifecycle — prefer explicit endpoints (`/reindex`, `/chat`, `/publish`).

### 2.4 Middleware stack

| Middleware | Role |
|------------|------|
| `authenticate` | Bearer JWT → `req.context.userId` / `tenantId` |
| `attachRequestContext` | Load user roles + permission names from DB |
| `validateParams` / `validateBody` / `validateQuery` | Zod |
| `resolveTenant` | Route `:tenantSlug` / `:tenantId` → `req.tenantId`; mismatch → error (Super Admin can switch) |
| `requireTenantAccess` | Require tenant context |
| `requirePermission` / `requireAnyPermission` | RBAC; denied → 403 + `audit_logs` |
| `requireModule(moduleKey)` | Soft gate via `TenantModuleFlag` (missing row = **enabled**) |
| `errorMiddleware` | Maps `AppError` + unknown → `sendError` envelope |

Typical CRM parent (pattern to copy for `kb.routes.ts`):

```text
authenticate → attachRequestContext → validateParams(tenantRouteParamSchema)
  → resolveTenant → requireTenantAccess → requireModule('knowledge')? → child routers
```

### 2.5 Response envelope (reuse)

From `backend/src/utils/response.ts`:

```json
{ "success": true, "message": "…", "data": {}, "meta": { "page", "limit", "total", "totalPages" } | null }
{ "success": false, "message": "…", "code": "…", "errors": [{ "field", "message" }] }
```

Frontend mirrors this in `frontend/src/services/api/client.ts` (`ApiResponse<T>`).

### 2.6 Logging & audit

- **Logger:** lightweight console facade `backend/src/config/logger.ts` (`debug|info|warn|error`).
- **Audit:** `createAuditLog` → `audit_logs` (module, entity, action, old/new values, IP/UA). Permission denials already audited under `module: 'rbac'`.
- **KB should write** `knowledge_activity_logs` table **and** selective high-value events on `audit_logs` (`module: 'knowledge'`).

### 2.7 Authentication & authorization

| Topic | Implementation |
|-------|----------------|
| Tokens | Access + refresh JWT (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`) |
| Login / me / self-service | `modules/auth` |
| Permissions catalog | `backend/src/constants/permissions.ts` (`PERMISSIONS[]`, `ROLE_PERMISSIONS`) |
| Persistence | `permissions`, `roles`, `role_permissions`, `user_roles` |
| Seed / resync | `prisma/seed.ts`, `scripts/sync-permissions.ts` |
| Super Admin | `tenant.manage` → `isSuperAdmin` |
| Module flags | `TenantModuleFlag` + catalog `module-catalog.ts` |

**There is no `kb.*` permission today.** Integration must add granular names (see §7) and wire roles carefully (Tenant Admin full; Viewer read; optional Knowledge Manager).

### 2.8 File upload patterns (reuse / extend)

| Pattern | Location | Notes |
|---------|----------|-------|
| CRM attachments | base64/JSON + disk via `fileStorage.service` | `CRM_UPLOAD_DIR`, size caps |
| Multer disk | Maintenance photos | tenant subfolder under `MAINTENANCE_UPLOAD_DIR` |
| Multer memory | Bank statement import | buffer → service |
| Item images | `saveItemImageFile` | under `uploads/items` |

**KB recommendation:** extend `fileStorage.service` with `saveKnowledgeDocumentFile` under `uploads/knowledge/:tenantId/…` (or `KB_UPLOAD_DIR` env), accept multipart **or** existing base64 style consistently with largest file types (PDF/Excel). Prefer multipart + multer for multi-MB docs; keep virus scanning as future ops concern.

### 2.9 Search today

- **CRM search only:** `GET …/crm/search` + `crm.search.view` — keyword / structured CRM entities, **not** vector search.
- **FE GlobalSearch (`⌘K`):** client/demo + hydrated CRM/master routes — not a vector backend.

OpenKB semantic/hybrid search is **net-new** under `/kb/search`, not a rewrite of CRM search.

### 2.10 Background work patterns

Existing in-process schedulers:

- IndiaMART sync scheduler  
- Bank connector AIS/cron  

No Redis/Bull/SQS in core path. **Phase 1 indexing** can use:

1. **Synchronous** reindex for small docs  
2. **In-process queue** (job table + worker tick like bank cron) for embeddings  

Avoid requiring external queue infra until scale demands it — match current ops model (Hostinger-friendly).

---

## 3. Current frontend architecture

### 3.1 Shell

| Piece | Path |
|-------|------|
| Router | `frontend/src/routes/index.tsx` — `createBrowserRouter` |
| Auth shell | `AuthRootLayout` + `ApiAuthGate` |
| App chrome | `ERPLayout` (sidebar from `config/navigation.ts` `moduleCategories`) |
| Module sub-nav | `ModuleSubNavRail`, workspace chrome patterns |
| Dual mode | `config/apiConfig` / `isApiMode()` driven by `VITE_USE_API` |

Route trees are modular files (`crmRoutes`, `purchaseRoutes`, `accountingRoutes`, …). **KB adds** `kbRoutes` / `knowledgeRoutes` as a peer under `ERPLayout` children.

### 3.2 State & API

| Concern | Pattern |
|---------|---------|
| Global UI/domain state | Zustand stores under `frontend/src/store/*` |
| API client | `services/api/client.ts` — Bearer, refresh, `tenantPath()` |
| Domain modules | `services/api/<domain>Api.ts` + optional bridge |
| CRM/master writes | **Bridges only** (`crmApiBridge`, `masterApiBridge`) |
| Permissions UI | Permission helpers + permission-gated actions |

**KB rule:** In API mode, document/chat lists hydrate **only** from API — no demo seed merge. Demo mode may use a small empty or fixture store if needed for design-time UI, clearly gated by `isApiMode()`.

### 3.3 UI reuse (prefer these)

- Layout / workspace: `ERPLayout`, `EnterpriseWorkspace`, card form shells (`ErpCardFormPage`, sections)
- Lists: register filter bars, drawers, saved-view patterns (Purchase gold path when building document registers)
- Feedback: `appConfirm` / `appPromptNote` (no raw `window.confirm`)
- Selects: shared `Select` / `ErpSmartSelect` + `SELECT_PLACEHOLDER` (`— Select —`)
- Charts: Recharts already used on dashboards
- Markdown print/doc primitives exist for quotations — chat may introduce `react-markdown` + highlight deps **if not already present** (verify package.json before adding)

**Do not** introduce purple/glow “AI demo” chrome that conflicts with purchase/ERP design tokens (see `docs/PURCHASE_UI_CONSISTENCY.md` / design CSS).

### 3.4 Navigation insertion point

`frontend/src/config/navigation.ts` → `moduleCategories[]`.

Proposed category:

```text
id: 'knowledge' | 'kb'
title: 'Knowledge'
items: Dashboard, Documents, Categories, Search, Chat, Copilot, Insights, Analytics, Settings, Admin
```

Gate with:

1. Permission checks (`kb.document.view`, …)
2. Tenant module flag `knowledge` (add to `TENANT_MODULE_CATALOG` + FE packaging)

Global **Copilot** is not only a nav item — later it becomes a **floating entry in `ERPLayout`/command chrome**, context-aware via route + record id.

### 3.5 Dark mode / theme

ERP uses design tokens (`erp-*` CSS variables, dynamics/enterprise component CSS). Full “ChatGPT dark mode” must either:

- reuse existing theme toggle if present, or  
- scope chat to local surface tokens without inventing a second design system  

Treat as FE detail when building Chat UI (Phase 7).

---

## 4. Database schema overview

### 4.1 Tenancy & identity

| Table / model | Role |
|---------------|------|
| `tenants` | SaaS tenant; `businessType`, terminology JSON, soft delete |
| `users` | Per-tenant users; lockout fields; soft delete |
| `roles` / `permissions` / `role_permissions` / `user_roles` | RBAC |
| `tenant_module_flags` | Enable/disable modules |
| `audit_logs` | Cross-module audit |
| `departments` | People org units |
| Scopes | LE / branch / warehouse access tables for ops isolation |

**Invariants for every new KB table:**

1. `id` UUID  
2. `tenantId` NOT NULL + index  
3. Soft delete `deletedAt` where user-facing  
4. `@@unique([tenantId, …])` for business keys  
5. Never trust client `tenantId`  
6. Prisma relations back to `Tenant` (and optionally `User` by id without fragile cascades)

### 4.2 Existing document-like storage

- `crm_attachments` — entity-bound files (not a knowledge base)
- Quotation documents / templates — structured commercial docs
- Treasury/maintenance/item image files — ops artifacts

KB tables are **orthogonal**; optional later link `sourceType`/`sourceId` to CRM entities for “explain this SO” is extension, not Phase 4 core.

### 4.3 Phase 4 tables (planned — migrations only after confirmation)

| Logical table | Purpose |
|---------------|---------|
| `knowledge_documents` | Uploaded/URL sources, status, mime, storage key, category, owner |
| `knowledge_chunks` | Markdown chunks of a document/version |
| `knowledge_embeddings` | Vector blob/JSON + model metadata (MySQL: JSON or BLOB; evaluate pgvector later if migrate hosts) |
| `knowledge_categories` | Taxonomy tree |
| `knowledge_tags` (+ join) | Tagging |
| `knowledge_sources` | Source registries (manual, URL crawl, ERP module mirror) |
| `knowledge_chat_sessions` | Multi conversation |
| `knowledge_chat_history` | Messages, role, citations |
| `knowledge_feedback` | Thumbs / rating on answers |
| `knowledge_permissions` | Document/category ACLs beyond role RBAC |
| `knowledge_versions` | Document version history |
| `knowledge_activity_logs` | Index/reindex/view/chat events |

**MySQL vector note:** Prisma + MySQL 8 cannot use true ANN indexes like pgvector without infra change. Plan Phase 1 as:

- store embeddings as JSON float arrays  
- cosine similarity in app/sql for **tenant-scoped** corpuses  
- optional later: external OpenKB index service or dedicated vector store  

This is a **risk/scaling** item, not a blocker for internal UAT.

### 4.4 Migration discipline

- Add Prisma models + `prisma/migrations/<timestamp>_knowledge_*`  
- **No** interactive `db:migrate` in CI — `migrate deploy` only  
- Register permissions in `PERMISSIONS` then `db:sync-permissions`  
- Do not expand Scope creep into rewriting unrelated migrations

---

## 5. Folder conventions & coding standards

### 5.1 Backend folders (proposed)

```text
backend/src/modules/knowledge/          # or openkb/
  knowledge.routes.ts                   # parent: auth + tenant
  documents/
  chunks/
  search/
  chat/
  copilot/
  insights/
  admin/
  indexing/                             # pipeline: extract → md → chunk → embed → store
  providers/                            # OpenAI-compatible + OpenKB client adapters
```

Wire in `app.ts` like other modules.

### 5.2 Frontend folders (proposed)

```text
frontend/src/modules/knowledge/
  KnowledgeDashboardPage.tsx
  DocumentsRegisterPage.tsx
  …

frontend/src/services/api/knowledgeApi.ts
frontend/src/routes/knowledgeRoutes.tsx
frontend/src/config/navigation.ts       # + category
```

### 5.3 Standards checklist (non-negotiable)

| Rule | Source |
|------|--------|
| Tenant on every query | Project memory / fos-erp rules |
| Zod on bodies/params | All modules |
| Explicit lifecycle endpoints | CRM/SO pattern |
| Permission complete + tests | Never mark module “done” without |
| Soft delete default | Schema convention |
| Dual-mode purity | No demo/API merge |
| Minimize diff | No drive-by refactors elsewhere |
| Secrets only via env names | No keys in docs/code |

---

## 6. Integration points (where OpenKB plugs in)

```text
┌─────────────────────────────────────────────────────────────────┐
│ SPA  ERPLayout · /knowledge/*  · global Copilot sheet           │
│      knowledgeApi → client.ts JWT + tenantSlug                  │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST
┌────────────────────────────▼────────────────────────────────────┐
│ Express  /api/v1/t/:slug/kb/*                                   │
│  authenticate · RBAC · requireModule('knowledge')               │
│  controllers → services → repositories (Prisma)                 │
│  indexing pipeline → fileStorage + embedding provider           │
└──────────────┬─────────────────────────────┬────────────────────┘
               │                             │
     ┌─────────▼─────────┐         ┌─────────▼─────────┐
     │ MySQL (new tables)│         │ OpenAI-compatible │
     │ files under       │         │ and/or OpenKB API │
     │ uploads/knowledge │         │ (server secrets)  │
     └───────────────────┘         └───────────────────┘
```

### 6.1 Auth & security reuse

- JWT + refresh from existing `/auth`  
- New `kb.*` permissions  
- Optional `knowledge_permissions` for doc-level override  
- Tenant isolation tests modeled on CRM (`crm-tenant-isolation` pattern)  
- Audit high-risk admin actions  

### 6.2 Copilot ERP context

Read-only context injection from **current route** (module id, entity type, record id) → backend gathers **allowed** fields the user can already view (respect RBAC). Never bypass permission by “AI can read anything.”

Suggested context header/body:

```ts
{
  moduleKey: 'crm' | 'purchase' | …
  routePath: string
  entityType?: string
  entityId?: string
  screenHints?: string[]
}
```

### 6.3 Insights widgets

Dashboard cards under `/knowledge/insights` (and optional embeds on Executive home later). Data from aggregation queries on chats, docs, feedback — not hard-coded marketing copy.

### 6.4 Module catalog

Add:

```ts
{ key: 'knowledge', name: 'Knowledge Base', description: '…', dependsOn: [] }
```

`requireModule('knowledge')` on router parent.

---

## 7. Proposed API map (Phase 5 target)

Prefix: `/api/v1/t/:tenantSlug/kb`

| Area | Methods (illustrative) |
|------|------------------------|
| Documents | `POST /documents` upload · `GET /documents` · `GET /documents/:id` · `PATCH` · `DELETE` · `POST /:id/reindex` · `GET /:id/versions` |
| Search | `GET /search?q=` keyword · `POST /search/semantic` · `POST /search/hybrid` |
| Chat | `GET/POST /sessions` · `GET /sessions/:id/messages` · `POST /sessions/:id/messages` (SSE stream) · stop/regenerate |
| Copilot | `POST /copilot/complete` (stream) with ERP context |
| Insights | `GET /insights/summary` · usage · popular · FAQs · missing-docs heuristics |
| Taxonomy | categories/tags CRUD |
| Sources | CRUD + fetch URL |
| Feedback | `POST /feedback` |
| Analytics | usage series |
| Admin | embedding model settings, chunk size, prompt templates (tenant-scoped) |

All responses use `sendSuccess` / `sendPaginated` / `sendError`.

**Suggested permissions:**

```text
kb.document.view | create | update | delete | reindex
kb.search.view
kb.chat.use
kb.copilot.use
kb.insights.view
kb.category.manage | kb.tag.manage
kb.admin.manage
kb.analytics.view
```

---

## 8. Document processing pipeline (Phases 3 / 6)

```text
Upload / URL
  → store raw blob (tenant path)
  → detect type (PDF, DOCX, TXT, CSV, XLSX, image, MD, HTML)
  → convert → Markdown (OCR for images; text extract for PDF/DOCX)
  → version row
  → chunk (size/overlap from admin config)
  → embed (OpenAI-compatible embeddings API)
  → store chunks + embeddings
  → status: READY | FAILED | PARTIAL
```

**Dependencies to introduce carefully** (backend): pdf parse, mammoth/docx, xlsx, sharp/tesseract (OCR may be heavy — feature-flag OCR on Hostinger sizing). Prefer pluggable extractors.

**OpenKB vs custom:** Prefer adapter interface `KnowledgeProvider` so OpenKB can own OCR/chunk/embed if product later standardizes, while ERP keeps ACL, tenancy, UI.

---

## 9. Performance strategy (Phase 13)

| Need | Approach in this stack |
|------|------------------------|
| Lazy loading | SPA routes + React.lazy where used already in app patterns |
| Streaming chat | SSE or chunked transfer; Express handlers that flush; FE ReadableStream |
| Pagination | Existing `meta` pagination |
| Background index | Job table + optional in-process worker (bank cron style) |
| Caching | In-memory tenant embedding cache carefully; Redis optional later |
| Large embeds | Limit concurrent embedding calls; batch size |

---

## 10. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Hostinger resource limits** (CPU for OCR/embeddings, RAM, disk) | High | Async jobs; optional external OpenKB; disable OCR by default initially |
| **MySQL vector search at scale** | Medium–High | Tenant filters first; ANN later; cap corpus sizes in UAT |
| **Secret / PII leakage into LLM prompts** | High | Strip secrets; redact; never send other tenants; log redacted only |
| **RBAC bypass via copilot** | High | Resolve every cited ERP field through existing service/permission gates |
| **Demo/API mix bug if half-demo KB** | Medium | API-only first release for indexing/chat |
| **Giant monorepo schema churn** | Medium | Isolated migration; don’t touch unrelated domain models |
| **Package bloat / license** of OCR/PDF libs | Medium | Evaluate licenses; optional native deps fail soft |
| **Streaming + reverse proxy** buffering | Medium | Configure nginx/`X-Accel`/`proxy_buffering off` for SSE path |
| **Cost of embeddings/chat** | Medium | Tenant quotas; model settings in Admin |
| **Confusing “AI Insights” vs Purchase FactBox** | Low | Distinct product name “Knowledge / OpenKB”; no fake AI chrome on purchase |
| **No existing OpenKB in tree** | Info | Greenfield module — choose HTTP client contract early |
| **User prompt path `/api/kb` vs ERP `/api/v1/t/…`** | Low | Document dual mount if product marketing wants short alias **after** full path works |

---

## 11. Implementation strategy (Phase 15 binding)

Proceed **module-by-module**. For each:

1. Analyze existing related code  
2. Explain findings  
3. Explain required changes  
4. Show architecture (small diagram)  
5. Generate code  
6. **Wait for confirmation**  

Suggested order:

| Wave | Scope | Deliverable |
|------|-------|-------------|
| **W0** | This document + decision on OpenKB API contract & env vars | **Done (this doc)** |
| **W1** | Prisma migration + empty `knowledge` module + permissions + module flag | Schema + 401/403 smoke |
| **W2** | Document upload + list + storage + status machine | CRUD |
| **W3** | Extract → MD → chunk → embed → keyword + semantic search | Search API |
| **W4** | Chat sessions + streaming + citations | Chat UI base |
| **W5** | Copilot global shell + context payload | Copilot |
| **W6** | Insights/analytics/admin settings | Admin + widgets |
| **W7** | Hardening: tenant isolation tests, quotas, docs, Hostinger runbook | Production readiness |

**Out of scope until confirmed:** mobile native, rewriting CRM search, embedding ERP transactional data without review.

---

## 12. Environment variables (names only)

Proposed (add during W1+; never commit values):

| Name | Purpose |
|------|---------|
| `KB_UPLOAD_DIR` | Document root |
| `KB_MAX_UPLOAD_BYTES` | Size cap |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` | Compatible embeddings + chat |
| `OPENKB_BASE_URL` / `OPENKB_API_KEY` | If using external OpenKB service |
| `KB_EMBEDDING_MODEL` | Default embedding model id |
| `KB_CHAT_MODEL` | Default chat model |
| `KB_CHUNK_SIZE` / `KB_CHUNK_OVERLAP` | Defaults (override per tenant admin) |
| `KB_INDEXING_ENABLED` | Kill switch |
| `KB_OCR_ENABLED` | Gate OCR |

---

## 13. Acceptance definition (platform complete only when)

Aligned with project completion rules:

- UI + API + DB + permissions + tenant isolation + tests  
- Live evidence (not skipped) for upload → index → search → chat  
- Hostinger/migrate runbook  
- No regression on existing modules (typecheck + subset of CRM/smoke suites)

---

## 14. Decision log (needs product confirmation)

| # | Question | Recommendation |
|---|----------|----------------|
| D1 | Route prefix | `/api/v1/t/:slug/kb` (not root `/api/kb` alone) |
| D2 | Module key | `knowledge` |
| D3 | Vector store | MySQL JSON first; external vector later |
| D4 | Demo mode | Thin empty UI or hide module when `VITE_USE_API=false` |
| D5 | OpenKB | Adapter first; call OpenKB only if you provide base URL + API shapes |
| D6 | OCR | Phase-flagged; not blocking document text types |

---

## 15. Next step (waiting on you)

Phases 1–2 are complete with this document.

**Confirm to proceed to Wave 1 (Phase 4–focused):**

1. Prisma models + migration for the 12 knowledge tables  
2. `PERMISSIONS` + module catalog entry  
3. Skeleton `backend/src/modules/knowledge` routes mounted in `app.ts`  
4. No frontend polish until API skeleton is reviewed  

Or confirm a different first wave (e.g. OpenKB external-only sandbox).

---

*End of architecture review — no application feature code generated in this phase.*
