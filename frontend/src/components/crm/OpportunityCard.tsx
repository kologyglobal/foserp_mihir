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
import { cn } from '../../utils/cn'

function safeItemSummary(rawSummary: string, requirementLabel: string): string {
  if (isEncodedLeadRequirementPayload(rawSummary)) return requirementLabel || '—'
  return rawSummary
}

interface OpportunityCardProps {
  opportunity: Opportunity
  draggable?: boolean
  onDragStart?: (e: React.DragEvent, id: string) => void
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

export function OpportunityCard({
  opportunity: opp,
  draggable,
  onDragStart,
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
  const openDetail = () => navigate(`/crm/opportunities/${opp.id}`)

  return (
    <article
      draggable={draggable}
      onDragStart={(e) => {
        onDragStart?.(e, opp.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
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
        <span className="crm-opp-card__prob">
          {opp.probability}%
        </span>
      </div>

      <p className="crm-opp-card__customer">{customer?.customerName ?? 'Unknown company'}</p>
      <p className="crm-opp-card__opp-no">{opp.opportunityNo}</p>
      <p className="crm-opp-card__items text-[12px] text-erp-muted truncate">
        {itemSummary} · {itemCount} item{itemCount === 1 ? '' : 's'}
      </p>

      <div className="crm-opp-card__prob-bar" aria-hidden>
        <div className="crm-opp-card__prob-fill" style={{ width: `${Math.min(100, Math.max(0, opp.probability))}%` }} />
      </div>

      <div className="crm-opp-card__commercial">
        <div>
          <p className="crm-opp-card__kpi-label">Deal value</p>
          <p className="crm-opp-card__kpi-value">{formatCrmCurrency(opp.value)}</p>
        </div>
        <div className="text-right">
          <p className="crm-opp-card__kpi-label">Expected close</p>
          <p className="crm-opp-card__kpi-date">
            {new Date(opp.expectedCloseDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </p>
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
            F/U {new Date(opp.nextFollowUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </span>
        ) : null}
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
