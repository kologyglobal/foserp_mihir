import type { ErpCardTab } from './types'

/** Standard transaction form tabs */
export const ERP_CARD_FORM_TABS_STANDARD: ErpCardTab[] = [
  { id: 'home', label: 'Home' },
  { id: 'lines', label: 'Lines' },
  { id: 'related', label: 'Related' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'history', label: 'History' },
  { id: 'attachments', label: 'Attachments' },
  { id: 'more', label: 'More Options' },
]

/** Primary workspace tabs — shown during create/edit */
export const ERP_WORKSPACE_TABS_LEAD: ErpCardTab[] = [
  { id: 'general', label: 'General' },
  { id: 'requirement', label: 'Requirement' },
  { id: 'followup', label: 'Follow-up' },
  { id: 'notes', label: 'Notes' },
]

export const ERP_WORKSPACE_TABS_OPPORTUNITY: ErpCardTab[] = [
  { id: 'general', label: 'General' },
  { id: 'products', label: 'Products' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'followup', label: 'Follow-up' },
  { id: 'notes', label: 'Notes' },
]

export const ERP_WORKSPACE_TABS_QUOTATION: ErpCardTab[] = [
  { id: 'general', label: 'General' },
  { id: 'products', label: 'Products' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'terms', label: 'Terms' },
  { id: 'notes', label: 'Notes' },
]

export const ERP_WORKSPACE_TABS_SALES_ORDER: ErpCardTab[] = [
  { id: 'customer', label: 'Customer & PO' },
  { id: 'lines', label: 'Products' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'notes', label: 'Notes' },
]

/** Deferred tabs — available after first save */
export const ERP_WORKSPACE_TABS_DEFERRED: ErpCardTab[] = [
  { id: 'history', label: 'History' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'attachments', label: 'Attachments' },
  { id: 'approval', label: 'Approval' },
]

/** CRM lead / opportunity form tabs */
export const ERP_CARD_FORM_TABS_CRM: ErpCardTab[] = [
  { id: 'general', label: 'General' },
  { id: 'company', label: 'Company & Contact' },
  { id: 'products', label: 'Products' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'followups', label: 'Follow-ups' },
  { id: 'activities', label: 'Activities' },
  { id: 'quotation', label: 'Quotation' },
  { id: 'history', label: 'History' },
  { id: 'attachments', label: 'Attachments' },
]

/** Quotation document form tabs */
export const ERP_CARD_FORM_TABS_QUOTATION: ErpCardTab[] = [
  { id: 'general', label: 'General' },
  { id: 'customer', label: 'Customer' },
  { id: 'products', label: 'Products' },
  { id: 'taxes', label: 'Taxes & Charges' },
  { id: 'terms', label: 'Terms' },
  { id: 'approval', label: 'Approval' },
  { id: 'preview', label: 'Preview' },
  { id: 'revisions', label: 'Revision History' },
  { id: 'attachments', label: 'Attachments' },
]

/** Proforma invoice form tabs */
export const ERP_CARD_FORM_TABS_PROFORMA: ErpCardTab[] = [
  { id: 'general', label: 'General' },
  { id: 'customer', label: 'Customer' },
  { id: 'lines', label: 'Lines' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'tax', label: 'Tax Summary' },
  { id: 'preview', label: 'Preview' },
]

/** Sales order form tabs */
export const ERP_CARD_FORM_TABS_SALES_ORDER: ErpCardTab[] = [
  { id: 'general', label: 'General' },
  { id: 'customer', label: 'Customer' },
  { id: 'lines', label: 'Lines' },
  { id: 'commercial', label: 'Commercial Terms' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'documents', label: 'Documents' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'history', label: 'History' },
]

/** Purchase requisition — BC ERP document tabs */
export const ERP_CARD_FORM_TABS_PR: ErpCardTab[] = [
  { id: 'general', label: 'General' },
  { id: 'lines', label: 'Lines' },
  { id: 'planning', label: 'Planning' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'dimensions', label: 'Dimensions' },
  { id: 'approval', label: 'Approval' },
  { id: 'attachments', label: 'Attachments' },
  { id: 'history', label: 'History' },
]

/** PR create — lines-first, minimal tabs */
export const ERP_CARD_FORM_TABS_PR_CREATE: ErpCardTab[] = [
  { id: 'lines', label: 'Lines' },
  { id: 'general', label: 'General' },
  { id: 'attachments', label: 'Attachments' },
]

/** RFQ form tabs */
export const ERP_CARD_FORM_TABS_RFQ: ErpCardTab[] = [
  { id: 'general', label: 'General' },
  { id: 'items', label: 'Items' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'terms', label: 'Terms' },
  { id: 'responses', label: 'Responses' },
  { id: 'comparison', label: 'Comparison' },
  { id: 'documents', label: 'Documents' },
  { id: 'timeline', label: 'Timeline' },
]

/** RFQ create — lines-first workspace */
export const ERP_CARD_FORM_TABS_RFQ_CREATE: ErpCardTab[] = [
  { id: 'lines', label: 'Lines' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'terms', label: 'Terms' },
]

/** Vendor quotation form tabs */
export const ERP_CARD_FORM_TABS_VENDOR_QUOTE: ErpCardTab[] = [
  { id: 'general', label: 'General' },
  { id: 'lines', label: 'Lines' },
  { id: 'commercial', label: 'Commercial Terms' },
  { id: 'attachments', label: 'Attachments' },
  { id: 'comparison', label: 'Comparison' },
  { id: 'timeline', label: 'Timeline' },
]

/** Purchase order form tabs */
export const ERP_CARD_FORM_TABS_PO: ErpCardTab[] = [
  { id: 'general', label: 'General' },
  { id: 'lines', label: 'Lines' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'commercial', label: 'Commercial Terms' },
  { id: 'tax', label: 'Tax & Charges' },
  { id: 'approval', label: 'Approval' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'documents', label: 'Documents' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'audit', label: 'Audit' },
]

/** PO create — direct from approved PR (skip RFQ) */
export const ERP_CARD_FORM_TABS_PO_CREATE: ErpCardTab[] = [
  { id: 'lines', label: 'Lines' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'commercial', label: 'Commercial' },
]

/** GRN form tabs */
export const ERP_CARD_FORM_TABS_GRN: ErpCardTab[] = [
  { id: 'general', label: 'General' },
  { id: 'lines', label: 'Receipt Lines' },
  { id: 'gate', label: 'Gate Details' },
  { id: 'qc', label: 'QC' },
  { id: 'lot', label: 'QR / Lot' },
  { id: 'putaway', label: 'Putaway' },
  { id: 'documents', label: 'Documents' },
  { id: 'timeline', label: 'Timeline' },
]

/** Purchase return form tabs */
export const ERP_CARD_FORM_TABS_RETURN: ErpCardTab[] = [
  { id: 'general', label: 'General' },
  { id: 'lines', label: 'Lines' },
  { id: 'transport', label: 'Transport' },
  { id: 'documents', label: 'Documents' },
  { id: 'timeline', label: 'Timeline' },
]

/** Master data form tabs (company, item, vendor) */
export const ERP_CARD_FORM_TABS_MASTER: ErpCardTab[] = [
  { id: 'home', label: 'Home' },
  { id: 'related', label: 'Related' },
  { id: 'history', label: 'History' },
  { id: 'attachments', label: 'Attachments' },
]
