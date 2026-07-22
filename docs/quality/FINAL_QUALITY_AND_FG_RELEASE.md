# Final Quality and FG Release (Phase 7B)

## Policies

### A — Quality before FG Receipt (default `qualityBeforeFgReceipt = true`)

Final PASS establishes FG **eligibility**. `completeWorkOrder` / FG receipt remains a **separate** Inventory transaction into `finishedGoodsWarehouseId`, still gated by quality blockers.

### B — Physical receipt into Quality Hold first

When `qualityHoldWarehouseId` is mapped and policy B is selected, output may land in Quality Hold. After PASS, `QualityReleaseService` posts ISSUE(hold)+INWARD(FG) with `QUALITY_RELEASE` reference.

## Rules

- Accepted qty cannot exceed final eligible Good output
- Unrestricted FG receipt cannot exceed Quality accepted qty
- Rejected / held qty is not dispatchable
- Do not combine decide + FG receipt into one hidden controller action
