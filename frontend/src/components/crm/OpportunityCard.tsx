import { useNavigate } from 'react-router-dom'
import { Calendar, User, AlertCircle, ExternalLink, ArrowRight, CalendarClock } from 'lucide-react'
import type { Opportunity } from '../../types/crm'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { useMasterStore } from '../../store/masterStore'
import { getOpportunityItemSummary } from '../../utils/opportunityLineCalc'
import {
  isEncodedLeadRequirementPayload,
  opportunityRequirementDisplay,
} from '../../utils/leadRequirementLines'
import { opportunityPriorityLabel } from '../../utils/opportunityUtils'
import { cn } from '../../utils/cn'

function safeItemSummary(rawSummary: string, requirementLabel: string): string {
  if (isEncodedLeadRequirementPayload(rawSummary)) return requirementLabel || '—'
  return rawSummary
}

interface OpportunityCardProps {
  opportunity: Opportunity
  draggable?: boolean
  onDragStart?: (e: React.DragEvent, id: string) => void
  onDragEnd?: (e: React.DragEvent) => void
  onQuickFollowUp?: (opp: Opportunity) => void
  onMoveStage?: (opp: Opportunity) => void
  variant?: 'kanban' | 'default'
}

const PRIORITY_ACCENT: Record<string, string> = {
  critical: 'crm-opp-card--critical',
  high: 'crm-opp-card--high',
  medium: 'crm-opp-card--medium',
  low: 'crm-opp-card--low',
}

function isFollowUpOverdue(date: string | null) {
  if (!date) return false
  return date.slice(0, 10) < new Date().toISOString().slice(0, 10)
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function OpportunityCard({
  opportunity: opp,
  draggable,
  onDragStart,
  onDragEnd,
  onQuickFollowUp,
  onMoveStage,
  variant = 'kanban',
}: OpportunityCardProps) {
  const navigate = useNavigate()
  const customers = useMasterStore((s) => s.customers)
  const products = useMasterStore((s) => s.products)
  const customer = customers.find((c) => c.id === opp.customerId)
  const product = opp.productId ? products.find((p) => p.id === opp.productId) : undefined
  const requirementLabel = opportunityRequirementDisplay(opp.productRequirement)
  const itemSummary = safeItemSummary(getOpportunityItemSummary(opp, product), requirementLabel)
  const itemCount = opp.lines?.length || (opp.productId || opp.value ? 1 : 0)
  const overdueFu = isFollowUpOverdue(opp.nextFollowUpDate)
  const priorityLabel = opportunityPriorityLabel(opp.priority)
  const companyName = customer?.customerName ?? 'Unknown company'
  const openDetail = () => navigate(`/crm/opportunities/${opp.id}`)

  const secondaryTooltip = [
    opp.opportunityNo,
    `${opp.probability}% probability`,
    `${itemSummary} · ${itemCount} item${itemCount === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <article
      draggable={draggable}
      title={secondaryTooltip}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', opp.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart?.(e, opp.id)
      }}
      onDragEnd={(e) => onDragEnd?.(e)}
      className={cn(
        'crm-opp-card',
        PRIORITY_ACCENT[opp.priority] ?? 'crm-opp-card--low',
        draggable && 'crm-opp-card--draggable',
      )}
    >
      <div className="crm-opp-card__top">
        <button type="button" className="crm-opp-card__title" onClick={openDetail}>
          {opp.opportunityName}
        </button>
        <span className={cn('crm-opp-card__priority', `crm-opp-card__priority--${opp.priority}`)}>
          {priorityLabel}
        </span>
      </div>

      <p className="crm-opp-card__customer">{companyName}</p>

      <div className="crm-opp-card__commercial">
        <div>
          <p className="crm-opp-card__kpi-label">Value</p>
          <p className="crm-opp-card__kpi-value">{formatCrmCurrency(opp.value)}</p>
        </div>
        <div className="text-right">
          <p className="crm-opp-card__kpi-label">Expected close</p>
          <p className="crm-opp-card__kpi-date">{formatShortDate(opp.expectedCloseDate)}</p>
        </div>
      </div>

      <div className="crm-opp-card__meta">
        <span className="crm-opp-card__meta-item">
          <User className="h-3.5 w-3.5" />
          {opp.ownerName}
        </span>
        {opp.nextFollowUpDate ? (
          <span className={cn('crm-opp-card__meta-item', overdueFu && 'crm-opp-card__meta-item--overdue')}>
            {overdueFu ? <AlertCircle className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
            F/U {formatShortDate(opp.nextFollowUpDate)}
          </span>
        ) : (
          <span className="crm-opp-card__meta-item crm-opp-card__meta-item--muted">
            <Calendar className="h-3.5 w-3.5" />
            No follow-up
          </span>
        )}
      </div>

      {variant === 'default' && requirementLabel ? (
        <p className="crm-opp-card__requirement">{requirementLabel}</p>
      ) : null}

      <div className="crm-opp-card__footer" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="crm-opp-card__action crm-opp-card__action--primary" onClick={openDetail}>
          <ExternalLink className="h-3.5 w-3.5" />
          Open
        </button>
        <button type="button" className="crm-opp-card__action" onClick={() => onQuickFollowUp?.(opp)}>
          <CalendarClock className="h-3.5 w-3.5" />
          Follow-up
        </button>
        <button type="button" className="crm-opp-card__action" onClick={() => onMoveStage?.(opp)}>
          <ArrowRight className="h-3.5 w-3.5" />
          Move
        </button>
      </div>
    </article>
  )
}
