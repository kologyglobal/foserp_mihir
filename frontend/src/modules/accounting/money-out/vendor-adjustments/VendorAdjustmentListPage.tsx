import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { Input, Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import { listVendorAdjustments } from '@/services/bridges/payablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { VendorAdjustmentDto, VendorAdjustmentStatus, VendorAdjustmentType } from '@/types/moneyOut'
import { formatCurrency } from '@/utils/formatters/currency'
import { mergeAllowedAction, useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import {
  ADJUSTMENT_TYPE_LABELS,
  MONEY_OUT_STATUS_LABELS,
  moneyOutStatusTone,
  parseDecimal,
  vendorAdjustmentDisplayNumber,
} from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

const STATUS_OPTIONS: Array<{ value: '' | VendorAdjustmentStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'READY_TO_POST', label: 'Ready to Post' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REVERSED', label: 'Reversed' },
]

export function VendorAdjustmentListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const perms = useMoneyOutPermissions()
  const [rows, setRows] = useState<VendorAdjustmentDto[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(Number(searchParams.get('page') || '1') || 1)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'' | VendorAdjustmentStatus>(
    (searchParams.get('status') as VendorAdjustmentStatus) || '',
  )
  const [adjustmentType, setAdjustmentType] = useState<'' | VendorAdjustmentType>(
    (searchParams.get('type') as VendorAdjustmentType) || '',
  )
  const [search, setSearch] = useState(searchParams.get('search') || '')

  const syncUrl = useCallback(
    (next: { status?: string; type?: string; search?: string; page?: number }) => {
      const params = new URLSearchParams()
      const s = next.status ?? status
      const t = next.type ?? adjustmentType
      const q = next.search ?? search
      const p = next.page ?? page
      if (s) params.set('status', s)
      if (t) params.set('type', t)
      if (q.trim()) params.set('search', q.trim())
      if (p > 1) params.set('page', String(p))
      setSearchParams(params, { replace: true })
    },
    [adjustmentType, page, search, setSearchParams, status],
  )

  const load = useCallback(async () => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await listVendorAdjustments({
        legalEntityId: resolveLegalEntityId(),
        page,
        limit: 20,
        ...(status ? { status } : {}),
        ...(adjustmentType ? { adjustmentType } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      })
      setRows(result.items)
      setTotal(result.total)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load vendor adjustments')
    } finally {
      setLoading(false)
    }
  }, [adjustmentType, page, search, status])

  useEffect(() => {
    if (perms.canViewAdjustment) void load()
  }, [load, perms.canViewAdjustment])

  if (!perms.canViewAdjustment) {
    return (
      <MoneyOutWorkspaceShell title="Vendor Adjustments">
        <p className="text-[13px] text-erp-muted">You do not have permission to view vendor adjustments.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Vendor Adjustments">
        <p className="text-[13px] text-erp-muted">
          Vendor adjustments require API mode (<code>VITE_USE_API=true</code>).
        </p>
      </MoneyOutWorkspaceShell>
    )
  }

  return (
    <MoneyOutWorkspaceShell
      title="Vendor Adjustments"
      actions={
        mergeAllowedAction(perms.canCreateAdjustment, true) ? (
          <ErpButton icon={Plus} onClick={() => navigate('/accounting/money-out/vendor-adjustments/new?type=VENDOR_DEBIT_NOTE')}>
            New Debit Note
          </ErpButton>
        ) : null
      }
    >
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Select
          className="h-9 min-w-[160px] text-[12px]"
          value={status}
          aria-label="Filter by status"
          onChange={(e) => {
            setStatus(e.target.value as '' | VendorAdjustmentStatus)
            setPage(1)
            syncUrl({ status: e.target.value, page: 1 })
          }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          className="h-9 min-w-[180px] text-[12px]"
          value={adjustmentType}
          aria-label="Filter by type"
          onChange={(e) => {
            setAdjustmentType(e.target.value as '' | VendorAdjustmentType)
            setPage(1)
            syncUrl({ type: e.target.value, page: 1 })
          }}
        >
          <option value="">All types</option>
          <option value="VENDOR_DEBIT_NOTE">{ADJUSTMENT_TYPE_LABELS.VENDOR_DEBIT_NOTE}</option>
          <option value="VENDOR_CREDIT_ADJUSTMENT">{ADJUSTMENT_TYPE_LABELS.VENDOR_CREDIT_ADJUSTMENT}</option>
        </Select>
        <Input
          className="h-9 min-w-[200px] flex-1 text-[12px]"
          value={search}
          placeholder="Reference, vendor, draft…"
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(1)
              syncUrl({ search, page: 1 })
              void load()
            }
          }}
        />
        <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
          Refresh
        </ErpButton>
      </div>

      {loading ? (
        <LoadingState variant="card" />
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-erp-muted">No vendor adjustments match your filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border text-erp-muted">
                <th className="py-2 pr-3 font-medium">Reference</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Vendor</th>
                <th className="py-2 pr-3 font-medium">Document date</th>
                <th className="py-2 pr-3 text-right font-medium">Payable</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-erp-border/60 hover:bg-slate-50/80">
                  <td className="py-2 pr-3">
                    <Link to={`/accounting/money-out/vendor-adjustments/${row.id}`} className="font-medium text-erp-accent hover:underline">
                      {vendorAdjustmentDisplayNumber(row)}
                    </Link>
                    <div className="text-[11px] text-erp-muted">{row.supplierReferenceNumber}</div>
                  </td>
                  <td className="py-2 pr-3">{ADJUSTMENT_TYPE_LABELS[row.adjustmentType]}</td>
                  <td className="py-2 pr-3">{row.vendorNameSnapshot}</td>
                  <td className="py-2 pr-3 tabular-nums">{row.documentDate}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(parseDecimal(row.vendorPayableAmount))}</td>
                  <td className="py-2 pr-3">
                    <ErpStatusChip label={MONEY_OUT_STATUS_LABELS[row.status]} tone={moneyOutStatusTone(row.status)} />
                  </td>
                  <td className="py-2">
                    <Link to={`/accounting/money-out/vendor-adjustments/${row.id}`} className="text-erp-accent hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 20 && (
        <div className="mt-3 flex items-center justify-between text-[12px] text-erp-muted">
          <span>
            Page {page} · {total} total
          </span>
          <div className="flex gap-2">
            <ErpButton
              variant="secondary"
              disabled={page <= 1}
              onClick={() => {
                const next = page - 1
                setPage(next)
                syncUrl({ page: next })
              }}
            >
              Previous
            </ErpButton>
            <ErpButton
              variant="secondary"
              disabled={page * 20 >= total}
              onClick={() => {
                const next = page + 1
                setPage(next)
                syncUrl({ page: next })
              }}
            >
              Next
            </ErpButton>
          </div>
        </div>
      )}
    </MoneyOutWorkspaceShell>
  )
}
