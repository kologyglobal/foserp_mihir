# Frontend ↔ Backend Integration

## Architecture overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  React pages    │────▶│  Zustand stores  │────▶│  API bridges    │
│  + hooks        │     │  (crmStore, etc.)│     │  (crmApiBridge) │
└────────┬────────┘     └──────────────────┘     └────────┬────────┘
         │                                                  │
         │  useEntityNotes / useEntityAttachments           │
         │  (direct API, bypass store)                      ▼
         │                                         ┌─────────────────┐
         └────────────────────────────────────────▶│  crmApi.ts      │
                                                   │  client.ts      │
                                                   └────────┬────────┘
                                                            │
                                                            ▼
                                                   Backend REST API
```

## API client (`trailer-erp/src/services/api/`)

| File | Role |
|------|------|
| `config.ts` | `API_CONFIG`, `isApiMode()` |
| `client.ts` | `apiRequest`, `apiDownloadBlob`, `tenantPath`, session storage, token refresh |
| `apiErrors.ts` | `ApiError`, `formatApiError` |
| `crmApi.ts` | Typed fetch functions for all CRM endpoints |
| `crmApiAuth.ts` | login, logout, fetchMe |
| `masterApi.ts` | Generic master CRUD |
| `masterBatchApi.ts` | Items/vendors batch endpoints |
| `lookupCache.ts` | Deduped lookup requests |

## Auth flow (API mode)

1. User submits `LoginPage` → `AuthProvider.login()` → `POST /auth/login`.
2. Session saved to `localStorage` (`fos-erp-auth`).
3. `ApiAuthGate` wraps app routes; redirects to `/login` if no session.
4. `AppShell` mounts → `useCrmApiSync()` + `useMasterApiSync()` hydrate stores.
5. On 401, `client.ts` refreshes token via `/auth/refresh-token`.

Demo mode skips steps 1–4; stores use persisted seed data.

## Bridge pattern

Bridges translate frontend store actions → API calls → store updates. **Pages should call store actions or bridge exports**, not `crmApi` directly (except hooks).

| Bridge | File | Scope |
|--------|------|-------|
| CRM | `crmApiBridge.ts` | Leads, companies, contacts, opportunities, activities, follow-ups, workflows |
| CRM masters | `crmMasterApiBridge.ts` | CRM dropdown masters |
| Masters | `masterApiBridge.ts` | Geography, UOM, warehouse, location |
| Master batch | `masterBatchApiBridge.ts` | Category, HSN, GST, items, vendors |

Key bridge behaviors:

- `syncAllCrmFromApi()` — parallel fetch, **replaces** store arrays (no merge).
- `withSubmitLock()` — prevents double-submit.
- `toApiDateTime()` — date field normalization.
- Field mappers: API DTO aliases ↔ frontend types (below).

## Hooks

| Hook | File | When |
|------|------|------|
| `useCrmApiSync` | `hooks/useCrmApiSync.ts` | App mount — CRM hydration |
| `useMasterApiSync` | `hooks/useMasterApiSync.ts` | App mount — master hydration |
| `useEntityNotes` | `hooks/useEntityNotes.ts` | 360 notes panel |
| `useEntityAttachments` | `hooks/useEntityAttachments.ts` | 360 attachments panel |
| `useCrmDashboardApiMetrics` | `hooks/useCrmDashboardApiMetrics.ts` | Dashboard KPI/panels/charts overlay |
| `buildCrmDashboardChartSeries` | `utils/crmDashboardApiCharts.ts` | Maps API `charts` → Recharts series |
| `runCrmExport` | `utils/crmServerExport.ts` | Server CSV download in API mode |
| `useCrmReport` | `hooks/useCrmReport.ts` | Report pages |
| `useCrmGlobalSearch` | `hooks/useCrmGlobalSearch.ts` | Header search |
| `useItemLookup` / `useVendorLookup` | `hooks/` | Transactional forms (API mode direct) |

## Per-module integration

| Module | Demo source | API source | Write path |
|--------|-------------|------------|------------|
| Companies | `masterStore.customers` | `fetchCompanies` → sync | `crmApiBridge` create/update/delete |
| Contacts | `crmStore.contacts` | sync | bridge |
| Leads | `salesStore.leads` | sync | bridge |
| Opportunities | `crmStore.opportunities` | sync | bridge |
| Activities | `crmStore.activities` | sync | bridge |
| Follow-ups | `crmStore.followUps` | sync | bridge |
| CRM masters | `crmMasterStore` | `fetchCrmMastersSync` | `crmMasterApiBridge` |
| Geography/UOM/etc. | `masterStore` slices | `useMasterApiSync` | `masterApiBridge` |
| Items/vendors | `masterStore` | batch sync + lookups | `masterBatchApiBridge` |
| Notes/attachments | demoNotes / legacy stores | entity API hooks | hooks (direct) |
| Dashboard | local `crmMetrics` | `/dashboard/metrics` (`panels` + `charts`) | read-only |
| Reports | local compute | `/reports?reportId=` | read-only |
| Search | local filter | `/crm/search` | read-only |
| Exports | client CSV | `/crm/exports/:resource` incl. `quotations` | `crmServerExport.ts` |
| Quotations | `crmStore.quotation*` | export + reports only (read) | store only for CRUD; list export via server |
| Sales/purchase/etc. | respective stores | ❌ | store only |
| Mobile CRM | same stores | via sync | store actions → bridge when wired |

## Shared CRM UI components (notes)

| Component | Path | Role |
|-----------|------|------|
| `EntityNotesPanel` | `components/crm/shared/EntityNotesPanel.tsx` | API notes or `demoNotes`; `demoOnly` for unlinked quotations |
| `CrmEntityDetailDrawer` | `components/crm/shared/CrmEntityDetailDrawer.tsx` | Activity/follow-up notes drawer |
| `demoNotesFromTexts` | `utils/crmEntityNotes.ts` | Legacy field → demo note list |

360 pages wired: `Lead360Workspace`, `Opportunity360Page`, `Contact360Page`, `Customer360Page`, `Quotation360Page`, plus `CrmEngagementPanels`.

Backend accepts **frontend field names** in many schemas. Primary mappings in `crmApiBridge.ts`:

| Frontend | API / DB | Entity |
|----------|----------|--------|
| `customerName` | `name` | Company |
| `customerId` / `companyId` | `companyId` | Contact, Lead, Opp |
| `customerType` | `customerType` | Company |
| `prospectName` | `prospectName` | Lead |
| `leadOwnerId` / `ownerId` | `assignedTo` / `ownerId` | Lead / Opp |
| `opportunityName` | `name` | Opportunity |
| `value` | `amount` | Opportunity |
| `type` (activity) | `activityType` | Activity |
| `customerId` (activity) | `companyId` | Activity |
| `activityDate` | `scheduledAt` | Activity |
| `contactPerson` + split names | `firstName`, `lastName` | Contact |
| Company `contactPerson` / `contactPhone` / `contactEmail` | Upsert primary CRM contact on company create/update | Company → Contact sync (`company.service`) |

Date fields: use `toApiDateTime()` for date-only strings → ISO datetime.

UUID validation: bridge uses `isUuid()` to decide whether to send FK ids or fall back to session user id for owner fields.

## Permissions (frontend)

- Session includes `user.permissions[]` from login/me.
- CRM pages use `canCrmPermission('crm.lead.view')` from `utils/crmPermissions.ts`.
- Server export checks `crm.export.execute`.

Migrate legacy `sales.*` / role-name checks when touching pages.

## Error handling

- `apiRequest` throws `ApiError` with status + field errors.
- Bridges return `{ ok: false, error: string }` (`StoreActionResult`).
- UI shows `formatApiError(err)` in toasts/banners.

## Environment setup

**Frontend** (`trailer-erp/.env`):

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_USE_API=true
VITE_TENANT_SLUG=vasant-trailers
```

**Backend** (`backend/.env`): see `backend/.env.example` — set `DB_*`, `JWT_*`, `FRONTEND_URL`.

Run both:

```bash
# terminal 1
cd backend && npm run dev

# terminal 2
cd trailer-erp && npm run dev
```

## Adding a new integrated entity (checklist)

1. Prisma model + migration with `tenantId`, audit, soft delete.
2. Backend module: routes, validation, service, permissions.
3. `crmApi.ts` fetch/mutate functions.
4. Bridge mappers + store upsert/remove helpers.
5. Extend `syncAllCrmFromApi()` if list hydration needed.
6. Frontend page wired to bridge in API mode, store in demo mode.
7. Tenant isolation test + E2E test case.
8. Update PROJECT_STATUS.md.
