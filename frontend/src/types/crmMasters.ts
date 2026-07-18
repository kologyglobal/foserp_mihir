/** CRM Master Setup — configuration reference data for CRM transactions */

export type CrmMasterStatus = 'active' | 'inactive'

export type CrmMasterKind =
  | 'lead-sources'
  | 'industries'
  | 'territories'
  | 'designations'
  | 'departments'
  | 'owners'
  | 'lead-stages'
  | 'lead-priorities'
  | 'lead-reasons'
  | 'opportunity-stages'
  | 'opportunity-priorities'
  | 'activity-types'
  | 'product-interests'
  | 'lost-reasons'
  | 'commercial-terms'
  | 'payment-terms'
  | 'delivery-terms'
  | 'warranty-terms'
  | 'approval-rules'
  | 'document-types'

export type CrmLeadReasonCategory = 'inactive' | 'closed' | 'not_qualified' | 'archive'

export type CrmMasterUsedIn =
  | 'leads'
  | 'opportunities'
  | 'quotations'
  | 'sales-orders'
  | 'invoices'
  | 'companies'
  | 'contacts'
  | 'customer360'
  | 'reports'

export interface CrmMasterAuditEvent {
  action: 'created' | 'updated' | 'deactivated' | 'activated' | 'duplicated' | 'imported' | 'deleted'
  at: string
  by: string
  detail?: string
}

export interface CrmMasterEntry {
  id: string
  kind: CrmMasterKind
  code: string
  name: string
  status: CrmMasterStatus
  sortOrder: number
  description?: string
  notes?: string
  attributes: Record<string, string | number | boolean | null>
  systemControlled?: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  modifiedBy?: string
  createdByName?: string
  modifiedByName?: string
  auditHistory?: CrmMasterAuditEvent[]
}

export interface CrmMasterFieldDef {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'textarea' | 'boolean' | 'color' | 'multiselect' | 'richtext'
  required?: boolean
  options?: { value: string; label: string }[]
  placeholder?: string
  section?: 'basic' | 'description' | 'configuration' | 'reference' | 'notes'
}

export interface CrmMasterCatalogItem {
  kind: CrmMasterKind
  slug: string
  title: string
  description: string
  purpose?: string
  group: 'company' | 'pipeline' | 'communication' | 'quotation' | 'governance'
  usedIn?: CrmMasterUsedIn[]
  linkedRoute?: string
  linkedNewRoute?: string
  linkedDetailRoute?: (id: string) => string
  linkedEditRoute?: (id: string) => string
  importExport?: boolean
  /** When false, hides the internal Notes tab on the master form and detail view. Default: true */
  showNotes?: boolean
  /** When false, hides the Description tab on the master form and detail view. Default: true */
  showDescription?: boolean
  /** Override the default "Basic" section label in the form navigator. */
  basicSectionLabel?: string
  /** Override the default "Configuration" section label in the form navigator. */
  configurationSectionLabel?: string
  /** When set to richtext, the Description section uses the rich text editor. */
  descriptionFormat?: 'plain' | 'richtext'
  /**
   * Create/edit presentation. When omitted, inferred from field complexity
   * (`crmMasterPrefersDrawerForm`). Drawer = small registers; page = complex.
   */
  formPresentation?: 'drawer' | 'page'
  fields: CrmMasterFieldDef[]
}
