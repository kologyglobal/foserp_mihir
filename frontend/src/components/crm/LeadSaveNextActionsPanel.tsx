import { useNavigate } from 'react-router-dom'
import { Activity, Calendar, Eye, FileText, Handshake, Plus } from 'lucide-react'
import type { LeadRoutes } from '../../hooks/useLeadRoutes'
import type { Lead } from '../../types/sales'
import { ErpButton, ErpButtonGroup } from '../erp/ErpButton'
import { cn } from '../../utils/cn'
import { canConvertLeadToOpportunity } from '../../utils/leadUtils'

interface LeadSaveNextActionsPanelProps {
  leadId: string
  leadNo?: string
  routes: LeadRoutes
  isEdit: boolean
  stage: string
  customerId?: string | null
  /** When set, show Create Quotation via opportunity (funnel-correct path). */
  opportunityId?: string | null
  onAddFollowUp?: () => void
  onDismiss: () => void
  className?: string
}

/** Post-save guidance — user is never stranded after save */
export function LeadSaveNextActionsPanel({
  leadId,
  leadNo,
  routes,
  isEdit,
  stage,
  customerId,
  opportunityId,
  onAddFollowUp,
  onDismiss,
  className,
}: LeadSaveNextActionsPanelProps) {
  const navigate = useNavigate()
  const canConvert = canConvertLeadToOpportunity({
    stage: stage as Lead['stage'],
    customerId: customerId ?? null,
    opportunityId: opportunityId ?? null,
    lifecycleStatus: opportunityId ? 'converted' : stage === 'qualified' ? 'qualified' : 'open',
  })

  return (
    <div className={cn('crm-lead-next-actions rounded-xl border border-emerald-200 bg-emerald-50/80 p-4', className)}>
      <p className="text-[14px] font-semibold text-emerald-900">
        Lead saved{leadNo ? ` — ${leadNo}` : ''}
      </p>
      <p className="mt-1 text-[13px] text-emerald-800">
        {isEdit ? 'Choose your next step.' : 'Lead is in the register. What would you like to do next?'}
      </p>
      <ErpButtonGroup className="mt-3">
        <ErpButton type="button" variant="primary" icon={Eye} onClick={() => navigate(routes.view(leadId))}>
          View Lead
        </ErpButton>
        {opportunityId ? (
          <ErpButton
            type="button"
            variant="secondary"
            icon={FileText}
            onClick={() => navigate(`/crm/quotations/new?opportunityId=${opportunityId}`)}
          >
            Create Quotation
          </ErpButton>
        ) : null}
        {canConvert ? (
          <ErpButton
            type="button"
            variant="secondary"
            icon={Handshake}
            onClick={() => navigate(`/crm/opportunities/new?customerId=${customerId}&leadId=${leadId}`)}
          >
            {isEdit ? 'Convert to Opportunity' : 'Create Opportunity'}
          </ErpButton>
        ) : null}
        {onAddFollowUp ? (
          <ErpButton type="button" variant="secondary" icon={Calendar} onClick={onAddFollowUp}>
            Add Follow-up
          </ErpButton>
        ) : (
          <ErpButton
            type="button"
            variant="secondary"
            icon={Activity}
            onClick={() => navigate(routes.view(leadId))}
          >
            Add Follow-up
          </ErpButton>
        )}
        {!isEdit ? (
          <ErpButton type="button" variant="secondary" icon={Plus} onClick={() => navigate(routes.new)}>
            Add Another Lead
          </ErpButton>
        ) : (
          <ErpButton type="button" variant="ghost" onClick={() => navigate(routes.base)}>
            Back to Leads List
          </ErpButton>
        )}
        <ErpButton type="button" variant="ghost" onClick={onDismiss}>
          Dismiss
        </ErpButton>
      </ErpButtonGroup>
    </div>
  )
}
