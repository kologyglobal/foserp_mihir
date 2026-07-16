# CRM Completion Audit

Last updated: 2026-07-11 (dashboard quotation/charts reconciled **2026-07-15** — see `PROJECT_STATUS.md` / `REMAINING_WORK.md` P1-3)

## Scope

Routes under `/crm/*`, `/sales/*` (CRM aliases), and `/m/crm/*` (mobile).

## Summary

| Area | API mode | Demo mode | Status |
|------|----------|-----------|--------|
| Companies CRUD | ✅ Backend | ✅ Store | Complete |
| Contacts CRUD | ✅ Backend | ✅ Store | Complete |
| Leads CRUD + lifecycle | ✅ Backend | ✅ Store | Mostly complete |
| Opportunities CRUD + win/lose | ✅ Backend | ✅ Store | Mostly complete |
| Activities + complete | ✅ Backend | ✅ Store | Complete |
| Follow-ups (full lifecycle) | ✅ Backend | ✅ Store | Complete |
| CSV import (co/contact/lead) | ✅ Backend | ✅ UI | Complete |
| Dashboard KPIs / panels / charts | ✅ `/dashboard/metrics` (+ approval queue) | ✅ Local compute / store queue | **Complete** (P1-3 / P1-3b) |
| CRM reports (14 types) | ✅ Backend | ✅ Local compute | Complete for non-quotation reports |
| Quotations / templates / SO Phase 1 | ✅ Backend + bridges | ✅ Store | **Complete** (see `PROJECT_STATUS.md`); SO MRP/dispatch deferred |
| CRM masters | ✅ Sync / bridges (designed kinds) | ✅ Store | Mostly complete — see `MASTER_REGISTRY.md` |
| Notes / attachments | ✅ Entity APIs + 360 panels | ✅ Local | Complete (incl. `QUOTATION`) |
| Global CRM search | ✅ Backend + UI | — | Complete |
| Mobile CRM | Partial sync | ✅ Store | Uses same stores; call/WhatsApp actions local |
| Permissions | ✅ Backend crm.* | sales.* matrix | Partial — frontend migrating to canCrmPermission |

## Page inventory (designed)

### Core CRM (`/crm`)

| Route | Page | Completion | Gaps |
|-------|------|------------|------|
| `/crm` | Dashboard | 95% | Metrics/charts/approval queue API-backed; next-actions still client-built from hydrated store |
| `/crm/leads` | Lead list | 90% | Bulk ops loop individual API calls |
| `/crm/leads/new`, `/:id/edit` | Lead form | 90% | History tabs need API wiring |
| `/crm/leads/:id` | Lead detail | 85% | Status/assignment history GET added |
| `/crm/customers` | Companies | 90% | 360 links partial |
| `/crm/contacts` | Contacts | 90% | — |
| `/crm/contacts/:id` | Contact 360 | 80% | Linked entity counts from store |
| `/crm/opportunities` | Pipeline | 90% | Kanban alias redirects |
| `/crm/opportunities/:id` | Opportunity 360 | 85% | Stage history not persisted |
| `/crm/activities` | Activities | 90% | — |
| `/crm/follow-ups` | Follow-ups | 90% | Overdue from backend in API mode |
| `/crm/reports` | Reports hub | 85% | Quotation reports demo-only |
| `/crm/reports/:id` | Report detail | 85% | API-backed for 14 report IDs |
| `/crm/masters/*` | CRM masters | 40% | Hardcoded crmMasterStore in demo |
| `/crm/quotations/*` | Quotations | Complete | API bridges + lifecycle; convert→SO Phase 1 |
| `/crm/forecast` | Forecast | Complete | `GET /crm/forecast` + dual-mode FE |

### Sales aliases (`/sales`)

Lead and opportunity routes redirect or mirror CRM pages — same completion status.

### Mobile (`/m/crm`)

| Route | Status |
|-------|--------|
| Lead list / detail | Store-backed via useCrmApiSync |
| Follow-ups | Store-backed |
| Quick create | Partial |
| Call / WhatsApp | Local actions only |

## Backend modules

```
backend/src/modules/crm/
├── companies/ contacts/ leads/ opportunities/
├── activities/ follow-ups/ pipelines/
├── imports/ dashboard/ reports/ search/
└── crm.tenant-refs.ts, leads/lead.workflow.ts
```

~60 endpoints including dashboard, reports, search, lead history.

## Remaining work (priority)

1. Notes / attachments schema + APIs (if UI finalized) — **shipped**; see live E2E
2. CRM masters backend for designed master kinds — largely shipped; see `MASTER_REGISTRY.md`
3. Opportunity workflow hardening (win/lose via PATCH block)
4. Bulk lead endpoints
5. Export APIs — **shipped**
6. Frontend global search UI — **shipped**
7. Mobile action deep-links
8. ~~Full dashboard panel API feeds~~ — **done** (P1-3 / P1-3b; approval + charts from metrics)
9. Expanded tenant isolation + lead-to-win E2E

See companion docs: `crm-page-api-map.md`, `crm-gap-analysis.md`, `crm-workflow-map.md`, `crm-permission-map.md`, `crm-report-map.md`.
