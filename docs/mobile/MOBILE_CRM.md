# Mobile CRM (Phase M3 + M3.1)

> **Status:** Implemented under `mobile/`  
> **Date:** 2026-08-03  
> **Verdict:** **READY FOR CONTROLLED PILOT** (after M3.1 hardening)

## Scope

Native Expo CRM for salespeople using existing FOS CRM APIs (+ minimal device-token model for push foundation).

### Modules

| Area | Routes | APIs |
|------|--------|------|
| CRM Home | `/(tabs)` index | `/crm/dashboard/metrics` |
| Global search | `/crm/search` | `/crm/search` (incl. Q/SO) + bounded list fallback |
| Leads | register, create, 360 + actions/swipe | `/crm/leads` |
| Companies | flagship 360 | `/crm/companies`, commercial-position |
| Contacts / pipeline / FU / meetings / tasks | as M3 | CRM entity APIs |
| Quotations / SO | detail + **PDF viewer** | attachments download; approve/convert |
| Voice notes | Lead/Company/Meeting | `expo-av` → entity attachments |
| Offline drafts | FileSystem queue | parent-first sync + attachment relink |
| Collection | `/crm/collection` | companies + AR when `finance.ar.view` |
| Push foundation | service only | `POST /mobile/device-tokens` |
| Deep links | `fos-erp://crm/…` | + unavailable screen |

### Bottom navigation

Home · Customers · Tasks · Approvals · More

### Permissions

UI uses `can('crm.*')` / module flag `crm`. AR collection requires `finance.ar.view`. Backend remains authoritative.

### Explicit non-goals

CRM masters/admin/import/export, AI transcription, full push delivery, purchase/store/inventory/gate, calendar sync. (Business card scanner: M3.2 — see `MOBILE_CRM_BUSINESS_CARD.md`.)

## Docs

- [`MOBILE_CRM_HARDENING.md`](MOBILE_CRM_HARDENING.md)
- [`MOBILE_CRM_UAT.md`](MOBILE_CRM_UAT.md)
- [`MOBILE_CRM_TEST_RESULTS.md`](MOBILE_CRM_TEST_RESULTS.md)
