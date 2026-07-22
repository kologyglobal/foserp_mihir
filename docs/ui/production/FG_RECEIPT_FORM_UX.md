# Finished Goods Receipt Form UX (FORM 21)

Component: `frontend/src/modules/manufacturing/work-orders/components/FgReceiptDrawer.tsx`
Entry points:

- Work Order detail — primary command **Receive Finished Goods** when status is
  COMPLETED and the user has `manufacturing.fg_receipt.post`.
- Next-best-action banner: "Production complete — receive finished goods into inventory."

## Flow

1. **Eligibility load** (`GET /work-orders/:id/fg-eligibility`) — server computes:
   - Planned, Good produced, Already received, **Eligible now**
   - quality hold (blockers zero eligibility), stockability, batch/serial requirements.
2. **Entry**: Receipt Quantity (defaults to eligible), Receipt Date, Batch/Lot
   (required when profile enforces batch tracking), Remarks.
3. **Validation**: field-level (cannot exceed eligible), document-level via
   `ValidationSummary` (not stockable / quality hold / nothing eligible).
4. **Preview before post**: `POST /fg-receipts/preview` — server errors block posting and
   are shown in the summary.
5. **Post**: `POST /fg-receipts` with idempotency key. Success toast includes quantity and
   WO number; page reloads server state.

## Impact preview

`PostingImpactPanel`:
- Finished goods inventory: + quantity
- Eligible after posting (turns success tone at zero)
- Warning: "This action creates an Inventory transaction and cannot be directly edited.
  Use a correction to reverse."

## Rules

- Eligible = accepted good production − already received (server-computed; never planned qty).
- Quality blockers force zero unrestricted eligibility — surfaced as a blocker with
  guidance to open Quality.
- Reversal only via correction/compensating flow, never edit/delete.
