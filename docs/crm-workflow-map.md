# CRM Workflow Map

> Visual / product-facing Mermaid diagrams: [`CRM_WORKFLOW.md`](CRM_WORKFLOW.md). This file focuses on endpoint guards and transaction notes.

## Lead lifecycle

```
new → contacted → requirement_collected → qualified → converted_to_opportunity
                    ↓                      ↓
              not_qualified              closed
                    ↓
                  closed
```

### Backend enforcement (`lead.workflow.ts`)

| Action | Guards |
|--------|--------|
| PATCH update | Blocks `stage`, `lifecycleStatus`, `qualificationStatus`, `opportunityId`, `assignedTo` (use dedicated endpoints) |
| Assign | Lead must be mutable; assignee must be same tenant |
| Qualify | Not converted; not already qualified |
| Disqualify | Not converted |
| Convert | **Must be qualified** (stage or lifecycleStatus); not converted; creates opportunity in one transaction |
| Delete | Soft delete; mutable check |

### Invalid transitions rejected

- Converted lead → qualify/disqualify/convert again
- Unqualified / non-qualified lead → convert (422 — use `POST …/qualify` first)
- PATCH cannot set stage to converted — must use convert endpoint
- Cross-tenant owner assignment → validation error
- Archived/deleted lead → update rejected

## Quotation → Sales Order

```
Draft → (send) → Pending approval → Approve → (UI: Mark Won) → Convert to SO
```

| Rule | Backend | CRM UI |
|------|---------|--------|
| Document + quotation `approved` | Yes | Yes |
| `customerApproval=approved` | Yes — set **in the same transaction as Approve** (no separate Accept API) | Approve only; Accept CTA removed |
| Commercial / lines / validity | Yes (`assertConvertible`) | Yes |
| Opportunity required | No (optional); when linked, convert stamps **Won** | Create SO requires linked opportunity + Won stage |
| Blank SO create | No `POST /sales-orders` | CRM list has no blank New — Create from Quotation / gated CTAs |

Canonical lead SPA routes: `/crm/leads*`. Legacy `/sales/leads*` redirects to CRM.

### History recorded

- `crm_lead_status_history` on stage changes
- `crm_lead_assignments` on assign
- GET `/leads/:id/status-history`, `/assignment-history`

## Opportunity lifecycle

```
OPEN → (stage moves via PATCH stageId) → WON | LOST
```

| Action | Endpoint |
|--------|----------|
| Create | POST /opportunities |
| Move stage | PATCH (stageId) |
| Win | POST /:id/win |
| Lose | POST /:id/lose |
| Delete | DELETE (soft) |

**Gap:** PATCH can still set status directly — should mirror lead sanitizer.

## Lead conversion transaction

Single DB transaction creates:

1. `CrmOpportunity` with default or supplied pipeline/stage
2. Opportunity lines (if provided)
3. Lead updated to `converted` / `converted_to_opportunity`
4. Status history row
5. Links company/contact from lead

## Follow-up lifecycle

Statuses: `pending`, `overdue`, `completed`, `cancelled`, `snoozed`

Overdue derived in repository (`deriveFollowUpStatus`) comparing `dueDate` to today — not frontend-only.

| Action | Endpoint |
|--------|----------|
| Complete | POST /:id/complete |
| Reschedule | POST /:id/reschedule |
| Snooze | POST /:id/snooze |
| Cancel | PATCH status or DELETE |

## Activity lifecycle

Statuses: `PLANNED`, `COMPLETED`, `CANCELLED`

| Action | Endpoint |
|--------|----------|
| Complete | POST /:id/complete with outcome/nextAction |

## Company / Contact

- Soft delete via `deletedAt`
- FK validation on lead/opportunity create — company/contact must belong to tenant
- Delete should guard when open opportunities exist (verify per service)

## End-to-end flows (test targets)

### Lead-to-win

Company → Contact → Lead → Assign → Activity → Follow-up → Qualify → Convert → Line items → Stage moves → Win → Dashboard/report verification

### Lead-to-lost

Lead → Activity → Follow-up → Disqualify/mark lost → Report verification

### Tenant isolation

Tenant A data inaccessible from Tenant B token; tampered IDs return 403/404.
