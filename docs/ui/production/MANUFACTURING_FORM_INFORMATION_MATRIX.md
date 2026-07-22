# Manufacturing Form Information Matrix

10-point information standard: Identity, Status, Ownership, Source, Dates, Quantities,
Readiness, Exceptions, Related Records, Activity. Scores are /10 applicable categories.

Legend: ✓ present · ◐ partial · — not applicable.

| Route | Form | Primary Role | Identity | Status | Ownership | Source | Dates | Quantities | Readiness | Exceptions | Related | Activity | Primary Action | Tablet | Before | After | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/manufacturing/work-orders/new` | Create Work Order | Planner | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | Create Work Order | ✓ | 6 | **9** | Added server readiness panel + "what happens next"; supervisor assignment still post-create |
| `/manufacturing/work-orders/:id` | Work Order Detail | Supervisor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Status-driven (Release/Start/Record/Receive FG) | ✓ | 7 | **10** | NBA banner, info panel, close-readiness, FG receipt |
| WO detail → Release | Release | Supervisor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | Release Work Order | ✓ | 6 | **8** | Readiness visible pre-release on create panel + materials tab; dedicated release drawer not built |
| WO detail → Hold/Resume | Hold / Resume | Supervisor | ✓ | ✓ | ✓ | — | ✓ | — | ◐ | ✓ | — | ✓ | Put on Hold / Resume | ✓ | 7 | 7 | Reason category + expected resume; unchanged |
| WO detail → Record Progress | Stage/Operation Update | Operator/Supervisor | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | Record Production | ✓ | 8 | 8 | Position strip already present |
| WO detail → Complete | Work Order Complete | Supervisor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Complete Work Order | ✓ | 4 | **10** | New close-readiness dialog: blockers/warnings + full quantity position |
| WO detail → Materials → Issue | Material Issue | Store | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | Post Material Issue | ✓ | 4 | **9** | New posting drawer w/ position + impact + immutability warning |
| WO detail → Materials → Return | Material Return | Store | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | Post Material Return | ✓ | 0 (missing) | **9** | Return UI did not exist; API now wired |
| WO detail → Materials → Reserve | Material Reservation | Store | ✓ | ✓ | — | ✓ | — | ✓ | ✓ | ✓ | ✓ | — | Reserve Material | ✓ | 7 | 7 | Server allocation, one click; qty-partial reserve deferred |
| WO detail → Shortage PR | Shortage → PR | Store/Purchase | ✓ | ✓ | — | ✓ | ◐ | ✓ | ✓ | ✓ | ✓ | — | Create Purchase Requisition | ✓ | 6 | 6 | PR link on line; per-line qty/vendor picker deferred |
| WO detail → Transfer | WIP / Material Transfer | Supervisor | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Post WIP Transfer | ✓ | 7 | 7 | Existing drawer; logical vs stocked labelled |
| WO detail → FG receipt | Finished Goods Receipt | Store | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | Post Finished Goods Receipt | ✓ | 0 (missing) | **10** | New drawer: eligibility, preview, batch enforcement, impact |
| `/manufacturing/daily-update` | Daily Production Update | Supervisor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Submit Production Update | ✓ | 6 | **9** | WO/stage selectors replace raw IDs; totals preview on submit |
| `/manufacturing/my-work` | My Work Task | Operator | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ◐ | ✓ | Start/Pause/Resume/Complete | ✓ | 8 | 8 | Already task-card design; no commercial data shown |
| `/manufacturing/issues` | Production Issue | Supervisor | ✓ | ✓ | ✓ | ✓ | ✓ | ◐ | — | ✓ | ✓ | ✓ | Report Issue / Resolve | ✓ | 8 | 8 | Existing queue + resolve modal |
| WO detail → Changes | Runtime Change Request | Supervisor/Manager | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Submit / Approve / Apply | ✓ | 8 | 8 | Preview → create → approve flow existing; reject requires reason |
| `/manufacturing/corrections` | Correction Request | Manager | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Submit / Approve Correction | ✓ | 8 | 8 | Compensating entries; no delete anywhere |
| `/manufacturing/job-work/*` | Job Work create/detail | Supervisor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Status-driven (Send/Receive/Reconcile/Close) | ✓ | 7 | **9** | Reconciliation equation + unexplained difference now explicit |
| `/manufacturing/production-plan` | Production Plan | Planner | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ | ◐ | ◐ | ✓ | ◐ | Save Plan / Generate WOs | ✓ | 6 | 6 | Demo-gated route by design ("Light Production Planning"); API plan endpoints exist unrouted |
| `/manufacturing/work-centres` | Work Centre | Admin | ✓ | ✓ | ◐ | — | ✓ | — | ◐ | ◐ | ✓ | — | Save | ✓ | 7 | 7 | CRUD via setup shell; no unsupported capacity/OEE shown |
| `/manufacturing/machines` | Machine | Admin | ✓ | ✓ | ◐ | — | ✓ | — | ◐ | ◐ | ✓ | ◐ | Save | ✓ | 7 | 7 | Status lifecycle present |
| `/manufacturing/setup/boms/*` | BOM header + components | Engineer | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ◐ | Save / Validate / Activate | ◐ | 7 | 7 | Activated versions read-only; tree editor desktop-first |
| `/manufacturing/setup/routings/*` | Routing header + stages/ops | Engineer | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ◐ | Save / Validate / Activate | ◐ | 7 | 7 | Dependencies picked from lists, not typed IDs |
| `/manufacturing/profiles` | Manufacturing Profile | Admin | ✓ | ✓ | ◐ | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ | — | Save / Check Readiness | ✓ | 7 | 7 | Server readiness modal (checks + missing list) |
| — | Shift master | Admin | — | — | — | — | — | — | — | — | — | — | — | — | 0 | 0 | **No shift master exists** — shift is a free field on demo drawers only; deferred (backend model absent) |
| — | WO Financial Close | Finance | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Costing panel actions | ✓ | 7 | 7 | Costing panel permission-gated (`canViewCost`); posting via accounting gate |

## Score summary

- Forms redesigned this wave (score raised): WO detail (10), WO complete (10), FG receipt (10, net-new),
  Material issue (9), Material return (9, net-new), WO create (9), Daily update (9), Job work reconciliation (9).
- Forms already meeting ≥7 kept as-is (minimize diff scope, rule 20).
- Gaps deferred by design: Shift master (no backend), API production-plan routes,
  dedicated release-preview drawer, partial-quantity reservation entry.
