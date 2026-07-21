/** Purchase Master Setup — procurement reference data */

export type PurchaseMasterStatus = 'active' | 'inactive'

/** Purchase-native reference masters (payment/delivery terms live in CRM — linked from hub) */
export type PurchaseMasterKind =
  | 'freight-terms'
  | 'qc-rules'
  | 'grn-tolerance'
  | 'buyers'
  | 'return-reasons'
  | 'bin-codes'

/** Commercial term kinds used on PO/RFQ forms — payment & delivery resolve from CRM */
export type PurchaseCommercialTermKind = 'payment-terms' | 'delivery-terms' | 'freight-terms'

export type PurchaseMasterUsedIn =
  | 'requisitions'
  | 'rfqs'
  | 'purchase-orders'
  | 'grn'
  | 'returns'
  | 'vendor-quotations'
  | 'reports'

export interface PurchaseMasterAuditEvent {
  action: 'created' | 'updated' | 'deactivated' | 'activated' | 'duplicated' | 'imported' | 'deleted'
  at: string
  by: string
  detail?: string
}

export interface PurchaseMasterEntry {
  id: string
  kind: PurchaseMasterKind
  code: string
  name: string
  status: PurchaseMasterStatus
  sortOrder: number
  description?: string
  notes?: string
  attributes: Record<string, string | number | boolean | null>
  systemControlled?: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  modifiedBy?: string
  auditHistory?: PurchaseMasterAuditEvent[]
}

export interface PurchaseMasterFieldDef {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'textarea' | 'boolean'
  required?: boolean
  options?: { value: string; label: string }[]
  placeholder?: string
  section?: 'basic' | 'description' | 'configuration' | 'reference' | 'notes'
}

export interface PurchaseMasterCatalogItem {
  kind: PurchaseMasterKind
  slug: string
  title: string
  description: string
  purpose?: string
  group: 'vendor' | 'item' | 'terms' | 'receiving' | 'governance'
  usedIn?: PurchaseMasterUsedIn[]
  importExport?: boolean
  fields: PurchaseMasterFieldDef[]
}

export type PurchaseLinkedMasterSource = 'global' | 'crm' | 'quality' | 'governance'

export interface PurchaseLinkedMaster {
  slug: string
  title: string
  description: string
  group: PurchaseMasterCatalogItem['group']
  listRoute: string
  newRoute: string
  /** Where CRUD is maintained — shown on linked master redirect page */
  sourceModule: PurchaseLinkedMasterSource
  /** Purchase documents that consume this register */
  usedInPurchase?: PurchaseMasterUsedIn[]
}

export interface PurchaseMasterSettings {
  defaultGrnTolerancePct: number
}
