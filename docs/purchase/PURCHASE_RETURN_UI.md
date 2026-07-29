# Purchase Return UI

Route: `/purchase/returns`

## Inventory

Complete/Post issues stock via Inventory Costing (method-driven). Returnable qty is backend-derived (`createPurchaseReturnFromGrn` fails with RETURN_NO_QTY when none).

## Accounting

**ACCOUNTING_ADJUSTMENT_PENDING** in API mode after stock post: no automatic Vendor Debit Note / AP reduction. Use Money Out vendor adjustments when a posted Vendor Invoice exists.

Debit note + replacement PO actions remain demo-only / notSupportedInApiMode.

## Permissions

`purchase.return.view|create|edit|submit|complete|cancel`
