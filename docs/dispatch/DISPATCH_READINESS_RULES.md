# Dispatch Readiness Rules (Phase 7C5)

Backend is authoritative. Frontend must not invent posting readiness.

## Endpoint

`GET /api/v1/t/:tenantSlug/dispatch/outbound/:id/posting-readiness?mode=post|confirm`

## Response (summary)

- `lifecycleStatus` — derived (e.g. `READY_TO_RESERVE`, `CHALLAN_PENDING`, `READY_TO_POST`)
- `policy` — effective posting policy snapshot
- `quantity` — requested / reserved / picked / packed / challan / posting
- `hardBlockers` / `warnings`
- `allowedActions` — includes `POST` only when gates pass
- `gates.*` — reservation, pick, pack, challan, quality, inventory, salesOrder, posting, reversal

## Pilot equality (hardened)

When all hard gates enabled, posting quantity must equal reserved = picked = packed = issued challan quantity for that outbound document.
