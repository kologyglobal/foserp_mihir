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
  User,
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
  AllocationStatusBadge,
  ReceiptPostingPreviewModal,
  ReceiptStatusBadge,
  ReceivableConfirmModal,
  ReceivablesWorkspaceTabs,
} from '@/components/accounting/receivables'
import {
  DEFAULT_RECEIVABLE_FILTER,
  getCustomerReceipts,
  getReceiptPostingPreview,
  postReceiptDemo,
  reverseReceiptDemo,
  updateCustomerReceipt,
  ReceivablesServiceError,
} from '@/services/accounting/receivablesService'
import type { CustomerReceipt, ReceivableFilter } from '@/types/receivables'
import { useReceivablesPermissions } from '@/utils/permissions/receivables'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import type { ReceiptPostingPreview } from '@/types/receivables'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

const TABS: { id: string; label: string }[] = [
  { id: 'all', label: 'All Receipts' },
  { id: 'draft', label: 'Draft' },
  { id: 'pending_approval', label: 'Pending Approval' },
  { id: 'posted', label: 'Posted' },
  { id: 'unallocated', label: 'Unallocated' },
  { id: 'partially_allocated', label: 'Partially Allocated' },
  { id: 'fully_allocated', label: 'Fully Allocated' },
  { id: 'reversed', label: 'Reversed' },
]

function tabCount(rows: CustomerReceipt[], tab: string) {
  if (tab === 'all') return rows.length
  const map: Record<string, (r: CustomerReceipt) => boolean> = {
    draft: (r) => r.voucherStatus === 'Draft',
    pending_approval: (r) => r.voucherStatus === 'Pending Approval',
    posted: (r) => r.voucherStatus === 'Posted',
    unallocated: (r) => r.allocationStatus === 'Unallocated',
    partially_allocated: (r) => r.allocationStatus === 'Partially Allocated',
    fully_allocated: (r) => r.allocationStatus === 'Fully Allocated',
    reversed: (r) => r.voucherStatus === 'Reversed',
  }
  return rows.filter(map[tab] ?? (() => true)).length
}

export function CustomerReceiptsPage() {
  const navigate = useNavigate()
  const perms = useReceivablesPermissions()
  const [filter, setFilter] = useState<ReceivableFilter>({ ...DEFAULT_RECEIVABLE_FILTER, receiptTab: 'all' })
  const [allRows, setAllRows] = useState<CustomerReceipt[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [postReceipt, setPostReceipt] = useState<CustomerReceipt | null>(null)
  const [postPreview, setPostPreview] = useState<ReceiptPostingPreview | null>(null)
  const [reverseReceipt, setReverseReceipt] = useState<CustomerReceipt | null>(null)
  const [reverseReason, setReverseReason] = useState('')

  const load = useCallback(async () => {
    if (!perms.canView) {
      setLoadState('error')
      setErrorMsg('You do not have permission to view receipts.')
      return
    }
    setLoadState('loading')
    try {
      const list = await getCustomerReceipts({ search: filter.search })
      setAllRows(list)
      const filtered = await getCustomerReceipts({ search: filter.search, receiptTab: filter.receiptTab })
      setLoadState(filtered.length ? 'ready' : 'empty')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load receipts')
      setLoadState('error')
    }
  }, [filter.search, filter.receiptTab, perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(
    () =>
      allRows.filter((r) => {
        if (filter.receiptTab === 'all') return true
        const map: Record<string, (x: CustomerReceipt) => boolean> = {
          draft: (x) => x.voucherStatus === 'Draft',
          pending_approval: (x) => x.voucherStatus === 'Pending Approval',
          posted: (x) => x.voucherStatus === 'Posted',
          unallocated: (x) => x.allocationStatus === 'Unallocated',
          partially_allocated: (x) => x.allocationStatus === 'Partially Allocated',
          fully_allocated: (x) => x.allocationStatus === 'Fully Allocated',
          reversed: (x) => x.voucherStatus === 'Reversed',
        }
        return map[filter.receiptTab]?.(r) ?? true
      }),
    [allRows, filter.receiptTab],
  )

  const kpiItems: EnterpriseKpiItem[] = useMemo(() => {
    const posted = allRows.filter((r) => r.voucherStatus === 'Posted')
    const unalloc = allRows.filter((r) => r.unallocatedAmount > 0 && r.voucherStatus !== 'Reversed')
    return [
      {
        id: 'total',
        label: 'Total receipts',
        value: allRows.length,
        accent: 'blue',
        active: filter.receiptTab === 'all',
        onClick: () => setFilter((f) => ({ ...f, receiptTab: 'all' })),
      },
      {
        id: 'draft',
        label: 'Draft',
        value: tabCount(allRows, 'draft'),
        accent: 'slate',
        active: filter.receiptTab === 'draft',
        onClick: () => setFilter((f) => ({ ...f, receiptTab: 'draft' })),
      },
      {
        id: 'posted',
        label: 'Posted value',
        value: formatCompactCurrency(posted.reduce((s, r) => s + r.receiptAmount, 0)),
        accent: 'green',
        active: filter.receiptTab === 'posted',
        onClick: () => setFilter((f) => ({ ...f, receiptTab: 'posted' })),
      },
      {
        id: 'unalloc',
        label: 'Unallocated',
        value: formatCompactCurrency(unalloc.reduce((s, r) => s + r.unallocatedAmount, 0)),
        accent: 'amber',
        active: filter.receiptTab === 'unallocated',
        onClick: () => setFilter((f) => ({ ...f, receiptTab: 'unallocated' })),
      },
    ]
  }, [allRows, filter.receiptTab])

  const openPost = async (r: CustomerReceipt) => {
    try {
      const preview = await getReceiptPostingPreview(r.id)
      setPostReceipt(r)
      setPostPreview(preview)
    } catch (e) {
      notify.error(e instanceof ReceivablesServiceError ? e.message : 'Preview failed')
    }
  }

  const confirmPost = async () => {
    if (!postReceipt) return
    setBusy(true)
    try {
      await postReceiptDemo(postReceipt.id)
      notify.success('Receipt marked as posted in demo mode. Backend accounting posting is not connected.')
      setPostReceipt(null)
      setPostPreview(null)
      await load()
    } catch (e) {
      notify.error(e instanceof ReceivablesServiceError ? e.message : 'Post failed')
    } finally {
      setBusy(false)
    }
  }

  const confirmReverse = async () => {
    if (!reverseReceipt || !reverseReason.trim()) return
    setBusy(true)
    try {
      await reverseReceiptDemo(reverseReceipt.id, reverseReason.trim())
      notify.success('Receipt reversed in demo mode. No GL reversal was posted.')
      setReverseReceipt(null)
      setReverseReason('')
      await load()
    } catch (e) {
      notify.error(e instanceof ReceivablesServiceError ? e.message : 'Reverse failed')
    } finally {
      setBusy(false)
    }
  }

  const submitDraft = async (r: CustomerReceipt) => {
    setBusy(true)
    try {
      await updateCustomerReceipt(r.id, { voucherStatus: 'Pending Approval' })
      notify.success(`${r.receiptNumber} submitted for approval`)
      await load()
    } catch (e) {
      notify.error(e instanceof ReceivablesServiceError ? e.message : 'Submit failed')
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
        title="Customer Receipts"
        breadcrumbs={[
          { label: 'Accounting', to: '/accounting' },
          { label: 'Receivables', to: '/accounting/receivables' },
          { label: 'Receipts' },
        ]}
        autoBreadcrumbs={false}
        favoritePath="/accounting/receivables/receipts"
      >
        <EmptyState icon={ShieldOff} title="Access denied" description="Missing accounting.receivables.view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Customer Receipts"
      description="Record customer payments, allocate to open invoices, and post receipt vouchers — demo UI only."
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Receivables', to: '/accounting/receivables' },
        { label: 'Receipts' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/receivables/receipts"
      kpiStrip={loadState === 'ready' || loadState === 'empty' ? kpiItems : undefined}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateReceipt
              ? {
                  id: 'new',
                  label: 'Record Receipt',
                  icon: Plus,
                  onClick: () => navigate('/accounting/receivables/receipts/new'),
                }
              : undefined
          }
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      }
    >
      <ReceivablesWorkspaceTabs active="receipts" />
      <div className="mb-3 mt-3 flex flex-col gap-3">
        <SearchInput
          value={filter.search}
          onChange={(v) => setFilter((f) => ({ ...f, search: v }))}
          placeholder="Search receipt no, customer, reference…"
        />
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Receipt status tabs">
          {TABS.map((tab) => {
            const count = tabCount(allRows, tab.id)
            const selected = filter.receiptTab === tab.id
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
                onClick={() => setFilter((f) => ({ ...f, receiptTab: tab.id }))}
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
            <EmptyState icon={FileText} title="Could not load receipts" description={errorMsg} />
          </div>
        ) : null}
        {loadState === 'empty' ? (
          <div className="p-6">
            <EmptyState
              icon={HandCoins}
              title="No receipts match"
              description="Record a customer receipt to allocate against open invoices."
              action={
                perms.canCreateReceipt ? (
                  <button
                    type="button"
                    className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
                    onClick={() => navigate('/accounting/receivables/receipts/new')}
                  >
                    Record Receipt
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
                  <th className="px-3 py-2 font-semibold">Receipt No</th>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Customer</th>
                  <th className="px-3 py-2 font-semibold">Mode</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                  <th className="px-3 py-2 text-right font-semibold">Unallocated</th>
                  <th className="px-3 py-2 font-semibold">Allocation</th>
                  <th className="px-3 py-2 font-semibold">Voucher</th>
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-erp-border/80 hover:bg-erp-surface-alt/40">
                    <td className="px-3 py-2">
                      <TableLink to={`/accounting/receivables/receipts/${r.id}`}>{r.receiptNumber}</TableLink>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{r.receiptDate}</td>
                    <td className="px-3 py-2">
                      <TableLink to={`/accounting/receivables/customer/${r.customerId}`}>{r.customerName}</TableLink>
                    </td>
                    <td className="px-3 py-2">{r.paymentMode}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.receiptAmount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.unallocatedAmount)}</td>
                    <td className="px-3 py-2">
                      <AllocationStatusBadge status={r.allocationStatus} />
                    </td>
                    <td className="px-3 py-2">
                      <ReceiptStatusBadge status={r.voucherStatus} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                          title="View"
                          onClick={() => navigate(`/accounting/receivables/receipts/${r.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {perms.canEditReceipt && r.voucherStatus === 'Draft' ? (
                          <button
                            type="button"
                            className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                            title="Edit"
                            onClick={() => navigate(`/accounting/receivables/receipts/${r.id}/edit`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : null}
                        {perms.canAllocate && r.unallocatedAmount > 0 && r.voucherStatus !== 'Reversed' ? (
                          <button
                            type="button"
                            className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                            title="Allocate"
                            onClick={() =>
                              navigate(
                                r.voucherStatus === 'Draft'
                                  ? `/accounting/receivables/receipts/${r.id}/edit`
                                  : `/accounting/receivables/receipts/${r.id}`,
                              )
                            }
                          >
                            <HandCoins className="h-4 w-4" />
                          </button>
                        ) : null}
                        {perms.canSubmitReceipt && r.voucherStatus === 'Draft' ? (
                          <button
                            type="button"
                            className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                            title="Submit"
                            onClick={() => void submitDraft(r)}
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        ) : null}
                        {perms.canPostReceipt &&
                        (r.voucherStatus === 'Draft' || r.voucherStatus === 'Pending Approval' || r.voucherStatus === 'Approved') ? (
                          <button
                            type="button"
                            className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                            title="Post Demo"
                            onClick={() => void openPost(r)}
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
                        {perms.canReverseReceipt && r.voucherStatus === 'Posted' ? (
                          <button
                            type="button"
                            className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                            title="Reverse"
                            onClick={() => setReverseReceipt(r)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        ) : null}
                        {r.relatedVoucherId ? (
                          <button
                            type="button"
                            className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                            title="Open Voucher"
                            onClick={() => navigate(`/accounting/ledger-entries/voucher/${r.relatedVoucherId}`)}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt"
                          title="Open Customer"
                          onClick={() => navigate(`/accounting/receivables/customer/${r.customerId}`)}
                        >
                          <User className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </EnterpriseRegisterTableShell>

      <ReceiptPostingPreviewModal
        open={Boolean(postReceipt && postPreview)}
        preview={postPreview}
        onClose={() => {
          setPostReceipt(null)
          setPostPreview(null)
        }}
        onConfirmPost={() => void confirmPost()}
        busy={busy}
      />

      <ReceivableConfirmModal
        open={Boolean(reverseReceipt)}
        onClose={() => {
          setReverseReceipt(null)
          setReverseReason('')
        }}
        title="Reverse receipt (demo)"
        description={`Reverse ${reverseReceipt?.receiptNumber}? No GL reversal will be posted.`}
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
      </ReceivableConfirmModal>
    </OperationalPageShell>
  )
}
