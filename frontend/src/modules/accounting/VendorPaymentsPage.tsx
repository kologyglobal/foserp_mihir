import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Eye,
  FileText,
  HandCoins,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldOff,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { TableLink } from '@/components/ui/AppLink'
import {
  PayablesWorkspaceTabs,
  PaymentAllocationStatusBadge,
  PaymentPostingPreviewModal,
  PayableConfirmModal,
  VendorPaymentStatusBadge,
} from '@/components/accounting/payables'
import {
  DEFAULT_PAYABLE_FILTER,
  getPaymentPostingPreview,
  getVendorPayments,
  postPaymentDemo,
  reversePaymentDemo,
  submitVendorPayment,
  PayablesServiceError,
} from '@/services/accounting/payablesService'
import type { PayableFilter, PaymentPostingPreview, VendorPayment } from '@/types/payables'
import { usePayablesPermissions } from '@/utils/permissions/payables'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

const TABS: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'submitted', label: 'Pending Approval' },
  { id: 'approved', label: 'Approved' },
  { id: 'posted', label: 'Posted' },
  { id: 'unallocated', label: 'Unallocated' },
  { id: 'partially_allocated', label: 'Partially Allocated' },
  { id: 'fully_allocated', label: 'Fully Allocated' },
  { id: 'reversed', label: 'Reversed' },
]

function tabCount(rows: VendorPayment[], tab: string) {
  if (tab === 'all') return rows.length
  const map: Record<string, (r: VendorPayment) => boolean> = {
    draft: (r) => r.status === 'Draft',
    submitted: (r) => r.status === 'Submitted',
    approved: (r) => r.status === 'Approved',
    posted: (r) => r.status === 'Posted',
    unallocated: (r) => r.allocationStatus === 'Unallocated',
    partially_allocated: (r) => r.allocationStatus === 'Partially Allocated',
    fully_allocated: (r) => r.allocationStatus === 'Fully Allocated',
    reversed: (r) => r.status === 'Reversed',
  }
  return rows.filter(map[tab] ?? (() => true)).length
}

export function VendorPaymentsPage() {
  const navigate = useNavigate()
  const perms = usePayablesPermissions()
  const [filter, setFilter] = useState<PayableFilter>({ ...DEFAULT_PAYABLE_FILTER, paymentTab: 'all' })
  const [allRows, setAllRows] = useState<VendorPayment[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [postPayment, setPostPayment] = useState<VendorPayment | null>(null)
  const [postPreview, setPostPreview] = useState<PaymentPostingPreview | null>(null)
  const [reversePayment, setReversePayment] = useState<VendorPayment | null>(null)
  const [reverseReason, setReverseReason] = useState('')

  const load = useCallback(async () => {
    if (!perms.canView) {
      setLoadState('error')
      setErrorMsg('You do not have permission to view vendor payments.')
      return
    }
    setLoadState('loading')
    try {
      const list = await getVendorPayments({ search: filter.search })
      setAllRows(list)
      const filtered = await getVendorPayments({ search: filter.search, paymentTab: filter.paymentTab })
      setLoadState(filtered.length ? 'ready' : 'empty')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load payments')
      setLoadState('error')
    }
  }, [filter.search, filter.paymentTab, perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(
    () =>
      allRows.filter((r) => {
        if (filter.paymentTab === 'all') return true
        const map: Record<string, (x: VendorPayment) => boolean> = {
          draft: (x) => x.status === 'Draft',
          submitted: (x) => x.status === 'Submitted',
          approved: (x) => x.status === 'Approved',
          posted: (x) => x.status === 'Posted',
          unallocated: (x) => x.allocationStatus === 'Unallocated',
          partially_allocated: (x) => x.allocationStatus === 'Partially Allocated',
          fully_allocated: (x) => x.allocationStatus === 'Fully Allocated',
          reversed: (x) => x.status === 'Reversed',
        }
        return map[filter.paymentTab]?.(r) ?? true
      }),
    [allRows, filter.paymentTab],
  )

  const kpiItems: EnterpriseKpiItem[] = useMemo(() => {
    const posted = allRows.filter((r) => r.status === 'Posted')
    const unalloc = allRows.filter((r) => r.unallocatedAmount > 0 && r.status !== 'Reversed')
    return [
      {
        id: 'total',
        label: 'Total payments',
        value: allRows.length,
        accent: 'blue',
        active: filter.paymentTab === 'all',
        onClick: () => setFilter((f) => ({ ...f, paymentTab: 'all' })),
      },
      {
        id: 'draft',
        label: 'Draft',
        value: tabCount(allRows, 'draft'),
        accent: 'slate',
        active: filter.paymentTab === 'draft',
        onClick: () => setFilter((f) => ({ ...f, paymentTab: 'draft' })),
      },
      {
        id: 'posted',
        label: 'Posted value',
        value: formatCompactCurrency(posted.reduce((s, r) => s + r.amount, 0)),
        accent: 'green',
        active: filter.paymentTab === 'posted',
        onClick: () => setFilter((f) => ({ ...f, paymentTab: 'posted' })),
      },
      {
        id: 'unalloc',
        label: 'Unallocated',
        value: formatCompactCurrency(unalloc.reduce((s, r) => s + r.unallocatedAmount, 0)),
        accent: 'amber',
        active: filter.paymentTab === 'unallocated',
        onClick: () => setFilter((f) => ({ ...f, paymentTab: 'unallocated' })),
      },
    ]
  }, [allRows, filter.paymentTab])

  const openPost = async (p: VendorPayment) => {
    try {
      const preview = await getPaymentPostingPreview(p.id)
      setPostPayment(p)
      setPostPreview(preview)
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Preview failed')
    }
  }

  const confirmPost = async () => {
    if (!postPayment) return
    setBusy(true)
    try {
      await postPaymentDemo(postPayment.id)
      notify.success('Payment marked as posted in demo mode. Backend accounting posting and bank disbursement are not connected.')
      setPostPayment(null)
      setPostPreview(null)
      await load()
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Post failed')
    } finally {
      setBusy(false)
    }
  }

  const confirmReverse = async () => {
    if (!reversePayment || !reverseReason.trim()) return
    setBusy(true)
    try {
      await reversePaymentDemo(reversePayment.id, reverseReason.trim())
      notify.success('Payment reversed in demo mode. No GL reversal or bank recall was posted.')
      setReversePayment(null)
      setReverseReason('')
      await load()
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Reverse failed')
    } finally {
      setBusy(false)
    }
  }

  const submitDraft = async (p: VendorPayment) => {
    setBusy(true)
    try {
      await submitVendorPayment(p.id)
      notify.success(`${p.paymentNumber} submitted for approval`)
      await load()
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canView) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Vendor Payments"
        breadcrumbs={[
          { label: 'Accounting', to: '/accounting' },
          { label: 'Payables', to: '/accounting/payables' },
          { label: 'Payments' },
        ]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ShieldOff} title="Access denied" description="Missing accounting.payables.view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Vendor Payments"
      description="Record vendor disbursements, allocate to open invoices, and post payment vouchers — demo UI only."
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Payables', to: '/accounting/payables' },
        { label: 'Payments' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/payables/payments"
      kpiStrip={loadState === 'ready' || loadState === 'empty' ? kpiItems : undefined}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreatePayment
              ? {
                  id: 'new',
                  label: 'New Payment',
                  icon: Plus,
                  onClick: () => navigate('/accounting/payables/payments/new'),
                }
              : undefined
          }
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      <PayablesWorkspaceTabs active="vendor_payments" />
      <div className="mb-3 mt-3 flex flex-col gap-3">
        <SearchInput
          value={filter.search}
          onChange={(v) => setFilter((f) => ({ ...f, search: v }))}
          placeholder="Search payment no, vendor, reference…"
        />
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Payment status tabs">
          {TABS.map((tab) => {
            const count = tabCount(allRows, tab.id)
            const selected = filter.paymentTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium ring-1 ring-inset',
                  selected
                    ? 'bg-sky-50 text-sky-900 ring-sky-300'
                    : 'bg-white text-erp-muted ring-erp-border hover:bg-erp-surface-alt',
                )}
                onClick={() => setFilter((f) => ({ ...f, paymentTab: tab.id }))}
              >
                {tab.label}
                <span className="tabular-nums text-[11px] opacity-80">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      <EnterpriseRegisterTableShell>
        {loadState === 'loading' ? (
          <div className="p-6">
            <LoadingState variant="table" rows={8} />
          </div>
        ) : null}
        {loadState === 'error' ? (
          <div className="p-6">
            <EmptyState icon={FileText} title="Could not load payments" description={errorMsg} />
          </div>
        ) : null}
        {loadState === 'empty' ? (
          <div className="p-6">
            <EmptyState
              icon={HandCoins}
              title="No payments match"
              description="Record a vendor payment to allocate against open invoices."
              action={
                perms.canCreatePayment ? (
                  <button
                    type="button"
                    className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
                    onClick={() => navigate('/accounting/payables/payments/new')}
                  >
                    New Payment
                  </button>
                ) : null
              }
            />
          </div>
        ) : null}
        {loadState === 'ready' ? (
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[1100px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                  <th className="px-3 py-2 font-semibold">Payment No</th>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Vendor</th>
                  <th className="px-3 py-2 font-semibold">Mode</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                  <th className="px-3 py-2 text-right font-semibold">Unallocated</th>
                  <th className="px-3 py-2 font-semibold">Allocation</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-erp-border/80 hover:bg-erp-surface-alt/40">
                    <td className="px-3 py-2">
                      <TableLink to={`/accounting/payables/payments/${p.id}`}>{p.paymentNumber}</TableLink>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{p.paymentDate}</td>
                    <td className="px-3 py-2">{p.vendorName}</td>
                    <td className="px-3 py-2">{p.paymentMode}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(p.amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(p.unallocatedAmount)}</td>
                    <td className="px-3 py-2">
                      <PaymentAllocationStatusBadge status={p.allocationStatus} />
                    </td>
                    <td className="px-3 py-2">
                      <VendorPaymentStatusBadge status={p.status} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                          title="View"
                          onClick={() => navigate(`/accounting/payables/payments/${p.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {perms.canEditPayment && p.status === 'Draft' ? (
                          <button
                            type="button"
                            className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                            title="Edit"
                            onClick={() => navigate(`/accounting/payables/payments/${p.id}/edit`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : null}
                        {perms.canAllocatePayment && p.unallocatedAmount > 0 && p.status !== 'Reversed' ? (
                          <button
                            type="button"
                            className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                            title="Allocate"
                            onClick={() =>
                              navigate(
                                p.status === 'Draft'
                                  ? `/accounting/payables/payments/${p.id}/edit`
                                  : `/accounting/payables/payments/${p.id}`,
                              )
                            }
                          >
                            <HandCoins className="h-4 w-4" />
                          </button>
                        ) : null}
                        {perms.canSubmitPayment && p.status === 'Draft' ? (
                          <button
                            type="button"
                            className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                            title="Submit"
                            onClick={() => void submitDraft(p)}
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        ) : null}
                        {perms.canPostPayment && (p.status === 'Draft' || p.status === 'Submitted' || p.status === 'Approved') ? (
                          <button
                            type="button"
                            className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                            title="Post Demo"
                            onClick={() => void openPost(p)}
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                        ) : null}
                        {perms.canPrint ? (
                          <button
                            type="button"
                            className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                            title="Print"
                            onClick={() => notify.info('Print preview — demo only')}
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        ) : null}
                        {perms.canReversePayment && p.status === 'Posted' ? (
                          <button
                            type="button"
                            className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                            title="Reverse"
                            onClick={() => setReversePayment(p)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        ) : null}
                        {p.voucherId ? (
                          <button
                            type="button"
                            className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                            title="Open Voucher"
                            onClick={() => navigate(`/accounting/ledger-entries/voucher/${p.voucherId}`)}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </EnterpriseRegisterTableShell>

      <PaymentPostingPreviewModal
        open={Boolean(postPayment && postPreview)}
        preview={postPreview}
        onClose={() => {
          setPostPayment(null)
          setPostPreview(null)
        }}
        onConfirmPost={() => void confirmPost()}
        busy={busy}
      />

      <PayableConfirmModal
        open={Boolean(reversePayment)}
        onClose={() => {
          setReversePayment(null)
          setReverseReason('')
        }}
        title="Reverse payment (demo)"
        description={`Reverse ${reversePayment?.paymentNumber}? No GL reversal or bank recall will be posted.`}
        confirmLabel={busy ? 'Reversing…' : 'Confirm reverse'}
        onConfirm={() => void confirmReverse()}
      >
        <textarea
          className="erp-input mt-3 w-full text-[13px]"
          rows={3}
          placeholder="Reversal reason (required)"
          value={reverseReason}
          onChange={(e) => setReverseReason(e.target.value)}
        />
      </PayableConfirmModal>
    </OperationalPageShell>
  )
}
