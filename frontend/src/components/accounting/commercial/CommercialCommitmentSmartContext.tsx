import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ExternalLink, FileSpreadsheet } from 'lucide-react'
import type { CommercialCommitment } from '@/types/commercialCommitments'
import { formatCurrency } from '@/utils/formatters/currency'
import { crmSalesOrderPath } from '@/utils/crmSalesOrderNavigation'
import { CrmDocumentLink } from './CommercialBadges'
import { AccountingStatusBadge, SalesOrderPhaseBadge } from './CommercialBadges'
import {
  PurchaseAiInsightsRestoreButton,
  PurchaseAiInsightsShell,
  PurchaseAiOverviewBlock,
  PurchaseAiSuggestionsBlock,
  usePurchaseAiInsightsOpen,
} from '@/components/purchase/PurchaseAiInsightsPanel'

const STORAGE_KEY = 'accounting.commercial-commitments.insights.collapsed'

export function CommercialCommitmentSmartContext({
  row,
  onExpectedEntry,
}: {
  row: CommercialCommitment | null
  onExpectedEntry?: () => void
}) {
  const navigate = useNavigate()
  const [open, setOpen] = usePurchaseAiInsightsOpen(STORAGE_KEY)

  if (!open) {
    return (
      <div className="flex justify-end">
        <PurchaseAiInsightsRestoreButton label="Commercial Insights" onClick={() => setOpen(true)} />
      </div>
    )
  }

  if (!row) {
    return (
      <PurchaseAiInsightsShell
        title="Commercial Insights"
        subtitle="Select a commitment row to see summary and accounting readiness."
        onClose={() => setOpen(false)}
      >
        <p className="purchase-ai-panel__prose text-erp-muted">No row selected.</p>
      </PurchaseAiInsightsShell>
    )
  }

  const confirmed = row.salesOrderStatus === 'confirmed'
  const openSo = row.salesOrderStatus === 'open'

  return (
    <PurchaseAiInsightsShell
      title="Commercial Insights"
      subtitle="AI suggested commercial summary and accounting readiness for this commitment."
      onClose={() => setOpen(false)}
    >
      <PurchaseAiOverviewBlock
        rows={[
          { label: 'Customer', value: row.customerName },
          {
            label: 'Commercial value',
            value: formatCurrency(row.commercialValue),
            highlight: true,
          },
          {
            label: 'SO status',
            value: <SalesOrderPhaseBadge status={row.salesOrderStatus} />,
          },
          {
            label: 'Accounting',
            value: <AccountingStatusBadge status={row.accountingStatus} />,
            highlight: row.accountingStatus !== 'not_posted',
          },
        ]}
      />

      <section className="purchase-ai-panel__section" aria-label="Linked documents">
        <p className="purchase-ai-panel__section-title">Linked documents</p>
        <dl className="purchase-ai-panel__metrics">
          <div className="purchase-ai-panel__metric">
            <dt>Opportunity</dt>
            <dd>
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
          <div className="purchase-ai-panel__metric">
            <dt>Quotation</dt>
            <dd>
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
          <div className="purchase-ai-panel__metric">
            <dt>Sales order</dt>
            <dd>
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
          <div className="purchase-ai-panel__metric">
            <dt>Pipeline</dt>
            <dd>{confirmed ? 'Confirmed SO' : openSo ? 'Open SO' : row.salesOrderStatus}</dd>
          </div>
        </dl>
      </section>

      <PurchaseAiSuggestionsBlock
        suggestions={[
          ...(onExpectedEntry
            ? [
                {
                  id: 'expected-entry',
                  label: 'Preview expected accounting entry',
                  icon: FileSpreadsheet,
                  onClick: onExpectedEntry,
                  primary: true as const,
                },
              ]
            : []),
          {
            id: 'open-so',
            label: row.salesOrderId ? 'Open sales order' : 'No sales order linked',
            icon: ExternalLink,
            disabled: !row.salesOrderId,
            onClick: () => {
              if (row.salesOrderId) navigate(crmSalesOrderPath(row.salesOrderId))
            },
          },
          ...(!confirmed
            ? [
                {
                  id: 'confirm-hint',
                  label: 'SO not confirmed — posting not available',
                  icon: AlertTriangle,
                  disabled: true,
                },
              ]
            : []),
        ]}
      />
    </PurchaseAiInsightsShell>
  )
}
