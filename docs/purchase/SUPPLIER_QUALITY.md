# Supplier Quality

**Status:** READY WITH CONDITIONS

## Principle

| Domain | Owns |
|--------|------|
| Quality | Incoming QC governance, optional NCR |
| Purchase | QI document, Purchase Return, trace |
| Inventory | QC_HOLD / REJECTED / issue on return |
| Money Out | Vendor liability & adjustments |

## QI decision (every complete needs a reason)

`decisionCode` + `decisionReason` required on complete:

- ACCEPT  
- PARTIAL  
- REJECT  
- DEVIATION_ACCEPT  
- QUARANTINE  
- REWORK  
- RETURN_TO_VENDOR  
- REPLACEMENT_REQUIRED  

## Post-rejection actions (user choice)

1. Create Purchase Return  
2. Create NCR (`sourceType=PURCHASE_QI`)  
3. Create both  

NCR is **never** auto-forced.

## Replacement

1. Return type `REPLACEMENT`  
2. Complete return (stock out)  
3. Vendor ships replacement → GRN  
4. Link GRN: `POST …/returns/:id/link-replacement-grn`  
5. Replacement QI → release stock  

## Traceability

`GET /purchase/returns/trace` walks:

PR → PO → GRN → Purchase QI → Purchase Return → Vendor Adjustment → Replacement GRN → Replacement QI → NCR  

## Reports

`GET /purchase/supplier-quality/reports`  
Dashboard widgets: `GET /purchase/supplier-quality/dashboard-widgets`  

See [SUPPLIER_PERFORMANCE.md](./SUPPLIER_PERFORMANCE.md).
