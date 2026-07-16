import { Link } from 'react-router-dom'
import { Building2, ExternalLink, IndianRupee, Target, Clock } from 'lucide-react'
import { entity360CustomerPath } from '../../config/entity360Routes'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { leadPriorityLabel, leadPriorityLiveTone } from '../../utils/leadUtils'
import { LeadStageChip } from './LeadStageChip'
import { LiveStatusBadge } from '../premium/LiveStatusBadge'
import type { LeadPriority, LeadStage } from '../../types/sales'
import type { Opportunity } from '../../types/crm'
import type { CrmActivity } from '../../types/crm'

interface CrmLeadFormFactBoxProps {
  prospectName: string
  contactPerson: string
  mobile: string
  customerId: string | null
  priority: LeadPriority
  leadStage: LeadStage
  leadOwnerName?: string
  linkedOpps: Opportunity[]
  lastActivity?: CrmActivity
  outstandingAr: number
}

export function CrmLeadFormFactBox({
  prospectName,
  contactPerson,
  mobile,
  customerId,
  priority,
  leadStage,
  leadOwnerName,
  linkedOpps,
  lastActivity,
  outstandingAr,
}: CrmLeadFormFactBoxProps) {
  return (
    <aside className="crm-lead-factbox" aria-label="Lead context">
      <div className="crm-lead-factbox__card">
        <p className="crm-lead-factbox__heading">Record snapshot</p>
        <div className="crm-lead-factbox__chips">
          <LeadStageChip stage={leadStage} />
          <LiveStatusBadge label={leadPriorityLabel(priority)} tone={leadPriorityLiveTone(priority)} pulse={false} size="sm" />
        </div>
        {leadOwnerName ? (
          <p className="crm-lead-factbox__meta">
            <span className="crm-lead-factbox__meta-label">Owner</span>
            <span>{leadOwnerName}</span>
          </p>
        ) : null}
      </div>

      <div className="crm-lead-factbox__card">
        <p className="crm-lead-factbox__heading">
          <Building2 className="h-3.5 w-3.5" aria-hidden />
          Company
        </p>
        {prospectName ? (
          <div className="crm-lead-factbox__content">
            <p className="crm-lead-factbox__value">{prospectName}</p>
            <p className="crm-lead-factbox__line">{contactPerson || 'No contact person'}</p>
            <p className="crm-lead-factbox__line">{mobile || '—'}</p>
            {customerId ? (
              <Link to={entity360CustomerPath(customerId)} className="crm-lead-factbox__link">
                Open Company Master <ExternalLink className="h-3 w-3" />
              </Link>
            ) : (
              <p className="crm-lead-factbox__hint">New prospect — not yet in Company Master</p>
            )}
          </div>
        ) : (
          <p className="crm-lead-factbox__hint">Search or add a company to populate context.</p>
        )}
      </div>

      {linkedOpps.length > 0 ? (
        <div className="crm-lead-factbox__card">
          <p className="crm-lead-factbox__heading">
            <Target className="h-3.5 w-3.5" aria-hidden />
            Opportunities
          </p>
          <ul className="crm-lead-factbox__list">
            {linkedOpps.map((o) => (
              <li key={o.id}>
                <Link to={`/crm/opportunities/${o.id}`} className="crm-lead-factbox__link">
                  {o.opportunityName}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {lastActivity ? (
        <div className="crm-lead-factbox__card">
          <p className="crm-lead-factbox__heading">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            Last activity
          </p>
          <p className="crm-lead-factbox__value">{lastActivity.subject}</p>
          <p className="crm-lead-factbox__line">{formatDate(lastActivity.activityDate)}</p>
        </div>
      ) : null}

      {outstandingAr > 0 ? (
        <div className="crm-lead-factbox__card crm-lead-factbox__card--warn">
          <p className="crm-lead-factbox__heading">
            <IndianRupee className="h-3.5 w-3.5" aria-hidden />
            Outstanding AR
          </p>
          <p className="crm-lead-factbox__value crm-lead-factbox__value--warn">{formatCurrency(outstandingAr)}</p>
        </div>
      ) : null}
    </aside>
  )
}
