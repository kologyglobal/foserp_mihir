# Daily Production Update Form UX (FORM 6)

Route: `/manufacturing/daily-update` (`DailyUpdatePage.tsx`, API mode only).

## Structure

- Batch selector (today's batches) + status chip (Draft / Submitted / Partially reversed / Reversed).
- Line grid (`DailyProductionGrid`): per-line Good / Rework / Rejected / Scrap / Remarks
  with inline editing while Draft.
- **Sticky bottom action bar**: line count + totals (Good/Rework/Rejected/Scrap),
  Save Draft, Validate, Submit — tablet-friendly.

## Add line (modernised)

- **Work Order selector** — running work orders only (`listWorkOrders({status: IN_PROGRESS})`),
  labelled `WO-No · planned qty`. Raw ID entry removed.
- **Stage selector** — loaded from the selected WO (`getWorkOrderDetail`), only stages in
  READY/IN_PROGRESS, labelled `name · planned · good`; auto-selected when only one stage
  qualifies. Empty-state hint when no stage is ready.
- Good Quantity numeric field.

## Submit experience

- Validate action runs server validation without posting.
- Submit uses `appConfirm` with a totals preview:
  `N lines · Good X · Rework Y · Rejected Z · Scrap W` and the note that the batch becomes
  read-only after posting progress to work orders.
- Submitted batches are read-only (explicit state text); corrections go through
  `correctDailyProductionLine` / corrections flows.

## States

- Demo mode: explicit "API required" empty state (no mock data).
- Missing permission: explicit access-denied state.
- No batch: empty state with create action (permission-gated).
