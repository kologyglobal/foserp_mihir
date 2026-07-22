# Production Plan Form UX (FORM 20)

Routes: `/manufacturing/production-plan` (+ `/new`, `/:planId`) — **demo-gated by design**
(`demoOnlyRoute`). API plan endpoints exist in `manufacturingApi.ts`
(list/create/release/netting/generate WOs/close) but are not yet routed to pages.

## Current UX (demo)

- Planning period (plant, dates), demand selection (confirmed SOs + manual demands),
  coverage view (free FG stock, open WO remaining, uncovered demand), suggested work
  orders with readiness flags.
- Labelled **Light Production Planning** — explicitly not full MRP.

## Deferred (documented, not implied in UI)

- API-mode production plan pages wiring the existing endpoints.
- Netting preview panel per suggestion line.

This page intentionally remains demo-only until the transactional planning wave is
scheduled; the route gate prevents demo data from appearing in API mode.
