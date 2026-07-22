# Mobile CRM Verification

Routes under `/m/crm/*` (see `src/routes/mobileRoutes.tsx`).

## Complete (list / hub)

| Route | Page | API-backed in API mode |
|-------|------|------------------------|
| `/m/crm` | CRM hub | Uses shared stores synced via `syncAllCrmFromApi` |
| `/m/crm/leads` | Lead list | Store hydrated from API |
| `/m/crm/opportunities` | Opportunity list | Store hydrated from API |
| `/m/crm/customers` | Company list | Store hydrated from API |
| `/m/crm/activities` | Activity list | Store hydrated from API |
| `/m/crm/follow-ups` | Follow-up list | Store hydrated from API |

## Quick actions (from hub / list)

| Action | Status |
|--------|--------|
| Quick lead creation | Uses `useCrmStore` / `useSalesStore` create paths (API bridge in API mode) |
| Quick activity creation | `MobileCrmPages` drawers → store/API bridge |
| Quick follow-up creation | Shared `QuickFollowUpDrawer` |
| Call / WhatsApp / Email / Meeting | `tel:`, `mailto:`, and WhatsApp deep links on lead rows |

## Not implemented by design

| Feature | Reason |
|---------|--------|
| `/m/crm/leads/:id` dedicated detail route | Mobile opens full Lead 360 at `/crm/leads/:id` via list link |
| `/m/crm/opportunities/:id` dedicated detail route | Opens desktop Opportunity 360 |
| Mobile-specific notes panel | Notes live on 360 pages (`EntityNotesPanel`); mobile lists link out |
| Mobile-specific attachments panel | Attachments on 360 / Company documents tab in API mode |
| Separate mobile API client | Single `crmApi` + store bridge by design |

## Verification checklist

- [x] Lead list loads and filters
- [x] Opportunity list loads
- [x] Activity and follow-up lists load
- [x] Quick create drawers work in demo mode
- [x] Quick create uses API bridge when `VITE_USE_API=true`
- [x] Call / WhatsApp / email actions present on lead rows
- [x] **API-mode E2E** (`npm run test:crm-mobile-api-e2e`) — live login, list APIs, follow-up create + complete (mobile Mark done), `/m/crm/leads` served — **26/26** (2026-07-18)
- [ ] Dedicated mobile 360 layouts (out of scope — uses responsive desktop 360)
