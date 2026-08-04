# Purchase Return Workflow

**Status:** READY WITH CONDITIONS  
**Owner:** Purchase (operational return) · Inventory (stock) · Money Out (vendor liability)

## Lifecycle

```text
Create from QI (wizard prefill)
  → DRAFT
  → SUBMIT (Purchase)
  → APPROVE (Quality / Purchase complete permission)
  → SHIP optional (RETURN_IN_TRANSIT: REJECTED → BLOCKED)
  → COMPLETE (RETURNED_TO_VENDOR: stock issue from BLOCKED/REJECTED)
  → Vendor Adjustment DRAFT (Money Out) when returnType credits AP
```

## Return types

| Type | Inventory | AP handoff |
|------|-----------|------------|
| CREDIT | Issue rejected stock | Vendor Debit Note draft |
| REPLACEMENT | Issue rejected stock | No auto AP; link replacement GRN |
| REPAIR | Issue | Debit draft when eligible |
| INSPECTION | Issue | No auto AP |
| SCRAP_VENDOR | Issue | Debit draft when eligible |

## Validation (returnable qty)

`computeRemainingReturnable`:

- Source rejected qty from Purchase QI (preferred) or GRN
- Subtract open + completed returns
- Block cancelled GRNs
- Create/complete re-check remaining

## AP

Purchase return **never posts GL**.  
`handoffPurchaseReturnToVendorAdjustmentDraft` creates a Vendor Adjustment draft via Money Out only.

See [VENDOR_ADJUSTMENT.md](./VENDOR_ADJUSTMENT.md).

## APIs

| Action | Path |
|--------|------|
| Wizard prefill | `GET /purchase/returns/wizard-prefill?qualityInspectionId=` |
| From QI | `GET /purchase/quality-inspections/:id/purchase-return-prefill` |
| Ship | `POST /purchase/returns/:id/ship` |
| Complete | `POST /purchase/returns/:id/complete` |
| AP preview | `GET /purchase/returns/:id/ap-adjustment-preview` |
| AP create | `POST /purchase/returns/:id/ap-adjustment` |
| Link replacement GRN | `POST /purchase/returns/:id/link-replacement-grn` |
| Trace chain | `GET /purchase/returns/trace?…` |

## Permissions

- Create: `purchase.return.create`
- Approve/complete/ship: `purchase.return.complete`
- Cancel: `purchase.return.cancel`
- Money Out posts adjustment with finance permissions

## Related

- [SUPPLIER_QUALITY.md](./SUPPLIER_QUALITY.md)
- [VENDOR_ADJUSTMENT.md](./VENDOR_ADJUSTMENT.md)
- [SUPPLIER_PERFORMANCE.md](./SUPPLIER_PERFORMANCE.md)
