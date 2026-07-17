import { Link } from 'react-router-dom'
import { CommercialAccountingExplanation } from './CommercialBadges'
import { SalesOrderPhaseBadge } from './CommercialBadges'
import { salesOrderStatusSupportText } from '@/types/commercialCommitments'
import { formatCurrency } from '@/utils/formatters/currency'

export function SalesOrderAccountingSummary({
  salesOrderNo,
  status,
  value,
  onViewExpectedEntry,
}: {
  salesOrderNo: string
  status: string
  value: number
  onViewExpectedEntry?: () => void
}) {
  return (
    <section className="rounded border border-erp-border bg-white p-4">
      <h3 className="text-[13px] font-semibold text-erp-text">Accounting Summary</h3>
      <p className="mt-1 text-[11px] text-erp-muted">{salesOrderNo} · commercial document</p>
      <dl className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2">
        <div>
          <dt className="text-erp-muted">Sales Order Value</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatCurrency(value)}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Sales Order Status</dt>
          <dd className="mt-0.5 flex flex-col gap-0.5">
            <SalesOrderPhaseBadge status={status} />
            {salesOrderStatusSupportText(status) ? (
              <span className="text-[11px] text-erp-muted">{salesOrderStatusSupportText(status)}</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-erp-muted">Invoice Status</dt>
          <dd className="font-medium text-amber-900">Not created</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Accounting Status</dt>
          <dd className="font-medium">Not posted</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-erp-muted">Financial Impact</dt>
          <dd className="font-medium">None</dd>
        </div>
      </dl>
      <div className="mt-3">
        <CommercialAccountingExplanation dense />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {onViewExpectedEntry ? (
          <button
            type="button"
            onClick={onViewExpectedEntry}
            className="rounded border border-erp-border px-2.5 py-1 text-[11px] font-semibold hover:bg-erp-surface"
          >
            View Expected Entry
          </button>
        ) : null}
        <Link
          to="/accounting/commercial-commitments"
          className="rounded border border-erp-border px-2.5 py-1 text-[11px] font-semibold text-erp-primary hover:bg-erp-surface"
        >
          Open Accounting Commitments
        </Link>
      </div>
    </section>
  )
}
