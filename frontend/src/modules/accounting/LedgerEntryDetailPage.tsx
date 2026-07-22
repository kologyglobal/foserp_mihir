import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ScrollText } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { LedgerEntryDetailsDrawer, LedgerAuditDrawer } from '@/components/accounting/ledger'
import { getLedgerAuditTrail, getLedgerEntryById } from '@/services/accounting/ledgerEntriesService'
import type { LedgerEntry, LedgerEntryAuditEvent } from '@/types/ledgerEntries'
import { useLedgerPermissions } from '@/utils/permissions/ledgerEntries'

/** Route `/accounting/ledger-entries/:entryId` — opens entry details drawer on a lightweight shell. */
export function LedgerEntryDetailPage() {
  const { entryId = '' } = useParams()
  const navigate = useNavigate()
  const perms = useLedgerPermissions()
  const [entry, setEntry] = useState<LedgerEntry | null>(null)
  const [audit, setAudit] = useState<LedgerEntryAuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [auditOpen, setAuditOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const found = await getLedgerEntryById(entryId)
        if (cancelled) return
        setEntry(found)
        if (found && perms.canViewAudit) {
          setAudit(await getLedgerAuditTrail(found.id))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [entryId, perms.canViewAudit])

  if (!perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Ledger Entry" breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Ledger Entries', to: '/accounting/ledger-entries' }, { label: 'Entry' }]} autoBreadcrumbs={false}>
        <EmptyState icon={ScrollText} title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={entry?.entryNumber ?? 'Ledger Entry'}
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Ledger Entries', to: '/accounting/ledger-entries' },
        { label: entry?.entryNumber ?? 'Entry' },
      ]}
      autoBreadcrumbs={false}
      commandBar={(
        <button
          type="button"
          className="erp-btn erp-btn-ghost inline-flex h-9 items-center gap-1.5 px-3 text-[13px]"
          onClick={() => navigate('/accounting/ledger-entries')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Ledger Entries
        </button>
      )}
    >
      {loading ? <LoadingState variant="form" rows={6} /> : null}
      {!loading && !entry ? (
        <EmptyState
          icon={ScrollText}
          title="Entry not found"
          description="This ledger entry id is not in the demo store."
          action={<Link to="/accounting/ledger-entries" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]">Back</Link>}
        />
      ) : null}
      <LedgerEntryDetailsDrawer
        open={Boolean(entry) && !auditOpen}
        onClose={() => navigate('/accounting/ledger-entries')}
        entry={entry}
        auditEvents={audit}
        onOpenVoucher={() =>
          entry?.voucherId
            ? navigate(`/accounting/ledger-entries/voucher/${entry.voucherId}`)
            : navigate('/accounting/entries/journals')
        }
        onOpenAccount={() =>
          entry && navigate(`/accounting/ledger-entries/account/${entry.account.accountId}`)
        }
        onOpenSource={() => undefined}
        onPrint={() => undefined}
        onExport={() => undefined}
        onViewAudit={() => setAuditOpen(true)}
      />
      <LedgerAuditDrawer
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        events={audit}
        entryNumber={entry?.entryNumber ?? ''}
      />
    </OperationalPageShell>
  )
}
