import { useNavigate } from 'react-router-dom'
import { Eye, Lock } from 'lucide-react'
import type { QuotationDocument } from '../../types/crm'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { LiveStatusBadge } from '../premium/LiveStatusBadge'
import { quotationStatusLabel, quotationStatusTone } from './QuotationCrmCard'
import { quotationRevisionLabel } from './Quotation360Sections'
import { cn } from '../../utils/cn'

interface QuotationRevisionHistoryProps {
  documents: QuotationDocument[]
  quotationId: string
}

export function QuotationRevisionHistory({ documents, quotationId }: QuotationRevisionHistoryProps) {
  const navigate = useNavigate()
  const sorted = [...documents].sort((a, b) => b.revisionNo - a.revisionNo)
  const latestRev = sorted[0]?.revisionNo ?? 0

  return (
    <div className="space-y-3">
      {sorted.map((d) => {
        const isLatest = d.revisionNo === latestRev
        const qLabel = quotationRevisionLabel(d.revisionNo)
        const readOnly = !isLatest || d.locked || d.status === 'superseded' || d.status === 'converted'
        return (
          <div
            key={d.id}
            className={cn(
              'rounded-xl border bg-erp-surface p-4 transition-colors',
              isLatest ? 'border-erp-primary/30 ring-1 ring-erp-primary/10' : 'border-erp-border opacity-95',
              readOnly && !isLatest && 'bg-erp-surface-alt/40',
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-[14px] font-bold text-erp-text">{qLabel}</p>
                  {isLatest ? (
                    <span className="rounded bg-erp-primary-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-erp-primary">
                      Latest
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-erp-surface-alt px-1.5 py-0.5 text-[10px] font-bold uppercase text-erp-muted">
                      <Lock className="h-2.5 w-2.5" aria-hidden />
                      Locked
                    </span>
                  )}
                  <LiveStatusBadge label={quotationStatusLabel(d.status)} tone={quotationStatusTone(d.status)} pulse={false} />
                </div>
                <p className="mt-1 text-[12px] text-erp-muted">
                  {d.createdByName} · {new Date(d.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {!isLatest ? ' · Prior revision — view only' : null}
                </p>
              </div>
              <p className="text-[16px] font-bold tabular-nums text-erp-primary">{formatCrmCurrency(d.totalAmount)}</p>
            </div>

            {d.revisionReason ? (
              <p className="mt-2 rounded-lg bg-erp-surface-alt/60 px-3 py-2 text-[12px] italic text-erp-muted">{d.revisionReason}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="crm-inline-action crm-inline-action--primary"
                onClick={() => navigate(
                  readOnly
                    ? `/crm/quotations/${quotationId}/preview?doc=${d.id}`
                    : `/crm/quotations/${quotationId}/editor?doc=${d.id}`,
                )}
              >
                <Eye className="h-3 w-3" />
                {readOnly ? 'View' : 'Edit'}
              </button>
              <button
                type="button"
                className="crm-inline-action"
                onClick={() => navigate(`/crm/quotations/${quotationId}/preview?doc=${d.id}`)}
              >
                <Eye className="h-3 w-3" />
                Preview
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
