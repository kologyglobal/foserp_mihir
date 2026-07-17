import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CommercialCommitment, CommercialSourceType } from '@/types/commercialCommitments'
import {
  isQuotationFullyAccepted,
  isQuotationValidityExpired,
} from '@/types/commercialCommitments'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { crmSalesOrderPath } from '@/utils/crmSalesOrderNavigation'
import {
  AccountingStatusBadge,
  CrmDocumentLink,
  QuotationApprovalSummary,
  QuotationRevisionBadge,
  SalesOrderPhaseBadge,
} from './CommercialBadges'
import { cn } from '@/utils/cn'

export function CommercialCommitmentKpiCards({
  items,
}: {
  items: { id: string; label: string; value: string; helper?: string; href?: string }[]
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((k) => {
        const inner = (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">{k.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-erp-text">{k.value}</p>
            <p className="mt-0.5 text-[10px] font-medium text-amber-900">Non-posted commercial value</p>
            {k.helper ? <p className="mt-1 text-[11px] text-erp-muted">{k.helper}</p> : null}
          </>
        )
        return k.href ? (
          <Link
            key={k.id}
            to={k.href}
            className="rounded border border-amber-200 bg-amber-50/40 p-3 transition-colors hover:border-amber-300"
          >
            {inner}
          </Link>
        ) : (
          <div key={k.id} className="rounded border border-amber-200 bg-amber-50/40 p-3">
            {inner}
          </div>
        )
      })}
    </div>
  )
}

export function CommercialCommitmentTable({
  rows,
  selectedId,
  onSelect,
  onExpectedEntry,
}: {
  rows: CommercialCommitment[]
  selectedId: string | null
  onSelect: (id: string) => void
  onExpectedEntry: (row: CommercialCommitment) => void
}) {
  return (
    <div className="overflow-x-auto rounded border border-erp-border">
      <table className="min-w-full text-left text-[12px]">
        <thead className="bg-erp-surface text-[10px] uppercase tracking-wide text-erp-muted">
          <tr>
            <th className="px-2 py-2">Source Document</th>
            <th className="px-2 py-2">Customer</th>
            <th className="px-2 py-2">Opportunity</th>
            <th className="px-2 py-2">Quotation</th>
            <th className="px-2 py-2">Revision</th>
            <th className="px-2 py-2">Sales Order</th>
            <th className="px-2 py-2">Document Date</th>
            <th className="px-2 py-2">Expected</th>
            <th className="px-2 py-2 text-right">Commercial Value</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-2 py-2">Accounting</th>
            <th className="px-2 py-2">Owner</th>
            <th className="px-2 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const expired = isQuotationValidityExpired(r.quotationValidityDate)
            return (
              <tr
                key={r.id}
                className={cn(
                  'cursor-pointer border-t border-erp-border hover:bg-erp-surface/50',
                  selectedId === r.id && 'bg-erp-primary/5',
                )}
                onClick={() => onSelect(r.id)}
              >
                <td className="px-2 py-2 font-medium capitalize">{r.sourceType.replace(/_/g, ' ')}</td>
                <td className="px-2 py-2">
                  <CrmDocumentLink to="/crm/customers" label={r.customerName} permission="crm.company.view" />
                </td>
                <td className="px-2 py-2">
                  {r.opportunityId ? (
                    <CrmDocumentLink
                      to={`/crm/opportunities/${r.opportunityId}`}
                      label={r.opportunityName ?? r.opportunityId}
                      permission="crm.opportunity.view"
                    />
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-2 py-2">
                  {r.quotationId ? (
                    <div className="space-y-1">
                      <CrmDocumentLink
                        to={`/crm/quotations/${r.quotationId}`}
                        label={r.quotationNo ?? r.quotationId}
                        permission="crm.quotation.view"
                      />
                      <QuotationApprovalSummary
                        headerStatus={r.quotationHeaderStatus}
                        documentStatus={r.quotationDocumentStatus}
                        customerApproval={r.customerApprovalStatus}
                        validityExpired={expired}
                      />
                      {isQuotationFullyAccepted(r) ? null : null}
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-2 py-2">
                  <QuotationRevisionBadge
                    revision={r.quotationRevision}
                    isLatest={r.isLatestRevision}
                    superseded={r.quotationHeaderStatus === 'superseded'}
                  />
                </td>
                <td className="px-2 py-2">
                  {r.salesOrderId ? (
                    <div className="space-y-0.5">
                      <CrmDocumentLink
                        to={crmSalesOrderPath(r.salesOrderId)}
                        label={r.salesOrderNo ?? r.salesOrderId}
                        permission="crm.sales_order.view"
                      />
                      <SalesOrderPhaseBadge status={r.salesOrderStatus} />
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">{formatDate(r.documentDate)}</td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {r.expectedCloseOrDelivery ? formatDate(r.expectedCloseOrDelivery) : '—'}
                </td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums">
                  {formatCurrency(r.commercialValue)}
                </td>
                <td className="px-2 py-2">
                  {r.salesOrderStatus ? (
                    <SalesOrderPhaseBadge status={r.salesOrderStatus} />
                  ) : (
                    r.quotationHeaderStatus ?? '—'
                  )}
                </td>
                <td className="px-2 py-2">
                  <AccountingStatusBadge status={r.accountingStatus} />
                </td>
                <td className="px-2 py-2">{r.ownerName}</td>
                <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col gap-0.5">
                    {r.opportunityId ? (
                      <Link className="text-[10px] font-semibold text-erp-primary hover:underline" to={`/crm/opportunities/${r.opportunityId}`}>
                        View Opportunity
                      </Link>
                    ) : null}
                    {r.quotationId ? (
                      <Link className="text-[10px] font-semibold text-erp-primary hover:underline" to={`/crm/quotations/${r.quotationId}`}>
                        View Quotation
                      </Link>
                    ) : null}
                    {r.salesOrderId ? (
                      <Link className="text-[10px] font-semibold text-erp-primary hover:underline" to={crmSalesOrderPath(r.salesOrderId)}>
                        View Sales Order
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="text-left text-[10px] font-semibold text-erp-muted hover:text-erp-primary"
                      onClick={() => onExpectedEntry(r)}
                    >
                      View Expected Entry
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="p-4 text-center text-[12px] text-erp-muted">No commercial commitments in this tab.</p>
      ) : null}
    </div>
  )
}

export type CommitmentTab = CommercialSourceType | 'all'

export function filterCommitmentsByTab(rows: CommercialCommitment[], tab: CommitmentTab): CommercialCommitment[] {
  if (tab === 'all') return rows
  if (tab === 'pending_invoice') {
    return rows.filter(
      (r) =>
        r.sourceType === 'pending_invoice' ||
        r.accountingStatus === 'invoice_pending' ||
        r.salesOrderStatus === 'confirmed',
    )
  }
  return rows.filter((r) => r.sourceType === tab)
}

export function useCommitmentTabs(rows: CommercialCommitment[]) {
  const [tab, setTab] = useState<CommitmentTab>('confirmed_sales_order')
  const filtered = useMemo(() => filterCommitmentsByTab(rows, tab), [rows, tab])
  return { tab, setTab, filtered }
}
