export type QuickCreateEntityType =
  | 'customer'
  | 'contact'
  | 'vendor'
  | 'item'
  | 'product'
  | 'paymentTerms'
  | 'taxCategory'
  | 'deliveryTerms'
  | 'transporter'
  | 'inspectionPlan'

export interface QuickCreateResult {
  entityType: QuickCreateEntityType
  id: string
  label: string
  record?: unknown
}

export interface QuickCreateContext {
  entityType: QuickCreateEntityType
  title: string
  defaultValues?: Record<string, unknown>
  /** Parent field key for auto-select (informational) */
  fieldKey?: string
}

export const QUICK_CREATE_TITLES: Record<QuickCreateEntityType, string> = {
  customer: 'Add New Company',
  contact: 'Add New Contact',
  vendor: 'Add New Vendor',
  item: 'Add New Item',
  product: 'Add New Product',
  paymentTerms: 'Add New Payment Terms',
  taxCategory: 'Add New Tax Category',
  deliveryTerms: 'Add New Delivery Terms',
  transporter: 'Add New Transporter',
  inspectionPlan: 'Add New Inspection Plan',
}

export const QUICK_CREATE_EMPTY_LABELS: Record<QuickCreateEntityType, string> = {
  customer: 'No company found',
  contact: 'No contact found',
  vendor: 'No vendor found',
  item: 'No item found',
  product: 'No product found',
  paymentTerms: 'No payment terms found',
  taxCategory: 'No tax category found',
  deliveryTerms: 'No delivery terms found',
  transporter: 'No transporter found',
  inspectionPlan: 'No inspection plan found',
}

export const QUICK_CREATE_ADD_LABELS: Record<QuickCreateEntityType, string> = {
  customer: 'Add Company',
  contact: 'Add Contact',
  vendor: 'Add Vendor',
  item: 'Add Item',
  product: 'Add Product',
  paymentTerms: 'Add Payment Terms',
  taxCategory: 'Add Tax Category',
  deliveryTerms: 'Add Delivery Terms',
  transporter: 'Add Transporter',
  inspectionPlan: 'Create Inspection Plan',
}
