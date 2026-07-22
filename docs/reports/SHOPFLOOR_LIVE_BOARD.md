# Shopfloor Live Board (Phase 7D)

**Service:** `ops-reports/shopfloor/shopfloor.service.ts`
**Dedicated route:** `GET /manufacturing/shopfloor/live` (permission `manufacturing.reports.shopfloor`)
**Also available as report key:** `shopfloor-live` (same permission, exportable).

Shows the stages **currently `IN_PROGRESS`** across the shop floor — work centre, machine,
operator, active-assignment count, open issues, good vs planned quantity, health status, start
time and accumulated downtime.

---

## 30-second refresh (client poll)

- The service returns `suggestedRefreshSeconds: 30` and a `lastRefreshed` ISO timestamp with
  each response.
- Refresh is a **client-driven poll** — the UI re-requests every ~30s. There is **no**
  websocket/streaming push and no server-held "live" connection.

## No fake "Live" label

- The board reflects the actual `lastRefreshed` timestamp of the last query; it does not paint
  a permanent "LIVE" badge that implies streaming data. Freshness is honest: it is as fresh as
  the last poll.

## No OEE

- No OEE, availability, performance, or capacity-utilisation figures are computed (out of scope
  for Phase 7D). The board is a status view — active stages and their raw counts only.

## Filters & bounds

- Filters: `plantCode`, `workCentreId`. `workCentreId` is pushed into the query;
  `plantCode` is applied in-memory after fetch.
- Query is bounded to 1000 active stages, ordered by `startedAt` ascending.
- Tenant-scoped (`tenantId`) on every query.
