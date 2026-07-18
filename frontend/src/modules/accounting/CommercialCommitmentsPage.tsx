import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  CommercialCommitmentKpiCards,
  CommercialCommitmentSmartContext,
  CommercialCommitmentTable,
  CommercialAccountingExplanation,
  ExpectedAccountingEntryDrawer,
  filterCommitmentsByTab,
  type CommitmentTab,
} from '@/components/accounting/commercial'
import {
  getCommercialCommitmentSummary,
  listCommercialCommitments,
} from '@/data/accounting/commercialCommitmentsSeed'
import type { CommercialCommitment, CommercialCommitmentSummary } from '@/types/commercialCommitments'
import { formatCurrency } from '@/utils/formatters/currency'
import { cn } from '@/utils/cn'
import { ReceivablesWorkspaceTabs } from '@/components/accounting/receivables'

const TABS: { id: CommitmentTab; label: string }[] = [
  { id: 'approved_quotation', label: 'Approved Quotations' },
  { id: 'open_sales_order', label: 'Open Sales Orders' },
  { id: 'confirmed_sales_order', label: 'Confirmed Sales Orders' },
  { id: 'pending_invoice', label: 'Orders Pending Invoice' },
]

export function CommercialCommitmentsPage() {
  const [rows, setRows] = useState<CommercialCommitment[]>([])
  const [summary, setSummary] = useState<CommercialCommitmentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<CommitmentTab>('confirmed_sales_order')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerLabel, setDrawerLabel] = useState<string | undefined>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, sum] = await Promise.all([listCommercialCommitments(), getCommercialCommitmentSummary()])
      setRows(list)
      setSummary(sum)
      setSelectedId((prev) => prev ?? list[0]?.id ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => filterCommitmentsByTab(rows, tab), [rows, tab])
  const selected = rows.find((r) => r.id === selectedId) ?? filtered[0] ?? null

  const kpiItems = useMemo(() => {
    if (!summary) return []
    return [
      {
        id: 'aq',
        label: 'Approved Quotations',
        value: formatCurrency(summary.approvedQuotationsValue),
        helper: `${summary.approvedQuotationsCount} documents`,
      },
      {
        id: 'open',
        label: 'Open Sales Orders',
        value: formatCurrency(summary.openSalesOrdersValue),
        helper: `${summary.openSalesOrdersCount} orders`,
        href: '/crm/sales-orders?status=open',
      },
      {
        id: 'conf',
        label: 'Confirmed Sales Orders',
        value: formatCurrency(summary.confirmedSalesOrdersValue),
        helper: `${summary.confirmedSalesOrdersCount} confirmed · Not financially posted`,
        href: '/crm/sales-orders?status=confirmed',
      },
      {
        id: 'pend',
        label: 'Orders Pending Invoice',
        value: formatCurrency(summary.pendingInvoiceValue),
        helper: `${summary.pendingInvoiceCount} orders`,
      },
      {
        id: 'total',
        label: 'Total Non-Posted Value',
        value: formatCurrency(summary.totalNonPostedValue),
        helper: `Potential receivable ${formatCurrency(summary.potentialReceivable)}`,
      },
    ]
  }, [summary])

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Receivables"
      title="Commercial Commitments"
      description="Track approved quotations and Sales Orders that have not yet created accounting entries."
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Receivables', to: '/accounting/receivables' },
        { label: 'Commercial Commitments' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/commercial-commitments"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'r', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      <ReceivablesWorkspaceTabs />
      <div className="mt-2 space-y-3">
        <CommercialAccountingExplanation />
        {loading ? <LoadingState /> : null}
        {!loading ? (
          <>
            <CommercialCommitmentKpiCards items={kpiItems} />
            <div className="flex flex-wrap gap-1 border-b border-erp-border">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'border-b-2 px-3 py-2 text-[12px] font-semibold',
                    tab === t.id
                      ? 'border-erp-primary text-erp-primary'
                      : 'border-transparent text-erp-muted hover:text-erp-text',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,28%)]">
              <CommercialCommitmentTable
                rows={filtered}
                selectedId={selected?.id ?? null}
                onSelect={setSelectedId}
                onExpectedEntry={(r) => {
                  setDrawerLabel(
                    [r.salesOrderNo, r.quotationNo, r.customerName].filter(Boolean).join(' · '),
                  )
                  setDrawerOpen(true)
                }}
              />
              <CommercialCommitmentSmartContext
                row={selected}
                onExpectedEntry={() => {
                  if (!selected) return
                  setDrawerLabel(
                    [selected.salesOrderNo, selected.quotationNo, selected.customerName]
                      .filter(Boolean)
                      .join(' · '),
                  )
                  setDrawerOpen(true)
                }}
              />
            </div>
            <p className="text-[11px] text-erp-muted">
              Posted receivables and financial reports exclude these values.{' '}
              <Link to="/accounting/receivables" className="font-semibold text-erp-primary hover:underline">
                Back to Receivables
              </Link>
            </p>
          </>
        ) : null}
      </div>
      <ExpectedAccountingEntryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        documentLabel={drawerLabel}
        showIllustrativeAmounts
      />
    </OperationalPageShell>
  )
}
