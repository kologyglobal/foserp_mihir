# Operator UX Guide — Manufacturing Phase 2B

Mobile/tablet-first guidance for shopfloor operators. Complexity stays in the backend; the UI shows only executable work.

## Access

- Route: `/manufacturing/my-work`
- Permission: `manufacturing.operator.my_work` (+ start / pause / complete / issue.report)
- Operators see **only their** assignments. Supervisors may view another operator via explicit filter + `manufacturing.assignment.view`.

## What operators see

Per task card:

- Work Order number, product name
- Stage (and Operation in Detailed mode)
- Target, Completed, Balance
- Work Centre, Machine
- Priority / due (when present)
- Short work instruction
- Status + allowed actions from the API (`allowedActions`)

What operators **do not** see: BOM tree, routing config, SO commercial data, costing, valuation, dependency graphs, approval rules.

## Actions

| Status | Primary actions |
|--------|-----------------|
| ASSIGNED / ACCEPTED | **Start** |
| IN_PROGRESS | **Pause**, **Complete**, **Report Problem** |
| PAUSED | **Resume**, **Report Problem** |
| COMPLETED / CANCELLED | No execution actions |

Touch targets are ≥ 44–48 px with icon + text labels. Status is shown as text (and colour) — do not rely on colour alone.

## Complete Work sheet

Asks only:

1. Good Quantity  
2. Rework Quantity  
3. Rejected Quantity  
4. Scrap Quantity  
5. Remarks (optional)

Shows total entered and remaining after update. Submit uses an **idempotency key** so double-taps do not double-post.

Labour/machine hours are **not** asked by default; elapsed time is derived from start/pause/resume where tracked.

## Report Problem

Bottom sheet: pick a reason (Material Missing, Machine Problem, Tool Not Available, Power Failure, Quality Issue, Drawing/Spec, Safety, Other), optional remark, “Is production fully stopped?”.

Context (WO, Stage, Operation, Assignment, Machine, time) is filled automatically.

Success: “Issue reported — Supervisor has been notified” (in-app visibility). External push/email is **not** promised unless a real notification system is wired.

Material / machine / quality issues are **informational** in Phase 2B — they do not create Purchase, Maintenance, or QC transactions.

## Network failures

- Submitting state + disabled buttons while in flight  
- Retain entered quantities on failure  
- Retry with the same idempotency key  
- Refresh task state after success  

Do not treat browser `localStorage` as the system of record for completed production.

## Language

All operator-facing copy goes through translation keys in `operatorStrings.ts` (`t('…')`). English is the current map; keys are ready for Hindi and Gujarati locale files later.

## Accessibility

Labels on icon buttons, keyboard access where applicable, focus management in sheets, sufficient contrast, clear validation messages.
