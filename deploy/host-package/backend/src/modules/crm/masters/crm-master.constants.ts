export const CRM_MASTER_KINDS = [
  'lead-sources',
  'industries',
  'territories',
  'designations',
  'departments',
  'lead-stages',
  'lead-priorities',
  'lead-reasons',
  'opportunity-stages',
  'opportunity-priorities',
  'activity-types',
  'lost-reasons',
  'commercial-terms',
  'payment-terms',
  'delivery-terms',
  'warranty-terms',
  'approval-rules',
  'document-types',
] as const

export type CrmMasterKind = (typeof CRM_MASTER_KINDS)[number]

export function isCrmMasterKind(value: string): value is CrmMasterKind {
  return (CRM_MASTER_KINDS as readonly string[]).includes(value)
}

/** Kinds managed globally outside CRM master API */
export const CRM_MASTER_GLOBAL_KINDS = ['owners', 'product-interests'] as const
