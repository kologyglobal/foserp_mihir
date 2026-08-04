# Supplier Performance

**Status:** READY WITH CONDITIONS

Live aggregation (no duplicate KPI store). Source: GRN, Purchase QI, Purchase Return, Vendor Adjustment.

## Vendor scorecard

`GET /purchase/supplier-quality/vendors/:vendorId/scorecard`

| Metric | Source |
|--------|--------|
| Total deliveries | GRN count |
| Accepted / Rejected qty | QI lines |
| Return qty | Purchase Return lines |
| Replacement returns | returnType=REPLACEMENT |
| Inspection pass % | accepted / (accepted+rejected) |
| Quality rating A–D | score bands |
| Avg turnaround | QI created→completed hours |
| Open QI / returns / adjustments | open statuses |
| On-time delivery % | GRN `receiptDate` vs PO `expectedDeliveryDate` (else earliest PO line `requiredDate`). On-time when receipt calendar day ≤ promised day. Sample excludes GRNs with no promised date → `onTimeDeliveryPct` is `null` when sample is empty (field always present). |

## Item history

`GET /purchase/supplier-quality/items/:itemId/history`  
Timeline: Receipt · QI · Return · Adjustment · Replacement

## Vendor 360

Use scorecard + standard vendor master links to PO/GRN/returns. Open adjustments via Money Out vendor adjustment register.

## Reports in response payload

- Supplier rejection ranking  
- Most rejected items  
- Supplier returns summary  
- Replacement pending  
- Rejected stock balances  
- Pending returns list  
- Dashboard widgets (pending returns, rejected stock qty, replacement pending, vendor adjustments pending, top vendors/items)
