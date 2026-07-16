import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, Download, Printer, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  LedgerAccountFactBox,
  LedgerAuditDrawer,
  LedgerEntriesTable,
  LedgerEntryDetailsDrawer,
  type LedgerRowAction,
  type LedgerSortKey,
} from '@/components/accounting/ledger'
import {
  DEFAULT_LEDGER_FILTER,
  exportLedgerEntries,
  getAccountLedger,
  getAccountLedgerSummary,
  getLedgerAuditTrail,
  getLedgerEntryById,
  getPrintPreview,
} from '@/services/accounting/ledgerEntriesService'
import { getAccountById } from '@/services/accounting/chartOfAccountsService'
import type { AccountLedgerSummary, LedgerEntry, LedgerEntryAuditEvent, LedgerEntryFilter } from '@/types/ledgerEntries'
import type { ChartOfAccount } from '@/types/chartOfAccounts'
import { useLedgerPermissions } from '@/utils/permissions/ledgerEntries'
import {
  applyDateRangeToFilter,
  buildLedgerPrintHtml,
  DATE_QUICK_OPTIONS,
  downloadTextFile,
  openPrintWindow,
  periodLabelFromFilter,
  sortLedgerRows,
} from '@/utils/accounting/ledgerWorkspace'
import { formatBalanceWithSide } from '@/utils/accounting/indianFinancialYear'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDateTime } from '@/utils/dates/format'
import { MQ_MOBILE, useMediaQuery } from '@/hooks/useMediaQuery'
import { notify } from '@/store/toastStore'
import { getSessionUser } from '@/utils/permissions'

export function AccountLedgerPage() {
  const { accountId = '' } = useParams()
  const navigate = useNavigate()
  const perms = useLedgerPermissions()
  const isMobile = useMediaQuery(MQ_MOBILE)

  const [account, setAccount] = useState<ChartOfAccount | null>(null)
  const [rows, setRows] = useState<LedgerEntry[]>([])
  const [summary, setSummary] = useState<AccountLedgerSummary | null>(null)
  const [filter, setFilter] = useState<LedgerEntryFilter>(() =>
    applyDateRangeToFilter({ ...DEFAULT_LEDGER_FILTER, accountId, viewTab: 'account' }),
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<LedgerSortKey>('postingDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const [detail, setDetail] = useState<LedgerEntry | null>(null)
  const [audit, setAudit] = useState<LedgerEntryAuditEvent[]>([])
  const [auditOpen, setAuditOpen] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [factBoxOpen, setFactBoxOpen] = useState(!isMobile)
  const pageSize = 25

  useEffect(() => {
    setFilter((f) => applyDateRangeToFilter({ ...f, accountId, viewTab: 'account' }))
  }, [accountId])

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoading(true)
    setError(null)
    try {
      const [coa, list, summ] = await Promise.all([
        getAccountById(accountId),
        getAccountLedger(accountId, filter),
        getAccountLedgerSummary(accountId, filter),
      ])
      if (signal?.cancelled) return
      setAccount(coa)
      setRows(list)
      setSummary(summ)
      setLoading(false)
      if (!coa && list.length === 0) setError('Account not found')
    } catch (err) {
      if (signal?.cancelled) return
      setError(err instanceof Error ? err.message : 'Failed to load account ledger')
      setLoading(false)
    }
  }, [accountId, filter])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load, refresh])

  const sorted = useMemo(() => sortLedgerRows(rows, sortKey, sortDir), [rows, sortKey, sortDir])
  const paged = sorted.slice(page * pageSize, page * pageSize + pageSize)
  const periodLabel = periodLabelFromFilter(filter)

  const handleAction = async (action: LedgerRowAction, entry: LedgerEntry) => {
    if (action === 'view') {
      setDetail(entry)
      if (perms.canViewAudit) setAudit(await getLedgerAuditTrail(entry.id))
      return
    }
    if (action === 'openVoucher' && entry.voucherId) {
      navigate(`/accounting/ledger-entries/voucher/${entry.voucherId}`)
    }
    if (action === 'openAccount') navigate(`/accounting/chart-of-accounts/${entry.account.accountId}`)
    if (action === 'openParty' && entry.party) {
      navigate(`/accounting/ledger-entries/party/${entry.party.partyType.toLowerCase()}/${entry.party.partyId}`)
    }
    if (action === 'viewReversal') {
      const id = entry.reversal?.reversalEntryId || entry.reversal?.originalEntryId
      if (id) {
        const linked = await getLedgerEntryById(id)
        if (linked) {
          setDetail(linked)
          if (perms.canViewAudit) setAudit(await getLedgerAuditTrail(linked.id))
        }
      }
    }
    if (action === 'viewAudit') {
      setDetail(entry)
      setAudit(await getLedgerAuditTrail(entry.id))
      setAuditOpen(true)
    }
  }

  if (!perms.canViewAccount) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Account Ledger" breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Ledger Entries', to: '/accounting/ledger-entries' }, { label: 'Account Ledger' }]} autoBreadcrumbs={false}>
        <EmptyState icon={BookOpen} title="Access denied" description="You cannot view account ledgers." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={account ? `${account.code} — ${account.name}` : 'Account Ledger'}
      description={periodLabel}
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Ledger Entries', to: '/accounting/ledger-entries' },
        { label: 'Account Ledger' },
      ]}
      autoBreadcrumbs={false}
      favoritePath={`/accounting/ledger-entries/account/${accountId}`}
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'back', label: 'Back', icon: ArrowLeft, onClick: () => navigate('/accounting/ledger-entries') },
            {
              id: 'card',
              label: 'Open Account Card',
              icon: BookOpen,
              onClick: () => navigate(`/accounting/chart-of-accounts/${accountId}`),
            },
            {
              id: 'export',
              label: 'Export',
              icon: Download,
              disabled: !perms.canExport,
              onClick: async () => {
                const r = await exportLedgerEntries({ scope: 'account', format: 'csv', filter })
                downloadTextFile(r.fileName, r.content, r.mime)
                notify.success(r.message)
              },
            },
            {
              id: 'print',
              label: 'Print',
              icon: Printer,
              disabled: !perms.canPrint,
              onClick: async () => {
                const preview = await getPrintPreview('Account Ledger', filter)
                openPrintWindow(
                  'Account Ledger',
                  buildLedgerPrintHtml({
                    companyName: preview.companyName,
                    reportName: 'Account Ledger',
                    periodLabel,
                    filtersLabel: account ? `${account.code} ${account.name}` : accountId,
                    generatedBy: getSessionUser().name,
                    generatedAt: formatDateTime(preview.generatedAt),
                    rows: preview.rows,
                    formatCurrency,
                  }),
                )
              },
            },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefresh((n) => n + 1) },
          ]}
          moreActions={[
            {
              id: 'factbox',
              label: factBoxOpen ? 'Hide FactBox' : 'Show FactBox',
              onClick: () => setFactBoxOpen((o) => !o),
              hidden: isMobile,
            },
          ]}
        />
      )}
    >
      {account ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-erp-border bg-white px-4 py-3 text-[12px]">
          <span className="font-mono font-semibold">{account.code}</span>
          <span>{account.name}</span>
          <span className="text-erp-muted">{account.category}</span>
          <span className="text-erp-muted">{account.accountType}</span>
          <span className="text-erp-muted">Normal: {account.normalBalance}</span>
          <span className={account.active ? 'rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800' : 'rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600'}>
            {account.active ? 'Active' : 'Inactive'}
          </span>
        </div>
      ) : null}

      {summary && perms.canViewBalance ? (
        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              ['Opening Balance', summary.openingBalance, summary.openingSide],
              ['Total Debit', summary.totalDebit, 'Dr' as const],
              ['Total Credit', summary.totalCredit, 'Cr' as const],
              ['Net Movement', summary.netMovement, summary.netMovement >= 0 ? ('Dr' as const) : ('Cr' as const)],
              ['Closing Balance', summary.closingBalance, summary.closingSide],
            ] as const
          ).map(([label, value, side]) => (
            <div key={label} className="rounded-lg border border-erp-border bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">{label}</p>
              <p className="mt-0.5 text-[13px] font-semibold tabular-nums">
                {label.includes('Debit') || label.includes('Credit')
                  ? formatCurrency(Math.abs(value))
                  : formatBalanceWithSide(value, side, formatCurrency)}
              </p>
              <p className="text-[10px] text-erp-muted">Demo</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mb-2 flex flex-wrap gap-2">
        <select
          className="erp-input h-9 text-[12px]"
          value={filter.dateQuickRange}
          onChange={(e) =>
            setFilter((f) =>
              applyDateRangeToFilter({
                ...f,
                dateQuickRange: e.target.value as LedgerEntryFilter['dateQuickRange'],
              }),
            )
          }
        >
          {DATE_QUICK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className={factBoxOpen && !isMobile ? 'flex min-h-0 gap-0' : undefined}>
        <div className="min-w-0 flex-1">
          {loading ? <LoadingState variant="table" rows={8} /> : null}
          {error ? (
            <EmptyState icon={BookOpen} title="Could not load account ledger" description={error} action={<Link to="/accounting/ledger-entries" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]">Back to Ledger Entries</Link>} />
          ) : null}
          {!loading && !error ? (
            <LedgerEntriesTable
              rows={paged}
              selectedIds={new Set()}
              onToggleSelect={() => undefined}
              onSelectAll={() => undefined}
              onOpenEntry={(e) => void handleAction('view', e)}
              onAction={(a, e) => void handleAction(a, e)}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={(k) => {
                if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                else {
                  setSortKey(k)
                  setSortDir('asc')
                }
              }}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              total={sorted.length}
              visibleOptionalColumns={['referenceNumber', 'reversalVoucher']}
              showRunningBalance
              canViewBalance={perms.canViewBalance}
              isMobile={isMobile}
              loading={false}
            />
          ) : null}
        </div>
        {factBoxOpen && !isMobile ? (
          <LedgerAccountFactBox
            account={account}
            summary={summary}
            canViewBalance={perms.canViewBalance}
            collapsed={false}
            onToggleCollapse={() => setFactBoxOpen(false)}
          />
        ) : null}
      </div>

      <LedgerEntryDetailsDrawer
        open={Boolean(detail) && !auditOpen}
        onClose={() => setDetail(null)}
        entry={detail}
        auditEvents={audit}
        onOpenVoucher={() => detail?.voucherId && navigate(`/accounting/ledger-entries/voucher/${detail.voucherId}`)}
        onOpenAccount={() => detail && navigate(`/accounting/chart-of-accounts/${detail.account.accountId}`)}
        onOpenSource={() => undefined}
        onPrint={() => undefined}
        onExport={() => undefined}
        onViewAudit={() => setAuditOpen(true)}
      />
      <LedgerAuditDrawer open={auditOpen} onClose={() => setAuditOpen(false)} events={audit} entryNumber={detail?.entryNumber ?? ''} />
    </OperationalPageShell>
  )
}
