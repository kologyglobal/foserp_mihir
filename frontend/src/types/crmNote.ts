/** Stable CRM note-type codes shared with the API. */
export const CRM_NOTE_TYPES = [
  'general',
  'qualification',
  'requirement',
  'technical_review',
  'commercial',
  'negotiation',
  'closure',
  'disqualification',
] as const

export type CrmNoteType = (typeof CRM_NOTE_TYPES)[number]

export const CRM_NOTE_TYPE_LABELS: Record<CrmNoteType, string> = {
  general: 'General Note',
  qualification: 'Qualification Note',
  requirement: 'Requirement Note',
  technical_review: 'Technical Review Note',
  commercial: 'Commercial Note',
  negotiation: 'Negotiation Note',
  closure: 'Closure Note',
  disqualification: 'Disqualification Note',
}

export function crmNoteTypeLabel(code: string | null | undefined): string {
  if (!code) return ''
  return CRM_NOTE_TYPE_LABELS[code as CrmNoteType] ?? code
}
