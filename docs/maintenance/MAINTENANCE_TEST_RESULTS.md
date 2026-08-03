# Maintenance V1 — Test Results

**Date:** 2026-07-30  
**Harness:** `backend/scripts/test-maintenance-v1.ts`

## Result

**PASS** (happy path + inventory ISSUE + fail-test block + close + history + concurrency + insufficient-stock fail-closed)

```
Tenant=vasant-trailers Machine=M-BLAST-01
Created MT-000003 REPORTED
→ OUT_OF_SERVICE → Start Repair → UNDER_MAINTENANCE
→ FAIL blocks close → PASS → Close
→ AVAILABLE · partsCost ₹8,500 · downtimeMinutes stored
Inventory ISSUE path PASS · MT-000004 · STM-000187 · onHand 10→8
Insufficient stock fail-closed
Duplicate open ticket blocked · Duplicate close blocked
History tickets ≥ 1
```

External contractor path: **SKIP** (no vendor master in tenant at run time). Covered by code path; re-run when vendors exist.

## Checks covered

| Check | Result |
|-------|--------|
| Ticket number MT-###### | PASS |
| Machine DOWN (`OUT_OF_SERVICE`) on report | PASS |
| Start Repair → `UNDER_MAINTENANCE` | PASS |
| Parts cost backend total | PASS (₹8,500) |
| Free-text part = ticket-only (no movement) | PASS |
| Stockable spare → `ISSUE_TO_MAINTENANCE` | PASS (`STM-000187`) |
| On-hand decrement + cost entry | PASS |
| Insufficient stock fail-closed | PASS |
| Test FAIL blocks close | PASS |
| Test PASS → Close → `AVAILABLE` | PASS |
| Downtime minutes stored | PASS |
| One open ticket / machine | PASS |
| Duplicate close blocked | PASS |
| Machine history | PASS |

## Frontend

- Typecheck: run with FE suite after pages update
- API mode only — demo shows API-required gate
- Parts Changed: stockable item + warehouse posts ISSUE; free-text remains ticket-only (honest labels)

## Permissions

`npx tsx scripts/sync-permissions.ts` on 2026-07-30: **0** missing catalog keys / **0** role links to add for seeded roles (including `maintenance.*`).

## Verdict

**MAINTENANCE V1 — READY**

Human sign-off remaining (not code blockers):
1. External contractor UAT when a vendor master exists in the tenant
2. Optional live SPA click-through

Deferred by design (out of V1):
- Full PM scheduler / contractor marketplace
- Persisted Purchase Requisition `sourceType` enum column (current PR model has no `source` field; Maintenance shortage deep-link prefills `source=maintenance` + purpose/remarks on PR create UI)
