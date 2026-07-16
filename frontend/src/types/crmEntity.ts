/** Backend CRM entity types for notes and attachments. */
export type CrmEntityTypeApi =
  | 'COMPANY'
  | 'CONTACT'
  | 'LEAD'
  | 'OPPORTUNITY'
  | 'ACTIVITY'
  | 'FOLLOW_UP'
  | 'QUOTATION'

export const CRM_ENTITY_TYPES: CrmEntityTypeApi[] = [
  'COMPANY',
  'CONTACT',
  'LEAD',
  'OPPORTUNITY',
  'ACTIVITY',
  'FOLLOW_UP',
  'QUOTATION',
]

/** Read-only note shown in demo mode when API notes are unavailable. */
export interface DemoEntityNote {
  content: string
  authorName?: string
  createdAt?: string
  label?: string
}
