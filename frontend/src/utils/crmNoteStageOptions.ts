import { LEAD_STAGE_LABELS, type LeadStage } from '@/types/sales'
import { OPPORTUNITY_STAGES } from '@/types/crm'

export type CrmNoteStageOption = { code: string; label: string }

/** Lead notes are stage-stamped with the lead pipeline stage. */
export const LEAD_NOTE_STAGE_OPTIONS: CrmNoteStageOption[] = (
  Object.keys(LEAD_STAGE_LABELS) as LeadStage[]
).map((code) => ({ code, label: LEAD_STAGE_LABELS[code] }))

/** Static fallback when tenant pipeline stages are unavailable. */
export const OPPORTUNITY_NOTE_STAGE_OPTIONS: CrmNoteStageOption[] = OPPORTUNITY_STAGES.map((s) => ({
  code: s.id,
  label: s.label,
}))

/** Quotation notes are stage-stamped with the document workflow status. */
export const QUOTATION_NOTE_STAGE_OPTIONS: CrmNoteStageOption[] = [
  { code: 'draft', label: 'Draft' },
  { code: 'pending_approval', label: 'Pending Internal Approval' },
  { code: 'approved', label: 'Approved' },
  { code: 'sent', label: 'Sent to Customer' },
  { code: 'rejected', label: 'Rejected' },
  { code: 'superseded', label: 'Superseded' },
  { code: 'converted', label: 'Converted to Sales Order' },
]

export function quotationNoteStageLabel(code: string): string {
  return QUOTATION_NOTE_STAGE_OPTIONS.find((s) => s.code === code)?.label ?? code.replace(/_/g, ' ')
}
