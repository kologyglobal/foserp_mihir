import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { Input, Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { listVendorPayments } from '@/services/bridges/payablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { VendorPaymentDto, VendorPaymentPurpose, VendorPaymentStatus } from '@/types/moneyOut'
import { formatCurrency } from '@/utils/formatters/currency'
import { mergeAllowedAction, useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import { isApiMode } from '@/config/apiConfig'
import {
  MONEY_OUT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_PURPOSE_LABELS,
  moneyOutStatusTone,
  parseDecimal,
  vendorPaymentDisplayNumber,
} from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

const STATUS_OPTIONS: Array<{ value: '' | VendorPaymentStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'READY_TO_POST', label: 'Ready to Post' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

/**
 * Vendor payment register. When `purpose` is fixed (Vendor Advances view), the purpose filter is
 * locked and the create button targets the advance form.
 */
export function VendorPaymentListPage({
  fixedPurpose,
  title = 'Vendor Payments',
}: {
  fixedPurpose?: VendorPaymentPurpose
  title?: string
} = {}) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const perms = useMoneyOutPermissions()
  const [rows, setRows] = useState<VendorPaymentDto[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(Number(searchParams.get('page') || '1') || 1)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'' | VendorPaymentStatus>(
    (searchParams.get('status') as VendorPaymentStatus) || '',
  )
  const [search, setSearch] = useState(searchParams.get('search') || '')

  const isAdvanceView = fixedPurpose === 'ADVANCE'
  const newPath = isAdvanceView
    ? '/accounting/money-out/vendor-payments/new?purpose=ADVANCE'
    : '/accounting/money-out/vendor-payments/new'

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
      const result = await listVendorPayments({
        legalEntityId: resolveLegalEntityId(),
        page,
        limit: 20,
        ...(fixedPurpose ? { paymentPurpose: fixedPurpose } : {}),
        ...(status ? { status } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      })
      setRows(result.items)
      setTotal(result.total)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load vendor payments')
    } finally {
      setLoading(false)
    }
  }, [page, search, status, fixedPurpose])

  useEffect(() => {
    if (perms.canViewPayment) void load()
  }, [load, perms.canViewPayment])

  if (!perms.canViewPayment) {
    return (
      <MoneyOutWorkspaceShell title={title}>
        <p className="text-[13px] text-erp-muted">You do not have permission to view vendor payments.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title={title}>
        <p className="text-[13px] text-erp-muted">
          Vendor payments require API mode (<code>VITE_USE_API=true</code>). No separate AP demo workflow.
        </p>
      </MoneyOutWorkspaceShell>
    )
  }

  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <MoneyOutWorkspaceShell
      title={title}
      actions={
        mergeAllowedAction(perms.canCreatePayment) ? (
          <ErpButton variant="primary" icon={Plus} onClick={() => navigate(newPath)}>
            {isAdvanceView ? 'New Advance' : 'New Payment'}
          </ErpButton>
        ) : null
      }
      commandBar={
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="h-9 min-w-[160px] text-[12px]"
            value={status}
            onChange={(e) => {
              const v = e.target.value as '' | VendorPaymentStatus
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
            placeholder="Search FOS / vendor / reference"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1)
                syncUrl({ search, page: 1 })
                void load()
              }
            }}
            aria-label="Search vendor payments"
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
          <p className="text-[13px] text-erp-muted">
            {isAdvanceView ? 'No vendor advances yet.' : 'No vendor payments yet.'}
          </p>
          <p className="mt-1 text-[12px] text-erp-muted">
            {isAdvanceView
              ? 'Record an advance to a vendor to create an on-account balance.'
              : 'Record a payment to settle vendor invoices or create an advance.'}
          </p>
          {mergeAllowedAction(perms.canCreatePayment) && (
            <ErpButton className="mt-3" variant="primary" icon={Plus} onClick={() => navigate(newPath)}>
              {isAdvanceView ? 'Create Advance' : 'Create Payment'}
            </ErpButton>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-erp-border text-erp-muted">
                  <th className="py-2 pr-3 font-medium">FOS / Draft</th>
                  <th className="py-2 pr-3 font-medium">Vendor</th>
                  <th className="py-2 pr-3 font-medium">Purpose</th>
                  <th className="py-2 pr-3 font-medium">Method</th>
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 text-right font-medium">Cash paid</th>
                  <th className="py-2 pr-3 text-right font-medium">Settlement</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((pmt) => {
                  const actions = pmt.allowedActions
                  return (
                    <tr key={pmt.id} className="border-b border-erp-border/60 hover:bg-slate-50">
                      <td className="py-2 pr-3">
                        <Link
                          to={`/accounting/money-out/vendor-payments/${pmt.id}`}
                          className="font-medium text-erp-accent hover:underline"
                        >
                          {vendorPaymentDisplayNumber(pmt)}
                        </Link>
                        {!pmt.vendorPaymentNumber && <div className="text-[10px] text-erp-muted">Draft reference</div>}
                      </td>
                      <td className="py-2 pr-3 max-w-[180px] truncate" title={pmt.vendorNameSnapshot}>
                        {pmt.vendorNameSnapshot}
                      </td>
                      <td className="py-2 pr-3">{PAYMENT_PURPOSE_LABELS[pmt.paymentPurpose]}</td>
                      <td className="py-2 pr-3">{PAYMENT_METHOD_LABELS[pmt.paymentMethod]}</td>
                      <td className="py-2 pr-3 tabular-nums">{pmt.paymentDate}</td>
                      <td className="py-2 pr-3">
                        <ErpStatusChip label={MONEY_OUT_STATUS_LABELS[pmt.status]} tone={moneyOutStatusTone(pmt.status)} />
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatCurrency(parseDecimal(pmt.paymentAmount))}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatCurrency(parseDecimal(pmt.vendorSettlementAmount))}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          <ErpButton
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/accounting/money-out/vendor-payments/${pmt.id}`)}
                          >
                            View
                          </ErpButton>
                          {mergeAllowedAction(perms.canEditPayment, actions?.edit) && (
                            <ErpButton
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/accounting/money-out/vendor-payments/${pmt.id}/edit`)}
                            >
                              Edit
                            </ErpButton>
                          )}
                          {mergeAllowedAction(perms.canCreateAllocation, actions?.allocate) && (
                            <ErpButton
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/accounting/money-out/vendor-payments/${pmt.id}/allocate`)}
                            >
                              Allocate
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
              Page {page} of {totalPages} · {total} {isAdvanceView ? 'advances' : 'payments'}
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
