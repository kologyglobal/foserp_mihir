import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { Input, Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { listSalesInvoices } from '@/services/bridges/receivablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { SalesInvoiceDto, SalesInvoiceStatus } from '@/types/moneyIn'
import { formatCurrency } from '@/utils/formatters/currency'
import { mergeAllowedAction, useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { invoiceDisplayNumber, moneyInStatusTone, MONEY_IN_STATUS_LABELS, parseDecimal } from '../moneyInUi'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

const STATUS_OPTIONS: Array<{ value: '' | SalesInvoiceStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'READY_TO_POST', label: 'Ready to Post' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export function InvoiceListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const perms = useMoneyInPermissions()
  const [rows, setRows] = useState<SalesInvoiceDto[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'' | SalesInvoiceStatus>((searchParams.get('status') as SalesInvoiceStatus) || '')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listSalesInvoices({
        legalEntityId: resolveLegalEntityId(),
        ...(status ? { status } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      })
      setRows(data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [search, status])

  useEffect(() => {
    if (perms.canViewInvoice) void load()
  }, [load, perms.canViewInvoice])

  if (!perms.canViewInvoice) {
    return (
      <MoneyInWorkspaceShell title="Invoices">
        <p className="text-[13px] text-erp-muted">You do not have permission to view invoices.</p>
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <MoneyInWorkspaceShell
      title="Invoices"
      actions={
        mergeAllowedAction(perms.canCreateInvoice) ? (
          <ErpButton variant="primary" icon={Plus} onClick={() => navigate('/accounting/money-in/invoices/new')}>
            New Invoice
          </ErpButton>
        ) : null
      }
      commandBar={
        <div className="flex flex-wrap items-center gap-2">
          <Select className="h-9 min-w-[160px] text-[12px]" value={status} onChange={(e) => setStatus(e.target.value as '' | SalesInvoiceStatus)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input className="h-9 min-w-[200px] text-[12px]" placeholder="Search invoice / customer / PO" value={search} onChange={(e) => setSearch(e.target.value)} />
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
        </div>
      }
    >
      {loading ? (
        <LoadingState variant="table" />
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-erp-muted">No invoices match your filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border text-erp-muted">
                <th className="py-2 pr-3 font-medium">Invoice</th>
                <th className="py-2 pr-3 font-medium">Customer</th>
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 text-right font-medium">Total</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const actions = inv.allowedActions
                return (
                  <tr key={inv.id} className="border-b border-erp-border/60 hover:bg-slate-50">
                    <td className="py-2 pr-3">
                      <Link to={`/accounting/money-in/invoices/${inv.id}`} className="font-medium text-erp-accent hover:underline">
                        {invoiceDisplayNumber(inv)}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{inv.customerNameSnapshot}</td>
                    <td className="py-2 pr-3 tabular-nums">{inv.invoiceDate}</td>
                    <td className="py-2 pr-3">
                      <ErpStatusChip label={MONEY_IN_STATUS_LABELS[inv.status]} tone={moneyInStatusTone(inv.status)} />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(parseDecimal(inv.totalAmount))}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        <ErpButton variant="ghost" size="sm" onClick={() => navigate(`/accounting/money-in/invoices/${inv.id}`)}>
                          View
                        </ErpButton>
                        {mergeAllowedAction(perms.canEditInvoice, actions?.edit) && (
                          <ErpButton variant="ghost" size="sm" onClick={() => navigate(`/accounting/money-in/invoices/${inv.id}/edit`)}>
                            Edit
                          </ErpButton>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </MoneyInWorkspaceShell>
  )
}
