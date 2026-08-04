# Vendor Adjustment (from Purchase Return)

**Status:** READY WITH CONDITIONS  
**Owner:** Money Out / AP — Purchase only **hands off** draft creation.

## Rule

Purchase Return **must not post GL**.

After return **COMPLETED**, eligible CREDIT/REPAIR/SCRAP_VENDOR returns call:

`handoffPurchaseReturnToVendorAdjustmentDraft`

→ creates **Vendor Adjustment** DRAFT with `adjustmentType=VENDOR_DEBIT_NOTE`, `reason=PURCHASE_RETURN`.

## Eligibility

- Posted Purchase Invoice exists against GRN/PO lines  
- Returned qty not already adjusted on prior returns  
- `eligibleQuantity = min(returned, invoiced − alreadyAdjusted)`  

Reasons: `ELIGIBLE | NO_POSTED_INVOICE | ALREADY_ADJUSTED | ZERO_VALUE | RETURN_NOT_COMPLETED`

## Accounting status on return

| accountingStatus | Meaning |
|------------------|---------|
| NONE | No handoff or not eligible |
| DRAFT | Vendor Adjustment draft created |
| POSTED | Adjustment posted in Money Out |
| ADJUSTED | Settled (reserved for later) |
| CANCELLED | Cancelled |

## Money Out owns

- Liability  
- Post / reverse  
- Outstanding  
- Allocation  
- Payment  

## UI

- Return DTO: `vendorAdjustmentId`, `vendorAdjustmentHref`, `accountingStatus`  
- Open Money Out Vendor Adjustments document after handoff  
