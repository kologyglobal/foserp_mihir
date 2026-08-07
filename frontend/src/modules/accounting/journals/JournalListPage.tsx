import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, Plus, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Input, Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { listJournals, postJournal } from '@/services/bridges/journalApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { Journal, JournalStatus } from '@/types/journals'
import { useFinancePermissions } from '@/utils/permissions/finance'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import { JournalsWorkspaceShell } from './JournalsWorkspaceShell'

const STATUS_OPTIONS: Array<{ value: '' | JournalStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'APPROVED', label: 'Approved (Ready to Post)' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'SENT_BACK', label: 'Sent back' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

function statusTone(status: JournalStatus): 'neutral' | 'warning' | 'success' | 'info' | 'critical' {
  switch (status) {
    case 'DRAFT':
      return 'neutral'
    case 'PENDING_APPROVAL':
    case 'SENT_BACK':
      return 'warning'
    case 'APPROVED':
      return 'success'
    case 'POSTED':
      return 'info'
    case 'CANCELLED':
      return 'critical'
    default:
      return 'neutral'
  }
}

function statusLabel(status: JournalStatus) {
  if (status === 'APPROVED') return 'Ready to Post'
  if (status === 'POSTED') return 'Posted'
  return status.replace(/_/g, ' ')
}

export function JournalListPage() {
  const navigate = useNavigate()
  const perms = useFinancePermissions()
  const [rows, setRows] = useState<Journal[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'' | JournalStatus>('')
  const [search, setSearch] = useState('')
  const [postingId, setPostingId] = useState<string | null>(null)

  const handleQuickPost = async (journalId: string) => {
    if (!perms.canPostVoucher) return
    setPostingId(journalId)
    try {
      await postJournal(journalId)
      notify.success('Journal posted')
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Post failed')
    } finally {
      setPostingId(null)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const legalEntityId = resolveLegalEntityId()
      const data = await listJournals({
        legalEntityId,
        ...(status ? { status } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      })
      setRows(data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load journals')
    } finally {
      setLoading(false)
    }
  }, [search, status])

  useEffect(() => {
    if (perms.canViewVouchers) void load()
  }, [load, perms.canViewVouchers])

  const summary = useMemo(() => {
    return {
      draft: rows.filter((r) => r.status === 'DRAFT').length,
      pending: rows.filter((r) => r.status === 'PENDING_APPROVAL').length,
      approved: rows.filter((r) => r.status === 'APPROVED').length,
      posted: rows.filter((r) => r.status === 'POSTED').length,
    }
  }, [rows])

  if (!perms.canViewVouchers) {
    return (
      <JournalsWorkspaceShell title="Journals">
        <div className="p-6">
          <p className="text-[13px] text-erp-muted">You do not have permission to view journals.</p>
        </div>
      </JournalsWorkspaceShell>
    )
  }

  return (
    <JournalsWorkspaceShell
      title="Journals"
      actions={
        perms.canCreateVoucher ? (
          <ErpButton variant="primary" icon={Plus} onClick={() => navigate('/accounting/entries/journals/new')}>
            Create Journal
          </ErpButton>
        ) : null
      }
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      <div className="border-b border-erp-border bg-erp-surface/40 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="h-9 min-w-[160px] text-[12px]"
            value={status}
            onChange={(e) => setStatus(e.target.value as '' | JournalStatus)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input
            className="h-9 min-w-[220px] flex-1 text-[12px]"
            placeholder="Search reference or narration"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-erp-border px-3 py-2.5">
        {(
          [
            { label: 'Draft', value: summary.draft, filter: 'DRAFT' as const, tone: 'border-slate-200 bg-slate-50' },
            {
              label: 'Pending',
              value: summary.pending,
              filter: 'PENDING_APPROVAL' as const,
              tone: 'border-amber-200 bg-amber-50',
            },
            {
              label: 'Ready to post',
              value: summary.approved,
              filter: 'APPROVED' as const,
              tone: 'border-emerald-200 bg-emerald-50',
            },
            { label: 'Posted', value: summary.posted, filter: 'POSTED' as const, tone: 'border-sky-200 bg-sky-50' },
          ] as const
        ).map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => setStatus((prev) => (prev === chip.filter ? '' : chip.filter))}
            className={cn(
              'rounded-md border px-3 py-1.5 text-left text-[12px] transition-colors hover:border-erp-primary/40',
              chip.tone,
              status === chip.filter && 'ring-2 ring-erp-primary/30',
            )}
          >
            <span className="font-medium text-erp-text">{chip.label}</span>
            <span className="ml-2 tabular-nums font-semibold text-erp-text">{chip.value}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-3">
          <LoadingState variant="table" rows={8} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No journals found"
          description={
            perms.canCreateVoucher
              ? 'Create a manual journal to record adjustments, accruals, or corrections.'
              : 'No journals match the current filters.'
          }
          action={
            perms.canCreateVoucher ? (
              <ErpButton variant="primary" icon={Plus} onClick={() => navigate('/accounting/entries/journals/new')}>
                Create Journal
              </ErpButton>
            ) : undefined
          }
        />
      ) : (
        <div className="erp-table-wrap overflow-x-auto">
          <table className="erp-table w-full min-w-[880px] text-left text-[12px]">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Posting date</th>
                <th>Status</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
                <th>Narration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link
                      className="font-semibold text-erp-primary hover:underline"
                      to={`/accounting/entries/journals/${row.id}`}
                    >
                      {row.referenceNumber ?? row.draftReference ?? row.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap tabular-nums">{row.postingDate}</td>
                  <td>
                    <DynamicsStatusChip label={statusLabel(row.status)} tone={statusTone(row.status)} />
                  </td>
                  <td className="text-right tabular-nums">{row.totalDebit}</td>
                  <td className="text-right tabular-nums">{row.totalCredit}</td>
                  <td className="max-w-[280px] truncate text-erp-muted">{row.narration ?? '-'}</td>
                  <td>
                    {row.status === 'APPROVED' && !row.voucherNumber && perms.canPostVoucher ? (
                      <button
                        type="button"
                        className="font-semibold text-erp-primary hover:underline disabled:opacity-50"
                        disabled={postingId === row.id}
                        onClick={() => void handleQuickPost(row.id)}
                      >
                        {postingId === row.id ? 'Posting…' : 'Post'}
                      </button>
                    ) : (
                      <span className="text-erp-muted">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </JournalsWorkspaceShell>
  )
}
