import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { GitCompare, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { TableLink } from '@/components/ui/AppLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { getRfqList, getVendorQuotations } from '@/services/purchase'
import type { RfqListRow } from '@/types/purchaseDomain'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { purchaseBreadcrumbs } from '@/utils/purchaseNavigation'

type ComparisonIndexRow = RfqListRow & { quoteCount: number }

export function QuotationComparisonIndexPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<ComparisonIndexRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rfqRows, quotes] = await Promise.all([getRfqList(), getVendorQuotations()])
      const countByRfq = quotes.reduce<Record<string, number>>((acc, q) => {
        acc[q.rfqId] = (acc[q.rfqId] ?? 0) + 1
        return acc
      }, {})
      const enriched = rfqRows
        .map((r) => ({ ...r, quoteCount: countByRfq[r.id] ?? 0 }))
        .filter((r) => r.quoteCount > 0 || r.responsesReceived > 0)
        .sort((a, b) => b.quoteCount - a.quoteCount || b.documentDate.localeCompare(a.documentDate))
      setRows(enriched)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load RFQs')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const columns = useMemo<ColumnDef<ComparisonIndexRow>[]>(
    () => [
      {
        accessorKey: 'documentNumber',
        header: 'RFQ Number',
        cell: ({ row }) => (
          <TableLink to={`/purchase/rfqs/${row.original.id}`} className="font-mono">
            {row.original.documentNumber}
          </TableLink>
        ),
      },
      {
        accessorKey: 'documentDate',
        header: 'RFQ Date',
        cell: ({ row }) => formatDate(row.original.documentDate),
      },
      { accessorKey: 'buyerName', header: 'Buyer' },
      { accessorKey: 'locationName', header: 'Location' },
      {
        accessorKey: 'quoteCount',
        header: 'Quotations',
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">{row.original.quoteCount}</span>
        ),
      },
      {
        accessorKey: 'responsesReceived',
        header: 'Responses',
        cell: ({ row }) =>
          `${row.original.responsesReceived}/${row.original.vendorCount || 0}`,
      },
      {
        accessorKey: 'estimatedValue',
        header: 'Estimated Value',
        cell: ({ row }) => formatCurrency(row.original.estimatedValue),
      },
      {
        accessorKey: 'statusLabel',
        header: 'Status',
        cell: ({ row }) => (
          <StatusDot
            label={row.original.statusLabel}
            tone={statusToneFromLabel(row.original.statusLabel)}
          />
        ),
      },
      {
        id: 'compare',
        header: '',
        cell: ({ row }) => (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-erp-border px-2 py-1 text-[12px] font-medium text-erp-primary hover:bg-erp-surface-alt"
            onClick={() => navigate(`/purchase/comparison/${row.original.id}`)}
          >
            <GitCompare className="h-3.5 w-3.5" />
            Compare
          </button>
        ),
      },
    ],
    [navigate],
  )

  return (
    <OperationalPageShell
      title="Quotation Comparison"
      description="Compare vendor responses side-by-side and select a recommendation"
      badge="Purchase"
      variant="dynamics"
      breadcrumbs={purchaseBreadcrumbs('Comparison')}
      favoritePath="/purchase/comparison"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            {
              id: 'refresh',
              label: 'Refresh',
              icon: RefreshCw,
              onClick: () => void load(),
            },
          ]}
        />
      }
    >
      {loading ? (
        <LoadingState variant="table" rows={6} />
      ) : error ? (
        <EmptyState
          icon={GitCompare}
          title="Could not load comparison index"
          description={error}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={GitCompare}
          title="No RFQs with quotations"
          description="Record vendor quotations against sent RFQs to enable comparison."
        />
      ) : (
        <DataTable data={rows} columns={columns} />
      )}
    </OperationalPageShell>
  )
}
