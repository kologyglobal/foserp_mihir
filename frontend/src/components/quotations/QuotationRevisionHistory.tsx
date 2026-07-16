import { useNavigate } from 'react-router-dom'
import { Pencil, Eye } from 'lucide-react'
import type { QuotationDocument } from '../../types/crm'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { LiveStatusBadge } from '../premium/LiveStatusBadge'
import { quotationStatusLabel, quotationStatusTone } from './QuotationCrmCard'
import { cn } from '../../utils/cn'

interface QuotationRevisionHistoryProps {
  documents: QuotationDocument[]
  quotationId: string
}

export function QuotationRevisionHistory({ documents, quotationId }: QuotationRevisionHistoryProps) {
  const navigate = useNavigate()
  const latestRev = documents[0]?.revisionNo ?? 0

  return (
    <div className="space-y-3">
      {documents.map((d) => {
        const isLatest = d.revisionNo === latestRev
        return (
          <div
            key={d.id}
            className={cn(
              'rounded-xl border bg-erp-surface p-4 transition-colors',
              isLatest ? 'border-erp-primary/30 ring-1 ring-erp-primary/10' : 'border-erp-border',
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-[14px] font-bold text-erp-text">Revision {d.revisionNo}</p>
                  {isLatest ? (
                    <span className="rounded bg-erp-primary-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-erp-primary">Latest</span>
                  ) : null}
                  <LiveStatusBadge label={quotationStatusLabel(d.status)} tone={quotationStatusTone(d.status)} pulse={false} />
                </div>
                <p className="mt-1 text-[12px] text-erp-muted">
                  {d.createdByName} · {new Date(d.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
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
                onClick={() => navigate(`/crm/quotations/${quotationId}/editor?doc=${d.id}`)}
              >
                {d.locked ? <Eye className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                {d.locked ? 'View' : 'Edit'}
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
