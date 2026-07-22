# Phase 8B — SOP Index

Pilot-path SOPs only. Full manufacturing docs remain under `docs/manufacturing/` for reference; **these SOPs govern daily pilot behaviour**.

| SOP | File | Audience | When |
|-----|------|----------|------|
| WO release | [`sops/WO_RELEASE.md`](sops/WO_RELEASE.md) | Planner / Supervisor | Create → release WO |
| Operator My Work | [`sops/OPERATOR_MY_WORK.md`](sops/OPERATOR_MY_WORK.md) | Operator | Shift execution |
| Daily production | [`sops/DAILY_PRODUCTION.md`](sops/DAILY_PRODUCTION.md) | Supervisor | End-of-shift / batch report |
| Material issue / return | [`sops/MATERIAL_ISSUE_RETURN.md`](sops/MATERIAL_ISSUE_RETURN.md) | Stores | Against released WO |
| Quality queue | [`sops/QUALITY_QUEUE.md`](sops/QUALITY_QUEUE.md) | QC | In-process / final only |
| Corrections | [`sops/CORRECTIONS.md`](sops/CORRECTIONS.md) | Supervisor (authorised) | Quantity / progress mistakes |
| WO close | [`sops/WO_CLOSE.md`](sops/WO_CLOSE.md) | Supervisor | Complete / close |
| Daily reconciliation | [`sops/DAILY_RECONCILIATION.md`](sops/DAILY_RECONCILIATION.md) | Supervisor + Stores | End of day |
| Prohibited actions | [`sops/PROHIBITED_ACTIONS.md`](sops/PROHIBITED_ACTIONS.md) | All | Continuous |

**Flags:** [`PHASE8B_FEATURE_FLAG_PLAN.md`](PHASE8B_FEATURE_FLAG_PLAN.md)  
**Scope:** [`PHASE8B_PILOT_SCOPE.md`](PHASE8B_PILOT_SCOPE.md)  
**Mode:** `VITE_USE_API=true` always.
