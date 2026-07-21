# Purchase Create/Edit Footer Audit

Date: 2026-07-21

## Standard

Registered Purchase create/edit forms use the shared `FormActionBar` with:

- Cancel first.
- Save as the rightmost primary action.
- A responsive full-width mobile action group.
- Save disabled while an API request is in flight.
- The standard application confirmation dialog when Cancel discards dirty data.
- No submit, approval, verification, posting, send-to-vendor, close, or reopen action.

## Registered document forms

- Purchase Requisition — `/purchase/requisitions/new`, `/purchase/requisitions/:id/edit`
  - Previous: Cancel, Save, and Submit for Approval on edit.
  - Now: Cancel, Save.
  - Save: `createPurchaseRequisition` / `updatePurchaseRequisition`.
  - Cancel and success: `/purchase/requisitions`.
  - Submit remains on `PurchaseRequisitionDomainDetailPage`.

- RFQ — `/purchase/rfqs/new`, `/purchase/rfqs/:id/edit`
  - Previous: Cancel, Save.
  - Now: Cancel, Save through the shared action bar.
  - Save: `createRFQ` / `updateRFQ`.
  - Cancel and success: `/purchase/rfqs`.
  - Send RFQ remains on `RfqDetailPage`.

- Vendor Quotation — `/purchase/vendor-quotations/new`, `/purchase/vendor-quotations/:id/edit`
  - Previous: Cancel, Save Draft, Save & Submit.
  - Now: Cancel, Save.
  - Save: `createVendorQuotation` / `updateVendorQuotation`.
  - Cancel and success: `/purchase/vendor-quotations`.
  - Submit remains on `VendorQuotationDetailPage`.

- Purchase Order — `/purchase/orders/new`, `/purchase/orders/:id/edit`
  - Previous: Cancel, Save, Submit for Approval.
  - Now: Cancel, Save.
  - Save: `createPurchaseOrder` / `updatePurchaseOrder`.
  - Cancel and success: `/purchase/orders`.
  - Submit and release actions remain on `PurchaseOrderDetailPage`.

- Purchase Order Revision — `/purchase/orders/:id/revise`, `/purchase/orders/:id/amend`
  - Previous: Back, Save as Revision, plus a duplicate command-bar save.
  - Now: Cancel, Save.
  - Save: `revisePurchaseOrder` (the backend revision endpoint is intentionally single-step).
  - Cancel and success: `/purchase/orders`.

- Goods Receipt Note — `/purchase/grn/new`, `/purchase/grn/:id/edit`
  - Previous: Cancel, Save Draft, Submit.
  - Now: Cancel, Save.
  - Save: `createGRNFromPo` / `updateGRN`.
  - Cancel and success: `/purchase/grn` (the registered list route).
  - Submit and Post GRN remain on `GrnDetailPage`.

- Purchase Return — `/purchase/returns/new`, `/purchase/returns/:id/edit`
  - Previous: Cancel, Save Draft, Submit for Approval.
  - Now: Cancel, Save.
  - Save: `createPurchaseReturn` / `updatePurchaseReturn`.
  - Cancel and success: `/purchase/returns`.
  - Submit remains on `PurchaseReturnDetailPage`.

- Purchase Invoice — `/purchase/invoices/new`, `/purchase/invoices/:id/edit`
  - Previous: Cancel, Save, Verify, Send for Approval.
  - Now: Cancel, Save.
  - Save: `createPurchaseInvoice` / `createDirectPurchaseInvoice` / `updatePurchaseInvoice`.
  - Cancel and success: `/purchase/invoices`.
  - Verify and Send for Approval remain on `PurchaseInvoiceDetailPage`.

## Embedded and non-document forms

- Purchase Planning edit drawer on `/purchase/planning-sheet`
  - Cancel and Save were retained and migrated to embedded `FormActionBar`.
  - Save: `updatePurchasePlanningSheetRow`.
  - Success closes the drawer and refreshes the planning row; this is deliberate in-page source context.

- Purchase-specific master create/edit routes under `/purchase/masters/:kind`
  - Duplicate command-bar actions were removed.
  - Footer is now Cancel and Save through `FormActionBar`.
  - Cancel and success return to the matching master list.
  - These existing generic master forms still use `purchaseMasterStore`; backend migration was outside this footer-only change.

## Deliberate exclusions

- `/purchase/comparison/:rfqId` is a comparison/detail workflow, not a create/edit form.
- `/purchase/quality-inspections/:id` is the registered detail and lifecycle workspace; there is no Purchase quality create/edit route.
- `/purchase/setup` is an in-place setup workspace, not a create/edit document route. Its dedicated setup save action remains.
- Legacy `PoFormPages`, `RfqFormPages`, `PurchaseDocumentPages`, `PurchaseExtendedPages`, and `PoAmendFormPage` are not used by the registered Purchase create/edit routes.

## Verification

- `npm run test:purchase-form-footers` — 80/80 checks pass across seven registered document editors.
- `npm run test:purchase:production` — 39/39 checks pass.
- Frontend TypeScript typecheck passes.
- Frontend production build passes.
- Targeted lint passes with pre-existing hook warnings only.
- Full-repository lint remains non-zero because of the existing syntax error in `scripts/generate-uat-deliverables.ts` and the repository-wide warning baseline.
