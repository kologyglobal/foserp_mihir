import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileText,
  IndianRupee,
  Receipt,
  ShoppingCart,
  TrendingUp,
  User,
} from 'lucide-react'
import type { Opportunity, QuotationDocument } from '../../types/crm'
import type { ReceivableRow } from '../../types/invoice'
import type { SalesManagementMetrics } from '../../utils/salesManagementMetrics'
import { formatSalesCurrency } from '../../utils/salesManagementMetrics'
import { DynamicsDashboardPanel } from '../dynamics/DynamicsDashboardPanel'
import { DynamicsStatusChip } from '../dynamics/DynamicsStatusChip'
import { TableLink } from '../ui/AppLink'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { salesCustomer360Path } from '../../config/entity360Routes'
import { buildSalesOrderNewUrl } from '../../utils/crmSalesOrderNavigation'

interface Lookup {
  customerName: (id: string) => string
}

export function SalesPipelineHandoverPanel({
  metrics,
  lookup,
}: {
  metrics: SalesManagementMetrics
  lookup: Lookup
}) {
  const navigate = useNavigate()

  return (
    <DynamicsDashboardPanel
      title="Pipeline → order handover"
      actions={
        metrics.wonDealsWithoutSo > 0 ? (
          <DynamicsStatusChip label={`${metrics.wonDealsWithoutSo} won — no SO`} tone="warning" />
        ) : (
          <DynamicsStatusChip label="Handover clear" tone="success" />
        )
      }
      noPadding
    >
      <div className="sales-handover-grid">
        <button type="button" className="sales-handover-stat" onClick={() => navigate('/crm/leads')}>
          <span className="sales-handover-stat-value">{metrics.activeLeads}</span>
          <span className="sales-handover-stat-label">Active leads</span>
        </button>
        <button type="button" className="sales-handover-stat" onClick={() => navigate('/crm/opportunities')}>
          <span className="sales-handover-stat-value">{formatSalesCurrency(metrics.pipelineValue)}</span>
          <span className="sales-handover-stat-label">{metrics.openOpportunities} opportunities</span>
        </button>
        <button type="button" className="sales-handover-stat" onClick={() => navigate('/crm/quotations')}>
          <span className="sales-handover-stat-value">{metrics.quotationsPending}</span>
          <span className="sales-handover-stat-label">Quotes pending</span>
        </button>
        <button type="button" className="sales-handover-stat" onClick={() => navigate('/sales/orders')}>
          <span className="sales-handover-stat-value">{formatSalesCurrency(metrics.orderBookValue)}</span>
          <span className="sales-handover-stat-label">{metrics.openOrders} open SOs</span>
        </button>
      </div>
      {metrics.wonWithoutSo.length > 0 && (
        <table className="erp-table sales-handover-table">
          <thead>
            <tr>
              <th>Won deal</th>
              <th>Customer</th>
              <th>Value</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {metrics.wonWithoutSo.map((opp) => (
              <tr key={opp.id}>
                <td>
                  <TableLink to={`/crm/opportunities/${opp.id}`}>{opp.opportunityName}</TableLink>
                </td>
                <td>{lookup.customerName(opp.customerId)}</td>
                <td className="num">{formatSalesCurrency(opp.value)}</td>
                <td>
                  <button
                    type="button"
                    className="sales-inline-action"
                    onClick={() => navigate(buildSalesOrderNewUrl(opp.id))}
                  >
                    Create SO
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DynamicsDashboardPanel>
  )
}

export function SalesReceivablesPanel({ receivables }: { receivables: ReceivableRow[] }) {
  const navigate = useNavigate()

  return (
    <DynamicsDashboardPanel
      title="Receivables & collections"
      actions={
        receivables.length > 0 ? (
          <DynamicsStatusChip
            label={`${receivables.filter((r) => r.paymentStatus === 'overdue').length} overdue`}
            tone={receivables.some((r) => r.paymentStatus === 'overdue') ? 'critical' : 'neutral'}
          />
        ) : null
      }
      noPadding
    >
      {receivables.length === 0 ? (
        <div className="crm-empty-state">
          <CheckCircle2 className="h-8 w-8 text-erp-success" />
          <p className="crm-card-title">No outstanding receivables</p>
          <p className="crm-helper-text">All posted invoices are collected.</p>
        </div>
      ) : (
        <table className="erp-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Due</th>
              <th>Balance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {receivables.map((r) => (
              <tr
                key={r.invoiceId}
                className="dashboard-clickable-row"
                onClick={() => navigate(`/invoices/register/${r.invoiceId}`)}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/invoices/register/${r.invoiceId}`)
                }}
              >
                <td>{r.invoiceNo}</td>
                <td>{r.customerName}</td>
                <td>{formatDate(r.dueDate)}</td>
                <td className="num">{formatCurrency(r.balanceDue)}</td>
                <td>
                  <span className={`sales-ar-pill sales-ar-pill-${r.paymentStatus}`}>
                    {r.paymentStatus}
                    {r.daysOverdue > 0 ? ` · ${r.daysOverdue}d` : ''}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="sales-panel-footer">
        <button type="button" className="sales-inline-action" onClick={() => navigate('/invoices/register')}>
          Open invoice register
        </button>
      </div>
    </DynamicsDashboardPanel>
  )
}

export function SalesTopCustomersPanel({
  customers,
}: {
  customers: SalesManagementMetrics['topCustomers']
}) {
  const navigate = useNavigate()
  const max = Math.max(...customers.map((c) => c.value), 1)

  return (
    <DynamicsDashboardPanel title="Top customers — order book" noPadding>
      {customers.length === 0 ? (
        <p className="dyn-empty-hint p-4">No active order book by customer.</p>
      ) : (
        <ul className="sales-rank-list">
          {customers.map((c) => (
            <li key={c.customerId}>
              <button
                type="button"
                className="sales-rank-row"
                onClick={() => navigate(salesCustomer360Path(c.customerId))}
              >
                <Building2 className="h-4 w-4 shrink-0 text-erp-primary" aria-hidden />
                <div className="sales-rank-main">
                  <span className="sales-rank-name">{c.customerName}</span>
                  <span className="sales-rank-meta">{c.orderCount} order{c.orderCount !== 1 ? 's' : ''}</span>
                  <span className="sales-rank-bar" aria-hidden>
                    <span className="sales-rank-bar-fill" style={{ width: `${Math.round((c.value / max) * 100)}%` }} />
                  </span>
                </div>
                <span className="sales-rank-value">{formatSalesCurrency(c.value)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </DynamicsDashboardPanel>
  )
}

export function SalesOwnerPerformancePanel({
  owners,
}: {
  owners: SalesManagementMetrics['topOwners']
}) {
  const max = Math.max(...owners.map((o) => o.value), 1)

  return (
    <DynamicsDashboardPanel title="Sales owner — order book" noPadding>
      {owners.length === 0 ? (
        <p className="dyn-empty-hint p-4">Assign sales owners on orders to track performance.</p>
      ) : (
        <ul className="sales-rank-list">
          {owners.map((o) => (
            <li key={o.ownerName}>
              <div className="sales-rank-row sales-rank-row-static">
                <User className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden />
                <div className="sales-rank-main">
                  <span className="sales-rank-name">{o.ownerName}</span>
                  <span className="sales-rank-meta">{o.orderCount} active SO{o.orderCount !== 1 ? 's' : ''}</span>
                  <span className="sales-rank-bar" aria-hidden>
                    <span className="sales-rank-bar-fill sales-rank-bar-fill-indigo" style={{ width: `${Math.round((o.value / max) * 100)}%` }} />
                  </span>
                </div>
                <span className="sales-rank-value">{formatSalesCurrency(o.value)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DynamicsDashboardPanel>
  )
}

export function SalesQuotationApprovalsPanel({
  documents,
  customers,
  opportunities,
}: {
  documents: QuotationDocument[]
  customers: { id: string; customerName: string }[]
  opportunities: Opportunity[]
}) {
  const navigate = useNavigate()

  return (
    <DynamicsDashboardPanel
      title="Quotation approvals"
      actions={
        documents.length > 0 ? (
          <DynamicsStatusChip label={`${documents.length} pending`} tone="warning" />
        ) : null
      }
      noPadding
    >
      {documents.length === 0 ? (
        <div className="crm-empty-state">
          <CheckCircle2 className="h-8 w-8 text-erp-success" />
          <p className="crm-card-title">No quotations awaiting approval</p>
        </div>
      ) : (
        <table className="erp-table">
          <thead>
            <tr>
              <th>Document</th>
              <th>Customer</th>
              <th>Opportunity</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const opp = doc.opportunityId ? opportunities.find((o) => o.id === doc.opportunityId) : null
              const cust = opp ? customers.find((c) => c.id === opp.customerId) : null
              return (
                <tr key={doc.id}>
                  <td>
                    <TableLink to={`/crm/quotations/${doc.quotationId}`}>Rev {doc.revisionNo}</TableLink>
                  </td>
                  <td>{cust?.customerName ?? '—'}</td>
                  <td>{opp?.opportunityName ?? '—'}</td>
                  <td className="num">{formatSalesCurrency(doc.totalAmount)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <div className="sales-panel-footer">
        <button type="button" className="sales-inline-action" onClick={() => navigate('/crm/quotations?status=pending_approval')}>
          Open quotation register
        </button>
      </div>
    </DynamicsDashboardPanel>
  )
}

export function SalesBillingSummaryPanel({ metrics }: { metrics: SalesManagementMetrics }) {
  const navigate = useNavigate()

  return (
    <DynamicsDashboardPanel title="Billing summary" noPadding>
      <div className="sales-billing-grid">
        <div className="sales-billing-tile">
          <IndianRupee className="h-5 w-5 text-emerald-600" aria-hidden />
          <span className="sales-billing-value">{formatSalesCurrency(metrics.totalInvoiced)}</span>
          <span className="sales-billing-label">Total invoiced</span>
        </div>
        <div className="sales-billing-tile">
          <Receipt className="h-5 w-5 text-erp-primary" aria-hidden />
          <span className="sales-billing-value">{formatSalesCurrency(metrics.totalCollected)}</span>
          <span className="sales-billing-label">Collected · {metrics.collectionRate}%</span>
        </div>
        <div className="sales-billing-tile">
          <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
          <span className="sales-billing-value">{formatSalesCurrency(metrics.totalReceivable)}</span>
          <span className="sales-billing-label">{metrics.unpaidReceivables} unpaid · {metrics.overdueReceivables} overdue</span>
        </div>
        <div className="sales-billing-tile">
          <FileText className="h-5 w-5 text-indigo-500" aria-hidden />
          <span className="sales-billing-value">{metrics.proformaIssued}</span>
          <span className="sales-billing-label">{metrics.proformaDraft} draft · {metrics.proformaExpired} expired PI</span>
        </div>
      </div>
      <div className="sales-panel-footer sales-panel-footer-split">
        <button type="button" className="sales-inline-action" onClick={() => navigate('/invoices/register')}>
          Invoices
        </button>
        <button type="button" className="sales-inline-action" onClick={() => navigate('/sales/proforma-invoices')}>
          Proforma invoices
        </button>
        <button type="button" className="sales-inline-action" onClick={() => navigate('/reports/sales/open-orders')}>
          Open orders report
        </button>
      </div>
    </DynamicsDashboardPanel>
  )
}

export function SalesCommercialKpiStrip({
  metrics,
}: {
  metrics: SalesManagementMetrics
}) {
  return (
    <div className="sales-commercial-kpis" aria-label="Commercial KPIs">
      <div className="sales-commercial-kpi">
        <TrendingUp className="h-4 w-4" aria-hidden />
        <div>
          <span className="sales-commercial-kpi-value">{formatSalesCurrency(metrics.weightedForecast)}</span>
          <span className="sales-commercial-kpi-label">Weighted forecast</span>
        </div>
      </div>
      <div className="sales-commercial-kpi">
        <ShoppingCart className="h-4 w-4" aria-hidden />
        <div>
          <span className="sales-commercial-kpi-value">{metrics.conversionRate}%</span>
          <span className="sales-commercial-kpi-label">Win rate</span>
        </div>
      </div>
      <div className="sales-commercial-kpi">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        <div>
          <span className="sales-commercial-kpi-value">{metrics.onTimeDeliveryPct}%</span>
          <span className="sales-commercial-kpi-label">On-time delivery</span>
        </div>
      </div>
      <div className="sales-commercial-kpi">
        <IndianRupee className="h-4 w-4" aria-hidden />
        <div>
          <span className="sales-commercial-kpi-value">{metrics.collectionRate}%</span>
          <span className="sales-commercial-kpi-label">Collection rate</span>
        </div>
      </div>
    </div>
  )
}
