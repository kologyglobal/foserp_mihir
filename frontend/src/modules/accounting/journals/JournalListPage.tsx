import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { listJournals, postJournal } from '@/services/bridges/journalApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { Journal, JournalStatus } from '@/types/journals'
import { useFinancePermissions } from '@/utils/permissions/finance'
import { notify } from '@/store/toastStore'
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

function statusTone(status: JournalStatus) {
  switch (status) {
    case 'DRAFT':
      return 'bg-slate-100 text-slate-700'
    case 'PENDING_APPROVAL':
      return 'bg-amber-100 text-amber-800'
    case 'APPROVED':
      return 'bg-emerald-100 text-emerald-800'
    case 'POSTED':
      return 'bg-sky-100 text-sky-800'
    case 'CANCELLED':
      return 'bg-rose-100 text-rose-800'
    default:
      return 'bg-slate-100 text-slate-700'
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
    }
  }, [rows])

  if (!perms.canViewVouchers) {
    return (
      <JournalsWorkspaceShell title="Journals">
        <p className="text-[13px] text-erp-muted">You do not have permission to view journals.</p>
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
        <div className="flex flex-wrap items-center gap-2">
          <Select className="h-9 min-w-[160px] text-[12px]" value={status} onChange={(e) => setStatus(e.target.value as '' | JournalStatus)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input
            className="h-9 min-w-[220px] text-[12px]"
            placeholder="Search reference or narration"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ErpButton variant="secondary" onClick={() => void load()}>
            Refresh
          </ErpButton>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {[
          { label: 'Draft', value: summary.draft, tone: 'border-slate-200 bg-slate-50' },
          { label: 'Pending approval', value: summary.pending, tone: 'border-amber-200 bg-amber-50' },
          { label: 'Approved (ready to post)', value: summary.approved, tone: 'border-emerald-200 bg-emerald-50' },
          { label: 'Posted', value: rows.filter((r) => r.status === 'POSTED').length, tone: 'border-sky-200 bg-sky-50' },
        ].map((chip) => (
          <div key={chip.label} className={`rounded border px-3 py-2 text-[12px] ${chip.tone}`}>
            <span className="font-medium">{chip.label}</span>
            <span className="ml-2 tabular-nums">{chip.value}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <LoadingState variant="table" rows={8} />
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-[13px] text-erp-muted">
          No journals found. {perms.canCreateVoucher ? 'Create your first manual journal to get started.' : ''}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-erp-border text-left text-erp-muted">
                <th className="px-2 py-2 font-medium">Reference</th>
                <th className="px-2 py-2 font-medium">Posting date</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium text-right">Debit</th>
                <th className="px-2 py-2 font-medium text-right">Credit</th>
                <th className="px-2 py-2 font-medium">Narration</th>
                <th className="px-2 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-erp-border/70 hover:bg-slate-50">
                  <td className="px-2 py-2">
                    <Link className="font-medium text-sky-700 hover:underline" to={`/accounting/entries/journals/${row.id}`}>
                      {row.referenceNumber ?? row.draftReference ?? row.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{row.postingDate}</td>
                  <td className="px-2 py-2">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${statusTone(row.status)}`}>{statusLabel(row.status)}</span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{row.totalDebit}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{row.totalCredit}</td>
                  <td className="max-w-[280px] truncate px-2 py-2">{row.narration ?? '—'}</td>
                  <td className="px-2 py-2">
                    {row.status === 'APPROVED' && !row.voucherNumber && perms.canPostVoucher ? (
                      <button
                        type="button"
                        className="text-sky-700 hover:underline disabled:opacity-50"
                        disabled={postingId === row.id}
                        onClick={() => void handleQuickPost(row.id)}
                      >
                        {postingId === row.id ? 'Posting…' : 'Post'}
                      </button>
                    ) : (
                      '—'
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
