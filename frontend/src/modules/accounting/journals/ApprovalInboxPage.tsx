import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Select } from '@/components/forms/Inputs'
import { listApprovalRequests } from '@/services/bridges/approvalApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { ApprovalRequest } from '@/types/approvals'
import { useFinancePermissions } from '@/utils/permissions/finance'
import { notify } from '@/store/toastStore'
import { JournalsWorkspaceShell } from './JournalsWorkspaceShell'

type InboxView = 'my_pending' | 'submitted_by_me' | 'completed_by_me' | 'all'

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

function isSameDay(iso: string, ref = new Date()): boolean {
  const d = new Date(iso)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate()
}

export function ApprovalInboxPage() {
  const perms = useFinancePermissions()
  const canAll = perms.canManage
  const [view, setView] = useState<InboxView>(perms.canApproveVoucher ? 'my_pending' : 'submitted_by_me')
  const [rows, setRows] = useState<ApprovalRequest[]>([])
  const [summaryRows, setSummaryRows] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const legalEntityId = resolveLegalEntityId()
      const items = await listApprovalRequests({ legalEntityId, view })
      setRows(items)

      const summarySources: ApprovalRequest[] = [...items]
      if (perms.canApproveVoucher && view !== 'my_pending') {
        try {
          const pending = await listApprovalRequests({ legalEntityId, view: 'my_pending' })
          summarySources.push(...pending)
        } catch {
          /* ignore summary enrichment failures */
        }
      }
      if (view !== 'completed_by_me') {
        try {
          const completed = await listApprovalRequests({ legalEntityId, view: 'completed_by_me' })
          summarySources.push(...completed)
        } catch {
          /* ignore */
        }
      }
      const byId = new Map(summarySources.map((r) => [r.id, r]))
      setSummaryRows([...byId.values()])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load approvals')
    } finally {
      setLoading(false)
    }
  }, [view, perms.canApproveVoucher])

  useEffect(() => {
    if (perms.canApproveVoucher || perms.canViewVouchers) void load()
  }, [load, perms.canApproveVoucher, perms.canViewVouchers])

  const summary = useMemo(() => {
    const today = new Date()
    const waiting = summaryRows.filter((r) => r.status === 'PENDING')
    return {
      waitingForMe: waiting.length,
      dueToday: waiting.filter((r) => isSameDay(r.requestedAt, today)).length,
      olderThan3: waiting.filter((r) => daysAgo(r.requestedAt) > 3).length,
      sentBack: summaryRows.filter((r) => r.status === 'SENT_BACK').length,
      approvedToday: summaryRows.filter((r) => r.status === 'APPROVED' && r.completedAt && isSameDay(r.completedAt, today)).length,
      rejected: summaryRows.filter((r) => r.status === 'REJECTED').length,
    }
  }, [summaryRows])

  if (!perms.canApproveVoucher && !perms.canViewVouchers) {
    return (
      <JournalsWorkspaceShell title="Approvals" activeTab="approvals">
        <p className="text-[13px] text-erp-muted">You do not have permission to view the approval inbox.</p>
      </JournalsWorkspaceShell>
    )
  }

  return (
    <JournalsWorkspaceShell title="Approvals" activeTab="approvals">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          className="h-9 min-w-[180px] text-[12px]"
          value={view}
          onChange={(e) => setView(e.target.value as InboxView)}
        >
          {perms.canApproveVoucher ? <option value="my_pending">My Pending</option> : null}
          <option value="submitted_by_me">Submitted by Me</option>
          <option value="completed_by_me">Completed</option>
          {canAll ? <option value="all">All Approvals</option> : null}
        </Select>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Waiting for Me', value: summary.waitingForMe, tone: 'border-amber-200 bg-amber-50' },
          { label: 'Due Today', value: summary.dueToday, tone: 'border-sky-200 bg-sky-50' },
          { label: 'Older Than 3 Days', value: summary.olderThan3, tone: 'border-orange-200 bg-orange-50' },
          { label: 'Sent Back', value: summary.sentBack, tone: 'border-violet-200 bg-violet-50' },
          { label: 'Approved Today', value: summary.approvedToday, tone: 'border-emerald-200 bg-emerald-50' },
          { label: 'Rejected', value: summary.rejected, tone: 'border-rose-200 bg-rose-50' },
        ].map((card) => (
          <div key={card.label} className={`rounded border px-3 py-2 ${card.tone}`}>
            <div className="text-[11px] text-erp-muted">{card.label}</div>
            <div className="text-[18px] font-semibold tabular-nums">{card.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <LoadingState variant="table" />
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-erp-muted">No approval requests in this view.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-erp-border bg-slate-50 text-left text-erp-muted">
                <th className="px-2 py-2">Journal</th>
                <th className="px-2 py-2">Requested By</th>
                <th className="px-2 py-2">Amount</th>
                <th className="px-2 py-2">Approval Level</th>
                <th className="px-2 py-2">Age</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-erp-border/70">
                  <td className="px-2 py-2 font-medium">{row.documentNumberSnapshot ?? row.documentId.slice(0, 8)}</td>
                  <td className="px-2 py-2 font-mono text-[11px]">{row.requestedBy?.slice(0, 8) ?? '—'}</td>
                  <td className="px-2 py-2 tabular-nums">
                    {row.amountBasis} {row.currencyCode}
                  </td>
                  <td className="px-2 py-2">
                    {row.currentLevel} / {row.totalLevels}
                  </td>
                  <td className="px-2 py-2">{daysAgo(row.requestedAt)}d</td>
                  <td className="px-2 py-2">{row.status.replace(/_/g, ' ')}</td>
                  <td className="px-2 py-2 text-right">
                    <Link className="text-sky-700 hover:underline" to={`/accounting/entries/approvals/${row.id}`}>
                      Review
                    </Link>
                    {' · '}
                    <Link className="text-sky-700 hover:underline" to={`/accounting/entries/journals/${row.documentId}`}>
                      Open Journal
                    </Link>
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
