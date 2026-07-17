import { Link } from 'react-router-dom'
import type { CommercialCommitment } from '@/types/commercialCommitments'
import { formatCurrency } from '@/utils/formatters/currency'
import { crmSalesOrderPath } from '@/utils/crmSalesOrderNavigation'
import { CrmDocumentLink } from './CommercialBadges'
import { AccountingStatusBadge, SalesOrderPhaseBadge } from './CommercialBadges'

export function CommercialCommitmentSmartContext({
  row,
  onExpectedEntry,
}: {
  row: CommercialCommitment | null
  onExpectedEntry?: () => void
}) {
  if (!row) {
    return (
      <aside className="rounded border border-erp-border bg-erp-surface/40 p-3 text-[12px] text-erp-muted">
        Select a commitment row to see commercial summary and accounting readiness.
      </aside>
    )
  }

  const confirmed = row.salesOrderStatus === 'confirmed'
  const open = row.salesOrderStatus === 'open'

  return (
    <aside className="space-y-3 rounded border border-erp-border bg-white p-3 text-[12px]">
      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-erp-muted">Commercial Summary</h3>
        <dl className="mt-2 space-y-1.5">
          <div className="flex justify-between gap-2">
            <dt className="text-erp-muted">Customer</dt>
            <dd className="text-right font-medium">{row.customerName}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-erp-muted">Opportunity</dt>
            <dd className="text-right">
              {row.opportunityId ? (
                <CrmDocumentLink
                  to={`/crm/opportunities/${row.opportunityId}`}
                  label={row.opportunityName ?? row.opportunityId}
                  permission="crm.opportunity.view"
                />
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-erp-muted">Approved quotation</dt>
            <dd className="text-right">
              {row.quotationId ? (
                <CrmDocumentLink
                  to={`/crm/quotations/${row.quotationId}`}
                  label={`${row.quotationNo ?? ''} Rev ${row.quotationRevision ?? '—'}`}
                  permission="crm.quotation.view"
                />
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-erp-muted">Sales Order</dt>
            <dd className="text-right">
              {row.salesOrderId ? (
                <CrmDocumentLink
                  to={crmSalesOrderPath(row.salesOrderId)}
                  label={row.salesOrderNo ?? row.salesOrderId}
                  permission="crm.sales_order.view"
                />
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-erp-muted">Commercial Value</dt>
            <dd className="font-semibold tabular-nums">{formatCurrency(row.commercialValue)}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-erp-muted">Accounting Readiness</h3>
        <ul className="mt-2 space-y-1 text-erp-text">
          <li className="flex items-center justify-between gap-2">
            <span>Sales Order confirmed</span>
            <span>{confirmed ? 'Yes' : 'No'}</span>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span>Invoice not created</span>
            <span>Yes</span>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span>Accounting not posted</span>
            <AccountingStatusBadge status={row.accountingStatus} />
          </li>
          {row.salesOrderStatus ? (
            <li className="flex items-center justify-between gap-2">
              <span>SO status</span>
              <SalesOrderPhaseBadge status={row.salesOrderStatus} />
            </li>
          ) : null}
        </ul>
      </section>

      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-erp-muted">Next Best Action</h3>
        {open ? (
          <p className="mt-2 text-erp-text">Confirm the Sales Order in CRM (commercial only — no posting).</p>
        ) : confirmed ? (
          <p className="mt-2 text-erp-text">
            Create Sales Invoice — <span className="font-medium text-amber-900">not available in Phase 1.</span>
          </p>
        ) : (
          <p className="mt-2 text-erp-muted">No accounting action available for this commercial document.</p>
        )}
        <button
          type="button"
          disabled
          title="Sales Invoice posting will be added in a future phase."
          className="mt-2 w-full rounded border border-erp-border bg-erp-surface px-2 py-1.5 text-[11px] font-semibold text-erp-muted opacity-60"
        >
          Create Sales Invoice
        </button>
        {onExpectedEntry ? (
          <button
            type="button"
            onClick={onExpectedEntry}
            className="mt-1.5 w-full rounded border border-erp-border px-2 py-1.5 text-[11px] font-semibold hover:bg-erp-surface"
          >
            View Expected Entry
          </button>
        ) : null}
        <Link
          to="/crm"
          className="mt-2 block text-center text-[11px] font-semibold text-erp-primary hover:underline"
        >
          Open CRM Dashboard
        </Link>
      </section>
    </aside>
  )
}
