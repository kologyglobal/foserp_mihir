import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ClipboardList, Download, Printer, Shield } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  LedgerAuditDrawer,
  LedgerEntriesTable,
  LedgerEntryDetailsDrawer,
  LedgerStatusBadge,
  LedgerVoucherTypeBadge,
  type LedgerSortKey,
} from '@/components/accounting/ledger'
import {
  DEFAULT_LEDGER_FILTER,
  exportLedgerEntries,
  getLedgerAuditTrail,
  getVoucherEntries,
} from '@/services/accounting/ledgerEntriesService'
import type { LedgerEntry, LedgerEntryAuditEvent } from '@/types/ledgerEntries'
import { useLedgerPermissions } from '@/utils/permissions/ledgerEntries'
import { downloadTextFile, sortLedgerRows } from '@/utils/accounting/ledgerWorkspace'
import { formatCurrency } from '@/utils/formatters/currency'
import { MQ_MOBILE, useMediaQuery } from '@/hooks/useMediaQuery'
import { notify } from '@/store/toastStore'

export function VoucherLedgerPage() {
  const { voucherId = '' } = useParams()
  const navigate = useNavigate()
  const perms = useLedgerPermissions()
  const isMobile = useMediaQuery(MQ_MOBILE)

  const [rows, setRows] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<LedgerSortKey>('entryNumber')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const [detail, setDetail] = useState<LedgerEntry | null>(null)
  const [audit, setAudit] = useState<LedgerEntryAuditEvent[]>([])
  const [auditOpen, setAuditOpen] = useState(false)
  const pageSize = 50

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoading(true)
    setError(null)
    try {
      const list = await getVoucherEntries(voucherId)
      if (signal?.cancelled) return
      setRows(list)
      setLoading(false)
      if (list.length === 0) setError('No ledger lines found for this voucher')
    } catch (err) {
      if (signal?.cancelled) return
      setError(err instanceof Error ? err.message : 'Failed to load voucher entries')
      setLoading(false)
    }
  }, [voucherId])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load])

  const header = rows[0]
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01
  const sorted = useMemo(() => sortLedgerRows(rows, sortKey, sortDir), [rows, sortKey, sortDir])
  const paged = sorted.slice(page * pageSize, page * pageSize + pageSize)

  if (!perms.canViewVoucher) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Voucher Entries" breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Ledger Entries', to: '/accounting/ledger-entries' }, { label: 'Voucher Entries' }]} autoBreadcrumbs={false}>
        <EmptyState icon={ClipboardList} title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={header ? header.voucherNumber : 'Voucher Entries'}
      description={header?.narration}
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Ledger Entries', to: '/accounting/ledger-entries' },
        { label: 'Voucher Entries' },
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
              id: 'voucher',
              label: 'Open Voucher',
              icon: ClipboardList,
              onClick: () => navigate(header?.voucherId ? `/accounting/ledger-entries/voucher/${header.voucherId}` : '/accounting/entries/journals'),
            },
            {
              id: 'export',
              label: 'Export',
              icon: Download,
              disabled: !perms.canExport,
              onClick: async () => {
                const r = await exportLedgerEntries({
                  scope: 'voucher',
                  format: 'csv',
                  filter: { ...DEFAULT_LEDGER_FILTER, voucherNumber: header?.voucherNumber ?? '', viewTab: 'voucher' },
                })
                downloadTextFile(r.fileName, r.content, r.mime)
                notify.success(r.message)
              },
            },
            {
              id: 'audit',
              label: 'Audit Trail',
              icon: Shield,
              hidden: !perms.canViewAudit || !header,
              onClick: async () => {
                if (!header) return
                setDetail(header)
                setAudit(await getLedgerAuditTrail(header.id))
                setAuditOpen(true)
              },
            },
            { id: 'print', label: 'Print', icon: Printer, disabled: !perms.canPrint, onClick: () => notify.success('Use browser print from Export → PDF placeholder or entry print.') },
          ]}
        />
      )}
    >
      {header ? (
        <div className="mb-3 space-y-2 rounded-lg border border-erp-border bg-white px-4 py-3 text-[12px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-semibold">{header.voucherNumber}</span>
            <LedgerVoucherTypeBadge type={header.voucherType} />
            <LedgerStatusBadge status={header.status} />
            <span className="text-erp-muted">Posting {header.postingDate}</span>
            {header.referenceNumber ? <span className="text-erp-muted">Ref {header.referenceNumber}</span> : null}
            <span className={balanced ? 'ml-auto font-semibold text-emerald-700' : 'ml-auto font-semibold text-amber-700'}>
              {balanced ? 'Balanced' : 'Out of Balance'}
            </span>
          </div>
          <div className="flex flex-wrap gap-4 tabular-nums">
            <span>Total Debit {formatCurrency(totalDebit)}</span>
            <span>Total Credit {formatCurrency(totalCredit)}</span>
          </div>
          {header.sourceDocument ? (
            <p className="text-erp-muted">
              Source: {header.sourceDocument.module} · {header.sourceDocument.documentNumber}
              {header.sourceDocument.href ? (
                <Link className="ml-2 text-erp-primary hover:underline" to={header.sourceDocument.href}>
                  Open document
                </Link>
              ) : (
                <span className="ml-2">Related document route is not yet available.</span>
              )}
            </p>
          ) : null}
          {header.reversal ? (
            <p className="text-erp-muted">
              Reversal: {header.reversal.reversalVoucherNumber || header.reversal.originalVoucherNumber || '—'}
            </p>
          ) : null}
        </div>
      ) : null}

      {loading ? <LoadingState variant="table" rows={6} /> : null}
      {error && !loading ? (
        <EmptyState
          icon={ClipboardList}
          title="Voucher ledger not available"
          description={error}
          action={<Link to="/accounting/ledger-entries" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]">Back</Link>}
        />
      ) : null}
      {!loading && rows.length > 0 ? (
        <LedgerEntriesTable
          rows={paged}
          selectedIds={new Set()}
          onToggleSelect={() => undefined}
          onSelectAll={() => undefined}
          onOpenEntry={async (e) => {
            setDetail(e)
            if (perms.canViewAudit) setAudit(await getLedgerAuditTrail(e.id))
          }}
          onAction={async (a, e) => {
            if (a === 'view') {
              setDetail(e)
              if (perms.canViewAudit) setAudit(await getLedgerAuditTrail(e.id))
            }
            if (a === 'openAccount') navigate(`/accounting/ledger-entries/account/${e.account.accountId}`)
            if (a === 'viewAudit') {
              setDetail(e)
              setAudit(await getLedgerAuditTrail(e.id))
              setAuditOpen(true)
            }
          }}
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
          visibleOptionalColumns={['referenceNumber', 'costCentre']}
          showRunningBalance={false}
          canViewBalance={perms.canViewBalance}
          isMobile={isMobile}
          loading={false}
        />
      ) : null}

      <LedgerEntryDetailsDrawer
        open={Boolean(detail) && !auditOpen}
        onClose={() => setDetail(null)}
        entry={detail}
        auditEvents={audit}
        onOpenVoucher={() => navigate(voucherId ? `/accounting/ledger-entries/voucher/${voucherId}` : '/accounting/entries/journals')}
        onOpenAccount={() => detail && navigate(`/accounting/ledger-entries/account/${detail.account.accountId}`)}
        onOpenSource={() => undefined}
        onPrint={() => undefined}
        onExport={() => undefined}
        onViewAudit={() => setAuditOpen(true)}
      />
      <LedgerAuditDrawer open={auditOpen} onClose={() => setAuditOpen(false)} events={audit} entryNumber={detail?.entryNumber ?? ''} />
    </OperationalPageShell>
  )
}