import { Link } from 'react-router-dom'
import { CommercialAccountingExplanation } from './CommercialBadges'
import { SalesOrderPhaseBadge } from './CommercialBadges'
import { salesOrderStatusSupportText } from '@/types/commercialCommitments'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import type {
  SalesOrderCommercialMoneyDto,
  SalesOrderCommercialOpsDto,
} from '@/services/api/salesOrderApi'

export type SalesOrderAccountingDemoMetrics = {
  orderedAmount: number
  dispatchedAmount?: number
  invoicedAmount: number
  collectedAmount: number
  outstandingAmount: number
  nextPaymentDueDate?: string | null
  nextPaymentDueAmount?: number | null
  postedInvoiceCount: number
  draftInvoiceCount: number
}

function resolveInvoiceStatus(metrics: SalesOrderAccountingDemoMetrics): string {
  if (metrics.postedInvoiceCount > 0) return `${metrics.postedInvoiceCount} posted`
  if (metrics.draftInvoiceCount > 0) return `${metrics.draftInvoiceCount} draft`
  return 'Not created'
}

function resolveAccountingStatus(metrics: SalesOrderAccountingDemoMetrics): string {
  if (metrics.postedInvoiceCount === 0) return 'Not posted'
  if (metrics.outstandingAmount <= 0) return 'Settled'
  if (metrics.collectedAmount > 0) return 'Partially collected'
  return 'Posted — open receivable'
}

function resolveFinancialImpact(metrics: SalesOrderAccountingDemoMetrics): string {
  if (metrics.postedInvoiceCount === 0) return 'None (commercial only)'
  if (metrics.outstandingAmount <= 0) return 'Fully collected'
  return `${formatCurrency(metrics.outstandingAmount)} outstanding`
}

export function SalesOrderAccountingSummary({
  salesOrderNo,
  status,
  value,
  ops,
  money,
  moneyVisible,
  loading,
  error,
  onViewExpectedEntry,
}: {
  salesOrderNo: string
  status: string
  value: number
  ops?: SalesOrderCommercialOpsDto | null
  money?: SalesOrderCommercialMoneyDto | SalesOrderAccountingDemoMetrics | null
  moneyVisible?: boolean
  loading?: boolean
  error?: string | null
  onViewExpectedEntry?: () => void
}) {
  const metrics: SalesOrderAccountingDemoMetrics = money
    ? {
        orderedAmount: money.orderedAmount,
        dispatchedAmount: money.dispatchedAmount,
        invoicedAmount: money.invoicedAmount,
        collectedAmount: money.collectedAmount,
        outstandingAmount: money.outstandingAmount,
        nextPaymentDueDate: money.nextPaymentDueDate,
        postedInvoiceCount: money.postedInvoiceCount,
        draftInvoiceCount: money.draftInvoiceCount,
      }
    : {
        orderedAmount: ops?.orderedAmount ?? value,
        dispatchedAmount: ops?.dispatchedAmount,
        invoicedAmount: 0,
        collectedAmount: 0,
        outstandingAmount: 0,
        postedInvoiceCount: 0,
        draftInvoiceCount: 0,
      }

  return (
    <section className="rounded border border-erp-border bg-white p-4">
      <h3 className="text-[13px] font-semibold text-erp-text">Accounting Summary</h3>
      <p className="mt-1 text-[11px] text-erp-muted">{salesOrderNo} · commercial document</p>
      {loading ? <p className="mt-3 text-[12px] text-erp-muted">Loading commercial position…</p> : null}
      {error ? <p className="mt-3 text-[12px] text-red-700">{error}</p> : null}
      <dl className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2">
        <div>
          <dt className="text-erp-muted">Sales Order Value</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatCurrency(metrics.orderedAmount || value)}</dd>
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
        {ops ? (
          <>
            <div>
              <dt className="text-erp-muted">Dispatched qty</dt>
              <dd className="font-medium tabular-nums">
                {ops.dispatchedQty} / {ops.netOrderedQty}
              </dd>
            </div>
            <div>
              <dt className="text-erp-muted">Dispatched value</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(ops.dispatchedAmount)}</dd>
            </div>
          </>
        ) : null}
        <div>
          <dt className="text-erp-muted">Invoice Status</dt>
          <dd className="font-medium text-amber-900">{resolveInvoiceStatus(metrics)}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Accounting Status</dt>
          <dd className="font-medium">{resolveAccountingStatus(metrics)}</dd>
        </div>
        {moneyVisible && money ? (
          <>
            <div>
              <dt className="text-erp-muted">Invoiced</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(money.invoicedAmount)}</dd>
            </div>
            <div>
              <dt className="text-erp-muted">Collected</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(money.collectedAmount)}</dd>
            </div>
            <div>
              <dt className="text-erp-muted">Outstanding</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(money.outstandingAmount)}</dd>
            </div>
            <div>
              <dt className="text-erp-muted">Next payment due</dt>
              <dd className="font-medium">
                {money.nextPaymentDueDate
                  ? `${formatDate(money.nextPaymentDueDate)} · ${formatCurrency(money.nextPaymentDueAmount ?? 0)}`
                  : '—'}
              </dd>
            </div>
          </>
        ) : moneyVisible === false ? (
          <div className="sm:col-span-2">
            <dt className="text-erp-muted">Financial tiles</dt>
            <dd className="text-[11px] text-erp-muted">Requires finance AR view permission</dd>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="text-erp-muted">Financial Impact</dt>
          <dd className="font-medium">{resolveFinancialImpact(metrics)}</dd>
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
