# Maintenance V1 — Test Results

**Date:** 2026-07-29  
**Harness:** `backend/scripts/test-maintenance-v1.ts`

## Result

**PASS** (happy path + fail-test block + close + history + concurrency)

```
Tenant=vasant-trailers Machine=M-BLAST-01
Created MT-000001 REPORTED
→ OUT_OF_SERVICE → Start Repair → UNDER_MAINTENANCE
→ FAIL blocks close → PASS → Close
→ AVAILABLE · partsCost ₹8,500 · downtimeMinutes stored
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
| Test FAIL blocks close | PASS |
| Test PASS → Close → `AVAILABLE` | PASS |
| Downtime minutes stored | PASS |
| One open ticket / machine | PASS |
| Duplicate close blocked | PASS |
| Machine history | PASS |

## Frontend

- Typecheck: run after FE fixes (Maintenance pages)
- API mode only — demo shows API-required gate

## Verdict

**MAINTENANCE V1 — READY WITH CONDITIONS**

Conditions:
1. Inventory ISSUE posting not wired (`inventoryPostingPending`)
2. External contractor UAT skipped until vendor present
3. Live SPA click-through optional
4. Role permission sync for existing tenants may need admin re-seed / role refresh for new `maintenance.*` keys
