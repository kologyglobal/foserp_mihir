# Approval Authority

Document-wise amount bands (`approval_authority_rules`):

- Quotation, Sales Order, PR, PO, GRN exception, Purchase Invoice, Stock Adjustment, Tax Invoice, Receipt, Vendor Payment

Fields: amountFrom / amountTo, roleId or userId, optional branch/LE, selfApprovalAllowed.

API: `/api/v1/t/:tenantSlug/approval-authority`

Complements module engines (e.g. purchase approver limits). Soft self-approval risk on Access Review.
