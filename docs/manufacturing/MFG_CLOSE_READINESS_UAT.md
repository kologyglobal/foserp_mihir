# MFG Close Readiness UAT — Fuel Tank

## Separation

| Close type | Meaning |
|------------|---------|
| Operational COMPLETE | Shopfloor done — status **COMPLETED** via `/complete` |
| Financial / CLOSE purpose | Costing/accounting finalized — may remain blocked when mfg accounting disabled |

Harness (2026-07-28 `WO-000010`):

| Purpose | ready | Notes |
|---------|-------|-------|
| CLOSE | false (1 blocker) | Expected when financial close not in scope / accounting gated |
| COMPLETE | true | No operational blockers |
| POST complete | **COMPLETED** | good=1 |

## Typical COMPLETE checks

- Mandatory Job Cards / ops done  
- Final QC passed  
- FG receipt posted (when required)  
- Material reconciliation within tolerance  
- No open critical Job Work / corrections (per policy)  
- Flexible execution soft rules respected  

Do not invent hard blockers that conflict with `flexibleExecution`.
