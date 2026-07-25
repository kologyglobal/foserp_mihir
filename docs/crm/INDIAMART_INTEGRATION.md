# IndiaMART Lead Integration

**Status:** Phase 1–5 shipped (2026-07-24) — Pull + Push webhook, dashboard charts, SLA alerts, product-mapping UI  
**API contract:** IndiaMART Lead Manager **Pull API v2** (+ optional **Push** webhook)  
Docs: https://help.indiamart.com/knowledge-base/lms-crm-integration-v2/

## API contract actually used

| Item | Value |
|------|--------|
| Base URL (default) | `https://mapi.indiamart.com` |
| Endpoint (default) | `/wservce/crm/crmListing/v2/` |
| Auth | Query parameter `glusr_crm_key` (`QUERY_PARAMETER`) |
| Date filters | `start_time`, `end_time` (IST; `DD-Mon-YYYY` or `DD-MM-YYYYHH:MM:SS`) |
| Idempotency | `UNIQUE_QUERY_ID` |
| Min hit interval | 5 minutes (enforced by IndiaMART; FOS default sync 15 min) |
| Max window | 7 days per request; overlap 5 minutes (Strategy 2) |
| Always-present fields | `UNIQUE_QUERY_ID`, `QUERY_TYPE`, `QUERY_TIME`, `SENDER_NAME`, `SENDER_MOBILE` or `SENDER_EMAIL`, `SENDER_COUNTRY_ISO` |

Optional buyer/product fields are mapped via configurable aliases (`SENDER_COMPANY`, `QUERY_MESSAGE`, `QUERY_PRODUCT_NAME`, …). Hosts other than `mapi.indiamart.com` are blocked in production SSRF guard.

## Push API webhook

| Item | Value |
|------|--------|
| Public URL | `POST /api/v1/webhooks/indiamart/:tenantSlug/:webhookToken` |
| Auth | Tenant slug + hashed webhook token (no JWT). Token shown once on enable/rotate. |
| Enable / rotate / disable | Authenticated: `…/crm/integrations/indiamart/push-webhook/{enable\|rotate\|disable}` (`crm.indiamart.credentials.manage`) |
| Ack | Prefer **HTTP 200** on accept so IndiaMART does not deactivate Push after ~48h of non-200 |
| Payload shapes | `{ RESPONSE: { UNIQUE_QUERY_ID, … } }`, top-level lead fields, or `{ body: { RESPONSE } }` |
| Sync run | `triggerType = PUSH`; same ingest / dedupe / auto-create lead path as Pull |

## Models

- `IndiaMartConnection` (1 per tenant, encrypted credentials; optional `pushWebhookEnabled` + token hash/prefix)
- `IndiaMartEnquiry` (raw payload + normalized columns)
- `IndiaMartSyncRun` (`MANUAL` \| `SCHEDULED` \| `RETRY` \| `INITIAL_IMPORT` \| `PUSH`)
- `IndiaMartProductMapping`
- `IndiaMartAlert` (SLA / sync / duplicate notifications)
- `CrmLead` extended: `externalSource`, `externalSourceId`, `externalSourceReference`, `sourceEnquiryDate`, `integrationEnquiryId`

## Routes (UI)

- `/crm/integrations/indiamart` → dashboard
- `/crm/integrations/indiamart/dashboard` — KPIs, Recharts trends, alerts panel
- `/crm/integrations/indiamart/inbox`
- `/crm/integrations/indiamart/leads`
- `/crm/integrations/indiamart/product-mappings`
- `/crm/integrations/indiamart/sync-history`
- `/crm/integrations/indiamart/settings` — Pull credentials + Push webhook enable/rotate/disable

## APIs

`/api/v1/t/:tenantSlug/crm/integrations/indiamart/...` — settings, test-connection, sync, sync-runs, enquiries (+ create-lead / link / assign / ignore / retry / bulk), product-mappings (+ suggest), dashboard, alerts, push-webhook.

Public (no JWT): `POST /api/v1/webhooks/indiamart/:tenantSlug/:webhookToken`.

## Permissions

`crm.indiamart.view`, `enquiry.view|import|assign|ignore|bulk_manage`, `sync.run`, `sync_history.view`, `settings.view|manage`, `credentials.manage`, `product_mapping.manage`.

## Scheduler

In-process `setInterval` (60s tick) calling `runIndiaMartSync` for due connections with DB sync lock, plus SLA refresh / overdue alerts. Replaceable by a queue worker later.

## Known limitations

- Geography master auto-resolve is soft (stores source text; no low-quality master create).
- Lead 360 FactBox deep-link panel for IndiaMART fields still optional polish.
- Screenshots deferred to manual UAT (API mode + live IndiaMART key / Push registration).

## Recommended next phase

1. Lead 360 FactBox deep-link panel for IndiaMART fields  
2. Queue-backed scheduler / multi-instance sync lock hardening  
3. Live UAT with IndiaMART Push registration + Pull overlap verification  
