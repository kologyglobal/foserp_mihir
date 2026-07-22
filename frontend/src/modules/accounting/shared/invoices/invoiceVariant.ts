/**
 * Shared Accounting invoice UX primitives (Phase 8: master reuse + UX alignment).
 * `variant` picks the master + drill-down family:
 * - "crm"      → Sales Invoice — party master is CRM Company (masterStore.customers)
 * - "purchase" → Vendor Invoice — party master is MasterVendor (masterStore.vendors)
 */
export type InvoiceShellVariant = 'crm' | 'purchase'

export const INVOICE_VARIANT_LABELS: Record<InvoiceShellVariant, { party: string; masterName: string }> = {
  crm: { party: 'Customer', masterName: 'CRM Company' },
  purchase: { party: 'Vendor', masterName: 'Vendor Master' },
}

/** 360 / master detail route for a party id. */
export function partyMasterRoute(variant: InvoiceShellVariant, partyId: string): string {
  return variant === 'crm' ? `/masters/companies/${partyId}/360` : `/masters/vendors/${partyId}`
}

/** Full master create form (quick-create drawer is demo-only; API mode uses the full form). */
export function partyMasterCreateRoute(variant: InvoiceShellVariant): string {
  return variant === 'crm' ? '/masters/companies/new' : '/masters/vendors/new'
}

/** Drill-down route for a source document. */
export function sourceDocumentRoute(
  sourceType: string,
  sourceDocumentId: string,
): string | null {
  switch (sourceType) {
    case 'SALES_ORDER':
      return `/crm/sales-orders/${sourceDocumentId}`
    case 'OUTBOUND_DISPATCH':
      return `/dispatch/${sourceDocumentId}`
    case 'PURCHASE_ORDER':
      return `/purchase/orders/${sourceDocumentId}`
    case 'GOODS_RECEIPT':
      return `/purchase/grn/${sourceDocumentId}`
    default:
      return null
  }
}

export function sourceTypeLabel(sourceType: string): string {
  switch (sourceType) {
    case 'DIRECT':
      return 'Direct'
    case 'SALES_ORDER':
      return 'Sales Order'
    case 'OUTBOUND_DISPATCH':
      return 'Outbound Dispatch'
    case 'PURCHASE_ORDER':
      return 'Purchase Order'
    case 'GOODS_RECEIPT':
      return 'Goods Receipt (GRN)'
    case 'PURCHASE_RECEIPT':
      return 'Purchase Receipt'
    case 'CONTRACT':
      return 'Contract'
    case 'PROJECT':
      return 'Project'
    case 'OTHER':
      return 'Other'
    default:
      return sourceType.replace(/_/g, ' ')
  }
}
