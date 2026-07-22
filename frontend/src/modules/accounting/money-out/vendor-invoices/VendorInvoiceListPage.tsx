import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { Input, Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { listVendorInvoices } from '@/services/bridges/payablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { VendorInvoiceDto, VendorInvoiceStatus } from '@/types/moneyOut'
import { formatCurrency } from '@/utils/formatters/currency'
import { mergeAllowedAction, useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import { isApiMode } from '@/config/apiConfig'
import {
  MONEY_OUT_STATUS_LABELS,
  moneyOutStatusTone,
  parseDecimal,
  vendorInvoiceDisplayNumber,
} from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

const STATUS_OPTIONS: Array<{ value: '' | VendorInvoiceStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'READY_TO_POST', label: 'Ready to Post' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REVERSED', label: 'Reversed' },
]

export function VendorInvoiceListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const perms = useMoneyOutPermissions()
  const [rows, setRows] = useState<VendorInvoiceDto[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(Number(searchParams.get('page') || '1') || 1)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'' | VendorInvoiceStatus>(
    (searchParams.get('status') as VendorInvoiceStatus) || '',
  )
  const [search, setSearch] = useState(searchParams.get('search') || '')

  const syncUrl = useCallback(
    (next: { status?: string; search?: string; page?: number }) => {
      const params = new URLSearchParams()
      const s = next.status ?? status
      const q = next.search ?? search
      const p = next.page ?? page
      if (s) params.set('status', s)
      if (q.trim()) params.set('search', q.trim())
      if (p > 1) params.set('page', String(p))
      setSearchParams(params, { replace: true })
    },
    [page, search, setSearchParams, status],
  )

  const load = useCallback(async () => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await listVendorInvoices({
        legalEntityId: resolveLegalEntityId(),
        page,
        limit: 20,
        ...(status ? { status } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      })
      setRows(result.items)
      setTotal(result.total)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load vendor invoices')
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => {
    if (perms.canViewInvoice) void load()
  }, [load, perms.canViewInvoice])

  if (!perms.canViewInvoice) {
    return (
      <MoneyOutWorkspaceShell title="Vendor Invoices">
        <p className="text-[13px] text-erp-muted">You do not have permission to view vendor invoices.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Vendor Invoices">
        <p className="text-[13px] text-erp-muted">
          Vendor invoices require API mode (<code>VITE_USE_API=true</code>). No separate AP demo workflow.
        </p>
      </MoneyOutWorkspaceShell>
    )
  }

  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <MoneyOutWorkspaceShell
      title="Vendor Invoices"
      actions={
        mergeAllowedAction(perms.canCreateInvoice) ? (
          <ErpButton
            variant="primary"
            icon={Plus}
            onClick={() => navigate('/accounting/money-out/vendor-invoices/new')}
          >
            New Vendor Invoice
          </ErpButton>
        ) : null
      }
      commandBar={
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="h-9 min-w-[160px] text-[12px]"
            value={status}
            onChange={(e) => {
              const v = e.target.value as '' | VendorInvoiceStatus
              setStatus(v)
              setPage(1)
              syncUrl({ status: v, page: 1 })
            }}
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input
            className="h-9 min-w-[200px] text-[12px]"
            placeholder="Search FOS / supplier / vendor"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1)
                syncUrl({ search, page: 1 })
                void load()
              }
            }}
            aria-label="Search vendor invoices"
          />
          <ErpButton
            variant="secondary"
            onClick={() => {
              setPage(1)
              syncUrl({ search, page: 1 })
              void load()
            }}
          >
            Apply
          </ErpButton>
          <ErpButton
            variant="ghost"
            onClick={() => {
              setStatus('')
              setSearch('')
              setPage(1)
              setSearchParams({}, { replace: true })
            }}
          >
            Clear
          </ErpButton>
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
        </div>
      }
    >
      {loading ? (
        <LoadingState variant="table" />
      ) : rows.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-[13px] text-erp-muted">No vendor invoices yet.</p>
          <p className="mt-1 text-[12px] text-erp-muted">
            Record your first supplier invoice to begin tracking payables.
          </p>
          {mergeAllowedAction(perms.canCreateInvoice) && (
            <ErpButton
              className="mt-3"
              variant="primary"
              icon={Plus}
              onClick={() => navigate('/accounting/money-out/vendor-invoices/new')}
            >
              Create Vendor Invoice
            </ErpButton>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-erp-border text-erp-muted">
                  <th className="py-2 pr-3 font-medium">FOS / Draft</th>
                  <th className="py-2 pr-3 font-medium">Supplier Invoice</th>
                  <th className="py-2 pr-3 font-medium">Vendor</th>
                  <th className="py-2 pr-3 font-medium">Invoice Date</th>
                  <th className="py-2 pr-3 font-medium">Due</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 text-right font-medium">Total</th>
                  <th className="py-2 pr-3 text-right font-medium">Payable</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => {
                  const actions = inv.allowedActions
                  return (
                    <tr key={inv.id} className="border-b border-erp-border/60 hover:bg-slate-50">
                      <td className="py-2 pr-3">
                        <Link
                          to={`/accounting/money-out/vendor-invoices/${inv.id}`}
                          className="font-medium text-erp-accent hover:underline"
                        >
                          {vendorInvoiceDisplayNumber(inv)}
                        </Link>
                        {!inv.vendorInvoiceNumber && (
                          <div className="text-[10px] text-erp-muted">Draft reference</div>
                        )}
                      </td>
                      <td className="py-2 pr-3">{inv.supplierInvoiceNumber}</td>
                      <td className="py-2 pr-3 max-w-[180px] truncate" title={inv.vendorNameSnapshot}>
                        {inv.vendorNameSnapshot}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{inv.supplierInvoiceDate}</td>
                      <td className="py-2 pr-3 tabular-nums">{inv.dueDate ?? '—'}</td>
                      <td className="py-2 pr-3">{inv.invoiceType}</td>
                      <td className="py-2 pr-3">
                        <ErpStatusChip
                          label={MONEY_OUT_STATUS_LABELS[inv.status]}
                          tone={moneyOutStatusTone(inv.status)}
                        />
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatCurrency(parseDecimal(inv.invoiceGrandTotal))}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatCurrency(parseDecimal(inv.vendorPayableAmount))}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          <ErpButton
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/accounting/money-out/vendor-invoices/${inv.id}`)}
                          >
                            View
                          </ErpButton>
                          {mergeAllowedAction(perms.canEditInvoice, actions?.edit) && (
                            <ErpButton
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/accounting/money-out/vendor-invoices/${inv.id}/edit`)}
                            >
                              Edit
                            </ErpButton>
                          )}
                          {mergeAllowedAction(perms.canPostInvoice, actions?.post) && (
                            <ErpButton
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/accounting/money-out/vendor-invoices/${inv.id}`)}
                            >
                              Post
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
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-erp-muted">
            <span>
              Page {page} of {totalPages} · {total} invoices
            </span>
            <div className="flex gap-2">
              <ErpButton
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => {
                  const p = page - 1
                  setPage(p)
                  syncUrl({ page: p })
                }}
              >
                Previous
              </ErpButton>
              <ErpButton
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => {
                  const p = page + 1
                  setPage(p)
                  syncUrl({ page: p })
                }}
              >
                Next
              </ErpButton>
            </div>
          </div>
        </>
      )}
    </MoneyOutWorkspaceShell>
  )
}
