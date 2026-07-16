import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Printer, RefreshCw, Users } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  LedgerEntriesTable,
  LedgerEntryDetailsDrawer,
  type LedgerRowAction,
  type LedgerSortKey,
} from '@/components/accounting/ledger'
import {
  DEFAULT_LEDGER_FILTER,
  exportLedgerEntries,
  getLedgerLookups,
  getPartyLedger,
  getPartyLedgerSummary,
} from '@/services/accounting/ledgerEntriesService'
import type { LedgerEntry, LedgerEntryFilter, LedgerPartyType, PartyLedgerSummary } from '@/types/ledgerEntries'
import { useLedgerPermissions } from '@/utils/permissions/ledgerEntries'
import {
  applyDateRangeToFilter,
  DATE_QUICK_OPTIONS,
  downloadTextFile,
  periodLabelFromFilter,
  sortLedgerRows,
} from '@/utils/accounting/ledgerWorkspace'
import { formatBalanceWithSide } from '@/utils/accounting/indianFinancialYear'
import { formatCurrency } from '@/utils/formatters/currency'
import { MQ_MOBILE, useMediaQuery } from '@/hooks/useMediaQuery'
import { notify } from '@/store/toastStore'

function normalizePartyType(raw: string): LedgerPartyType {
  const t = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
  if (t === 'Customer' || t === 'Vendor' || t === 'Employee' || t === 'Bank' || t === 'Other') return t
  return 'Other'
}

export function PartyLedgerPage() {
  const { partyType: partyTypeParam = 'customer', partyId = '' } = useParams()
  const partyType = normalizePartyType(partyTypeParam)
  const navigate = useNavigate()
  const perms = useLedgerPermissions()
  const isMobile = useMediaQuery(MQ_MOBILE)

  const [rows, setRows] = useState<LedgerEntry[]>([])
  const [summary, setSummary] = useState<PartyLedgerSummary | null>(null)
  const [partyMeta, setPartyMeta] = useState<{ code: string; name: string; gstNumber: string | null } | null>(null)
  const [filter, setFilter] = useState(() =>
    applyDateRangeToFilter({ ...DEFAULT_LEDGER_FILTER, partyId, partyType, viewTab: 'party' }),
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<LedgerSortKey>('postingDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const [detail, setDetail] = useState<LedgerEntry | null>(null)
  const [refresh, setRefresh] = useState(0)
  const pageSize = 25

  useEffect(() => {
    setFilter((f) => applyDateRangeToFilter({ ...f, partyId, partyType, viewTab: 'party' }))
  }, [partyId, partyType])

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoading(true)
    setError(null)
    try {
      const [list, summ, lookups] = await Promise.all([
        getPartyLedger(partyType, partyId, filter),
        getPartyLedgerSummary(partyType, partyId, filter),
        getLedgerLookups(),
      ])
      if (signal?.cancelled) return
      setRows(list)
      setSummary(summ)
      const meta = lookups.parties.find((p) => p.id === partyId)
      const fromRow = list[0]?.party
      setPartyMeta(
        meta
          ? { code: meta.code, name: meta.name, gstNumber: meta.gstNumber }
          : fromRow
            ? { code: fromRow.partyCode, name: fromRow.partyName, gstNumber: fromRow.gstNumber }
            : null,
      )
      setLoading(false)
      if (list.length === 0 && !meta) setError('Party not found or has no ledger activity')
    } catch (err) {
      if (signal?.cancelled) return
      setError(err instanceof Error ? err.message : 'Failed to load party ledger')
      setLoading(false)
    }
  }, [partyType, partyId, filter])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load, refresh])

  const sorted = useMemo(() => sortLedgerRows(rows, sortKey, sortDir), [rows, sortKey, sortDir])
  const paged = sorted.slice(page * pageSize, page * pageSize + pageSize)

  const handleAction = (action: LedgerRowAction, entry: LedgerEntry) => {
    if (action === 'view') setDetail(entry)
    if (action === 'openVoucher' && entry.voucherId) {
      navigate(`/accounting/ledger-entries/voucher/${entry.voucherId}`)
    }
    if (action === 'openAccount') navigate(`/accounting/ledger-entries/account/${entry.account.accountId}`)
  }

  if (!perms.canViewParty) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Party Ledger" breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Ledger Entries', to: '/accounting/ledger-entries' }, { label: 'Party Ledger' }]} autoBreadcrumbs={false}>
        <EmptyState icon={Users} title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={partyMeta ? `${partyMeta.code} — ${partyMeta.name}` : 'Party Ledger'}
      description={periodLabelFromFilter(filter)}
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Ledger Entries', to: '/accounting/ledger-entries' },
        { label: 'Party Ledger' },
      ]}
      autoBreadcrumbs={false}
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'back', label: 'Back', icon: ArrowLeft, onClick: () => navigate('/accounting/ledger-entries') },
            {
              id: 'export',
              label: 'Export',
              icon: Download,
              disabled: !perms.canExport,
              onClick: async () => {
                const r = await exportLedgerEntries({ scope: 'party', format: 'csv', filter })
                downloadTextFile(r.fileName, r.content, r.mime)
                notify.success(r.message)
              },
            },
            { id: 'print', label: 'Print', icon: Printer, disabled: !perms.canPrint, onClick: () => notify.success('Use Export CSV / Print from main ledger for demo print preview.') },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefresh((n) => n + 1) },
          ]}
        />
      )}
    >
      <div className="mb-3 flex flex-wrap gap-3 rounded-lg border border-erp-border bg-white px-4 py-3 text-[12px]">
        <span className="font-semibold">{partyType}</span>
        {partyMeta ? (
          <>
            <span className="font-mono">{partyMeta.code}</span>
            <span>{partyMeta.name}</span>
            {partyMeta.gstNumber ? <span className="text-erp-muted">GSTIN {partyMeta.gstNumber}</span> : null}
          </>
        ) : null}
      </div>

      {summary && perms.canViewBalance ? (
        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {(
            [
              ['Opening Balance', formatBalanceWithSide(summary.openingBalance, summary.openingSide, formatCurrency)],
              ['Debit Movement', formatCurrency(summary.debitMovement)],
              ['Credit Movement', formatCurrency(summary.creditMovement)],
              ['Closing Balance', formatBalanceWithSide(summary.closingBalance, summary.closingSide, formatCurrency)],
              ['Unapplied Amount', formatCurrency(summary.unappliedAmount)],
              ['Entry Count', String(summary.entryCount)],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-lg border border-erp-border bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">{label}</p>
              <p className="mt-0.5 text-[13px] font-semibold tabular-nums">{value}</p>
              <p className="text-[10px] text-erp-muted">Demo</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mb-2">
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

      {loading ? <LoadingState variant="table" rows={8} /> : null}
      {error && !loading ? (
        <EmptyState icon={Users} title="Party ledger unavailable" description={error} action={<Link to="/accounting/ledger-entries" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]">Back</Link>} />
      ) : null}
      {!loading && !error ? (
        <LedgerEntriesTable
          rows={paged}
          selectedIds={new Set()}
          onToggleSelect={() => undefined}
          onSelectAll={() => undefined}
          onOpenEntry={(e) => handleAction('view', e)}
          onAction={handleAction}
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
          visibleOptionalColumns={['referenceNumber', 'sourceDocument']}
          showRunningBalance
          canViewBalance={perms.canViewBalance}
          isMobile={isMobile}
          loading={false}
        />
      ) : null}

      <LedgerEntryDetailsDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        entry={detail}
        onOpenVoucher={() => detail?.voucherId && navigate(`/accounting/ledger-entries/voucher/${detail.voucherId}`)}
        onOpenAccount={() => detail && navigate(`/accounting/ledger-entries/account/${detail.account.accountId}`)}
        onOpenSource={() => undefined}
        onPrint={() => undefined}
        onExport={() => undefined}
        onViewAudit={() => undefined}
      />
    </OperationalPageShell>
  )
}
