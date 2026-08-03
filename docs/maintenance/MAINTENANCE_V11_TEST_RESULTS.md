# Maintenance V1.1 — Test Results

**Date:** 2026-07-30  
**Harness:**
- `npx tsx scripts/test-maintenance-v1.ts` (regression)
- `npx tsx scripts/test-maintenance-v11.ts` (V1.1 scenarios)

| Area | Result |
|------|--------|
| Schema migration `20260730200000_maintenance_v11_machine_health` | Added (renamed to avoid clash with finance period-end `20260730190000`) |
| Failure Category + SAFETY | Wired (API + Report UI) |
| rootCause / repairAction | Wired |
| repairEndedAt on TEST PASS | Wired |
| Close requires TEST PASS | Wired |
| Machine Health API/UI | Wired |
| Active ticket MFG banner | Wired |
| PR sourceType MAINTENANCE | Wired |
| Part ↔ PR backlink | Wired |
| Dashboard month downtime/cost | Wired |
| Production Impact report | Wired |
| V1 + V1.1 harness | Run against tenant MySQL before declaring READY |

**Verdict:** READY WITH CONDITIONS until both harnesses PASS on tenant DB after `migrate deploy`.
