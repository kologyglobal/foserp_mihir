/**
 * Central document registry for Document Governance date controls.
 * Extensible by module — rules must not be hardcoded in module services.
 */

export type DocumentRegistryEntry = {
  moduleKey: string
  moduleLabel: string
  documentType: string
  documentLabel: string
}

/** Initial CRM + Purchase catalog. Add rows for future modules without changing engines. */
export const DOCUMENT_GOVERNANCE_REGISTRY: DocumentRegistryEntry[] = [
  // CRM
  { moduleKey: 'crm', moduleLabel: 'CRM', documentType: 'QUOTATION', documentLabel: 'Quotation' },
  { moduleKey: 'crm', moduleLabel: 'CRM', documentType: 'SALES_ORDER', documentLabel: 'Sales Order' },
  {
    moduleKey: 'crm',
    moduleLabel: 'CRM',
    documentType: 'PROFORMA_INVOICE',
    documentLabel: 'Proforma Invoice',
  },
  { moduleKey: 'crm', moduleLabel: 'CRM', documentType: 'TAX_INVOICE', documentLabel: 'Tax Invoice' },

  // Purchase
  {
    moduleKey: 'purchase',
    moduleLabel: 'Purchase',
    documentType: 'PURCHASE_REQUISITION',
    documentLabel: 'Purchase Requisition',
  },
  { moduleKey: 'purchase', moduleLabel: 'Purchase', documentType: 'RFQ', documentLabel: 'RFQ' },
  {
    moduleKey: 'purchase',
    moduleLabel: 'Purchase',
    documentType: 'PURCHASE_ORDER',
    documentLabel: 'Purchase Order',
  },
  { moduleKey: 'purchase', moduleLabel: 'Purchase', documentType: 'GRN', documentLabel: 'GRN' },
  {
    moduleKey: 'purchase',
    moduleLabel: 'Purchase',
    documentType: 'PURCHASE_INVOICE',
    documentLabel: 'Purchase Invoice',
  },
  {
    moduleKey: 'purchase',
    moduleLabel: 'Purchase',
    documentType: 'PURCHASE_RETURN',
    documentLabel: 'Purchase Return',
  },
]

export function listDocumentTypes(moduleKey?: string): DocumentRegistryEntry[] {
  if (!moduleKey) return [...DOCUMENT_GOVERNANCE_REGISTRY]
  return DOCUMENT_GOVERNANCE_REGISTRY.filter((e) => e.moduleKey === moduleKey)
}

export function isRegisteredDocument(moduleKey: string, documentType: string): boolean {
  return DOCUMENT_GOVERNANCE_REGISTRY.some(
    (e) => e.moduleKey === moduleKey && e.documentType === documentType,
  )
}

export function getRegistryEntry(
  moduleKey: string,
  documentType: string,
): DocumentRegistryEntry | undefined {
  return DOCUMENT_GOVERNANCE_REGISTRY.find(
    (e) => e.moduleKey === moduleKey && e.documentType === documentType,
  )
}
