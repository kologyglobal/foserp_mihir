import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Filter, FileText, Plus, RefreshCw, ShieldOff, Upload } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import {
  VoucherApprovalDrawer,
  VoucherFilterDrawer,
  VoucherImportDialog,
  VoucherPostingPreviewModal,
  VoucherRegisterTable,
  VoucherReversalModal,
  type VoucherListAction,
} from '@/components/accounting/vouchers'
import {
  approveVoucher,
  exportVouchers,
  getPartyOptions,
  getVoucherKpis,
  getVouchers,
  getVoucherTabCounts,
  postVoucher,
  rejectVoucher,
  reverseVoucher,
  sendBackVoucher,
  submitVoucher,
  VouchersServiceError,
  DEFAULT_VOUCHER_FILTER,
} from '@/services/accounting/vouchersService'
import type {
  AccountingVoucher,
  VoucherFilter,
  VoucherKpiSummary,
  VoucherListTab,
  VoucherPartyOption,
} from '@/types/vouchers'
import { useVoucherPermissions } from '@/utils/permissions/vouchers'
import { formatCompactCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

const TABS: { id: VoucherListTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'pending_approval', label: 'Pending Approval' },
  { id: 'approved', label: 'Approved' },
  { id: 'posted', label: 'Posted' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'sent_back', label: 'Sent Back' },
  { id: 'reversed', label: 'Reversed' },
  { id: 'cancelled', label: 'Cancelled' },
]

function downloadBlob(fileName: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export function VouchersRegisterPage() {
  const navigate = useNavigate()
  const perms = useVoucherPermissions()
  const [filter, setFilter] = useState<VoucherFilter>({ ...DEFAULT_VOUCHER_FILTER })
  const [draftFilter, setDraftFilter] = useState<VoucherFilter>({ ...DEFAULT_VOUCHER_FILTER })
  const [rows, setRows] = useState<AccountingVoucher[]>([])
  const [kpis, setKpis] = useState<VoucherKpiSummary | null>(null)
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({})
  const [parties, setParties] = useState<VoucherPartyOption[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [actionVoucher, setActionVoucher] = useState<AccountingVoucher | null>(null)
  const [approvalOpen, setApprovalOpen] = useState(false)
  const [postOpen, setPostOpen] = useState(false)
  const [reverseOpen, setReverseOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!perms.canView) {
      setLoadState('error')
      setErrorMsg('You do not have permission to view vouchers.')
      return
    }
    setLoadState('loading')
    try {
      const [list, summary, counts, partyList] = await Promise.all([
        getVouchers(filter),
        getVoucherKpis(),
        getVoucherTabCounts(),
        getPartyOptions(),
      ])
      setRows(list)
      setKpis(summary)
      setTabCounts(counts)
      setParties(partyList)
      setLoadState(list.length ? 'ready' : 'empty')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load vouchers')
      setLoadState('error')
    }
  }, [filter, perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  const kpiStrip: EnterpriseKpiItem[] = useMemo(() => {
    if (!kpis) return []
    return [
      {
        id: 'total',
        label: 'Total vouchers',
        value: kpis.totalVouchers,
        accent: 'blue',
        active: filter.listTab === 'all',
        onClick: () => setFilter((f) => ({ ...f, listTab: 'all' })),
      },
      {
        id: 'draft',
        label: 'Draft',
        value: kpis.draftCount,
        accent: 'slate',
        active: filter.listTab === 'draft',
        onClick: () => setFilter((f) => ({ ...f, listTab: 'draft' })),
      },
      {
        id: 'pending',
        label: 'Pending approval',
        value: kpis.pendingApprovalCount,
        accent: 'amber',
        active: filter.listTab === 'pending_approval',
        onClick: () => setFilter((f) => ({ ...f, listTab: 'pending_approval' })),
      },
      {
        id: 'posted',
        label: 'Posted',
        value: kpis.postedCount,
        accent: 'green',
        active: filter.listTab === 'posted',
        onClick: () => setFilter((f) => ({ ...f, listTab: 'posted' })),
      },
      {
        id: 'postedValue',
        label: 'Posted value (month)',
        value: formatCompactCurrency(kpis.postedValueThisMonth),
        accent: 'blue',
      },
      {
        id: 'unbal',
        label: 'Unbalanced drafts',
        value: kpis.unbalancedCount,
        accent: 'amber',
        active: filter.unbalancedOnly,
        onClick: () => setFilter((f) => ({ ...f, unbalancedOnly: !f.unbalancedOnly, listTab: 'draft' })),
      },
    ]
  }, [kpis, filter.listTab, filter.unbalancedOnly])

  const onAction = async (action: VoucherListAction, voucher: AccountingVoucher) => {
    if (action === 'view') {
      navigate(`/accounting/vouchers/${voucher.id}`)
      return
    }
    if (action === 'edit') {
      navigate(`/accounting/vouchers/${voucher.id}/edit`)
      return
    }
    if (action === 'submit') {
      setBusy(true)
      try {
        await submitVoucher(voucher.id)
        notify.success(`${voucher.voucherNumber} submitted for approval`)
        await load()
      } catch (e) {
        notify.error(e instanceof VouchersServiceError ? e.message : 'Submit failed')
      } finally {
        setBusy(false)
      }
      return
    }
    if (action === 'more') {
      setActionVoucher(voucher)
      if (voucher.status === 'pending_approval') setApprovalOpen(true)
      else if (voucher.status === 'approved') setPostOpen(true)
      else if (voucher.status === 'posted') setReverseOpen(true)
      else navigate(`/accounting/vouchers/${voucher.id}`)
    }
  }

  const doExport = async () => {
    if (!perms.canExport) return
    try {
      const file = await exportVouchers('current_view', 'csv', filter)
      downloadBlob(file.fileName, file.content, file.mime)
      notify.success('Export downloaded')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Export failed')
    }
  }

  if (!perms.canView) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Vouchers"
        description="You do not have access to Accounting Vouchers."
        breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Vouchers' }]}
        autoBreadcrumbs={false}
        favoritePath="/accounting/vouchers"
      >
        <EmptyState icon={ShieldOff} title="Access denied" description="Missing accounting.voucher.view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Vouchers"
      description="Journal, payment, receipt, contra, debit/credit notes and opening balances — demo UI only (no GL posting)."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Vouchers' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/vouchers"
      kpiStrip={loadState === 'ready' || loadState === 'empty' ? kpiStrip : undefined}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreate
              ? { id: 'new', label: 'New Voucher', icon: Plus, onClick: () => navigate('/accounting/vouchers/new') }
              : undefined
          }
          secondaryActions={[
            ...(perms.canImport
              ? [{ id: 'import', label: 'Import', icon: Upload, onClick: () => setImportOpen(true) }]
              : []),
            ...(perms.canExport
              ? [{ id: 'export', label: 'Export', icon: Download, onClick: () => void doExport() }]
              : []),
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            {
              id: 'filters',
              label: 'Filters',
              icon: Filter,
              onClick: () => {
                setDraftFilter(filter)
                setFilterOpen(true)
              },
            },
          ]}
        />
      }
    >
      <div className="mb-3 flex flex-col gap-3">
        <SearchInput
          value={filter.search}
          onChange={(v) => setFilter((f) => ({ ...f, search: v }))}
          placeholder="Search voucher no, party, narration…"
        />
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Voucher status tabs">
          {TABS.map((tab) => {
            const count = tab.id === 'all' ? (tabCounts.all ?? 0) : (tabCounts[tab.id] ?? 0)
            const selected = filter.listTab === tab.id
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
                onClick={() => setFilter((f) => ({ ...f, listTab: tab.id }))}
              >
                {tab.label}
                <span className="tabular-nums text-[11px] opacity-80">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      <EnterpriseRegisterTableShell>
        {loadState === 'loading' ? <div className="p-6"><LoadingState variant="table" rows={8} /></div> : null}
        {loadState === 'error' ? (
          <div className="p-6">
            <EmptyState icon={FileText} title="Could not load vouchers" description={errorMsg} />
          </div>
        ) : null}
        {loadState === 'empty' ? (
          <div className="p-6">
            <EmptyState
              icon={FileText}
              title="No vouchers match"
              description="Create a journal, payment, or receipt voucher to get started."
              action={
                perms.canCreate ? (
                  <button
                    type="button"
                    className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
                    onClick={() => navigate('/accounting/vouchers/new')}
                  >
                    New Voucher
                  </button>
                ) : null
              }
            />
          </div>
        ) : null}
        {loadState === 'ready' ? (
          <VoucherRegisterTable
            rows={rows}
            onAction={(a, v) => void onAction(a, v)}
            canEdit={perms.canEdit}
            canSubmit={perms.canSubmit}
          />
        ) : null}
      </EnterpriseRegisterTableShell>

      <VoucherFilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={draftFilter}
        onChange={setDraftFilter}
        parties={parties}
        onApply={() => {
          setFilter({ ...draftFilter, search: filter.search, listTab: filter.listTab })
          setFilterOpen(false)
        }}
        onReset={() =>
          setDraftFilter({ ...DEFAULT_VOUCHER_FILTER, search: filter.search, listTab: filter.listTab })
        }
      />
      <VoucherImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImported={() => void load()} />
      <VoucherApprovalDrawer
        open={approvalOpen}
        onClose={() => setApprovalOpen(false)}
        voucher={actionVoucher}
        canApprove={perms.canApprove}
        canReject={perms.canReject}
        canSendBack={perms.canSendBack}
        busy={busy}
        onApprove={async (comment) => {
          if (!actionVoucher) return
          setBusy(true)
          try {
            await approveVoucher(actionVoucher.id, comment)
            notify.success('Voucher approved')
            setApprovalOpen(false)
            await load()
          } catch (e) {
            notify.error(e instanceof VouchersServiceError ? e.message : 'Approve failed')
          } finally {
            setBusy(false)
          }
        }}
        onReject={async (reason) => {
          if (!actionVoucher) return
          setBusy(true)
          try {
            await rejectVoucher(actionVoucher.id, reason)
            notify.success('Voucher rejected')
            setApprovalOpen(false)
            await load()
          } catch (e) {
            notify.error(e instanceof VouchersServiceError ? e.message : 'Reject failed')
          } finally {
            setBusy(false)
          }
        }}
        onSendBack={async (reason) => {
          if (!actionVoucher) return
          setBusy(true)
          try {
            await sendBackVoucher(actionVoucher.id, reason)
            notify.success('Voucher sent back')
            setApprovalOpen(false)
            await load()
          } catch (e) {
            notify.error(e instanceof VouchersServiceError ? e.message : 'Send back failed')
          } finally {
            setBusy(false)
          }
        }}
      />
      <VoucherPostingPreviewModal
        open={postOpen}
        voucher={actionVoucher}
        busy={busy}
        onClose={() => setPostOpen(false)}
        onConfirmPost={async () => {
          if (!actionVoucher || !perms.canPost) return
          setBusy(true)
          try {
            await postVoucher(actionVoucher.id)
            notify.success('Voucher marked Posted (demo) — no ledger entries were created.')
            setPostOpen(false)
            await load()
          } catch (e) {
            notify.error(e instanceof VouchersServiceError ? e.message : 'Post failed')
          } finally {
            setBusy(false)
          }
        }}
      />
      <VoucherReversalModal
        open={reverseOpen}
        voucher={actionVoucher}
        busy={busy}
        onClose={() => setReverseOpen(false)}
        onConfirm={async (reason) => {
          if (!actionVoucher || !perms.canReverse) return
          setBusy(true)
          try {
            const rev = await reverseVoucher(actionVoucher.id, reason)
            notify.success(`Reversal ${rev.voucherNumber} created (demo)`)
            setReverseOpen(false)
            await load()
          } catch (e) {
            notify.error(e instanceof VouchersServiceError ? e.message : 'Reverse failed')
          } finally {
            setBusy(false)
          }
        }}
      />
    </OperationalPageShell>
  )
}
