# Runtime Change Request Form UX (FORM 14)

Component: `frontend/src/modules/manufacturing/work-orders/RuntimeChangeDrawer.tsx`
plus the Changes tab on Work Order detail.

## Flow

1. **Request** (Change / Exception action): change type → dynamic fields → server preview → create draft.
2. **Submit for approval** (draft rows in Changes tab).
3. **Approve / Reject** — reject requires a reason (`appPromptNote`, mandatory note).
4. **Apply** — server executes the change; APPLIED/FAILED states surfaced.
5. **Cancel** — confirmation via `appConfirm` (danger tone).

## Changes tab columns

Change (type + number), Status (human labels from `RUNTIME_CHANGE_STATUS_LABELS`),
Risk, Requested by/on (user names resolved), Reason, contextual actions filtered by
permissions (`canRequestRuntimeChange`, `canApproveRuntimeChange`, `canApplyRuntimeChange`,
`canRejectRuntimeChange`).

## Rules

- Current → proposed preview comes from the server preview endpoint before creation.
- No generic confirms; destructive actions state consequences.
- Approval history stays in the work order timeline.
