import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  approveJournal,
  getJournalApprovals,
  rejectJournal,
  sendBackJournal,
} from '@/services/bridges/approvalApiBridge'
import {
  cancelJournal,
  getJournal,
  getJournalAudit,
  submitJournal,
  validateJournal,
} from '@/services/bridges/journalApiBridge'
import type { Journal, JournalAuditEntry, JournalValidationReport } from '@/types/journals'
import type { JournalApprovalTimelineEntry } from '@/types/approvals'
import { useFinancePermissions } from '@/utils/permissions/finance'
import { notify } from '@/store/toastStore'
import { JournalsWorkspaceShell } from './JournalsWorkspaceShell'

function statusMessage(status: Journal['status']) {
  switch (status) {
    case 'PENDING_APPROVAL':
      return 'Submitted and awaiting approver action at the current level.'
    case 'SENT_BACK':
      return 'Sent back by approver — edit and resubmit when ready.'
    case 'REJECTED':
      return 'Rejected by approver — read-only.'
    case 'APPROVED':
      return 'Approved — ready for posting in Phase 2C2B (posting not available yet).'
    default:
      return null
  }
}

export function JournalDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useFinancePermissions()
  const [journal, setJournal] = useState<Journal | null>(null)
  const [report, setReport] = useState<JournalValidationReport | null>(null)
  const [audit, setAudit] = useState<JournalAuditEntry[]>([])
  const [timeline, setTimeline] = useState<JournalApprovalTimelineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancel, setShowCancel] = useState(false)
  const [decisionComments, setDecisionComments] = useState('')
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [j, a] = await Promise.all([getJournal(id), getJournalAudit(id)])
      setJournal(j)
      setAudit(a)
      if (j.status !== 'DRAFT' || j.approvalRequired) {
        try {
          setTimeline(await getJournalApprovals(id))
        } catch {
          setTimeline([])
        }
      } else {
        setTimeline([])
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load journal')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (perms.canViewVouchers) void load()
  }, [load, perms.canViewVouchers])

  const runValidate = async () => {
    if (!id) return
    try {
      const result = await validateJournal(id)
      setReport(result)
      if (result.valid) notify.success('Validation passed')
      else notify.error(result.errors[0]?.message ?? 'Validation failed')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Validation failed')
    }
  }

  const runSubmit = async () => {
    if (!id) return
    try {
      const updated = await submitJournal(id)
      setJournal(updated)
      notify.success(updated.status === 'PENDING_APPROVAL' ? 'Submitted for approval' : 'Journal approved')
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Submit failed')
    }
  }

  const runCancel = async () => {
    if (!id) return
    try {
      const updated = await cancelJournal(id, cancelReason)
      setJournal(updated)
      setShowCancel(false)
      notify.success('Journal cancelled')
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Cancel failed')
    }
  }

  const runApprove = async () => {
    if (!id) return
    setActing(true)
    try {
      const updated = await approveJournal(id, decisionComments.trim() || undefined)
      setJournal(updated)
      notify.success('Journal approved')
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Approve failed')
    } finally {
      setActing(false)
    }
  }

  const runSendBack = async () => {
    if (!id || !decisionComments.trim()) {
      notify.error('Comments are required when sending back')
      return
    }
    setActing(true)
    try {
      const updated = await sendBackJournal(id, decisionComments.trim())
      setJournal(updated)
      notify.success('Journal sent back')
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Send back failed')
    } finally {
      setActing(false)
    }
  }

  const runReject = async () => {
    if (!id || !decisionComments.trim()) {
      notify.error('Comments are required when rejecting')
      return
    }
    setActing(true)
    try {
      const updated = await rejectJournal(id, decisionComments.trim())
      setJournal(updated)
      notify.success('Journal rejected')
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Reject failed')
    } finally {
      setActing(false)
    }
  }

  if (!perms.canViewVouchers) {
    return (
      <JournalsWorkspaceShell title="Journal">
        <p className="text-[13px] text-erp-muted">You do not have permission to view journals.</p>
      </JournalsWorkspaceShell>
    )
  }

  if (loading || !journal) {
    return (
      <JournalsWorkspaceShell title="Journal">
        {loading ? <LoadingState variant="form" /> : <p className="text-[13px] text-erp-muted">Journal not found.</p>}
      </JournalsWorkspaceShell>
    )
  }

  const actions = journal.allowedActions
  const banner = statusMessage(journal.status)

  return (
    <JournalsWorkspaceShell
      title={journal.referenceNumber ?? 'Journal'}
      description={`Status: ${journal.status.replace(/_/g, ' ')} · Voucher number: ${journal.voucherNumber ?? 'Not assigned (no posting in 2C2A)'}`}
      actions={
        <div className="flex flex-wrap gap-2">
          {actions?.edit && perms.canEditVoucher ? (
            <ErpButton variant="secondary" icon={Pencil} onClick={() => navigate(`/accounting/entries/journals/${journal.id}/edit`)}>
              Edit
            </ErpButton>
          ) : null}
          {actions?.validate ? (
            <ErpButton variant="secondary" onClick={() => void runValidate()}>
              Validate
            </ErpButton>
          ) : null}
          {actions?.submit && perms.canSubmitVoucher ? (
            <ErpButton variant="secondary" onClick={() => void runSubmit()}>
              Submit
            </ErpButton>
          ) : null}
          {actions?.approve && perms.canApproveVoucher ? (
            <ErpButton variant="primary" disabled={acting} onClick={() => void runApprove()}>
              Approve
            </ErpButton>
          ) : null}
          {actions?.sendBack && perms.canApproveVoucher ? (
            <ErpButton variant="secondary" disabled={acting} onClick={() => void runSendBack()}>
              Send back
            </ErpButton>
          ) : null}
          {actions?.reject && perms.canApproveVoucher ? (
            <ErpButton variant="secondary" disabled={acting} onClick={() => void runReject()}>
              Reject
            </ErpButton>
          ) : null}
          {actions?.cancel && perms.canCancelVoucher ? (
            <ErpButton variant="secondary" onClick={() => setShowCancel(true)}>
              Cancel
            </ErpButton>
          ) : null}
        </div>
      }
    >
      {banner ? (
        <div className="mb-4 rounded border border-sky-200 bg-sky-50 p-3 text-[13px] text-sky-900">{banner}</div>
      ) : null}

      <div className="mb-4 grid gap-3 md:grid-cols-3 text-[12px]">
        <div><span className="text-erp-muted">Posting date</span><div className="font-medium">{journal.postingDate}</div></div>
        <div><span className="text-erp-muted">Document date</span><div className="font-medium">{journal.documentDate}</div></div>
        <div><span className="text-erp-muted">Draft reference</span><div className="font-medium">{journal.referenceNumber ?? '—'}</div></div>
        <div><span className="text-erp-muted">Total debit</span><div className="font-medium tabular-nums">{journal.totalDebit}</div></div>
        <div><span className="text-erp-muted">Total credit</span><div className="font-medium tabular-nums">{journal.totalCredit}</div></div>
        <div><span className="text-erp-muted">Approval required</span><div className="font-medium">{journal.approvalRequired ? `Yes (level ${journal.currentApprovalLevel})` : 'No'}</div></div>
      </div>

      {journal.narration ? <p className="mb-4 text-[13px] text-erp-text">{journal.narration}</p> : null}

      {(actions?.approve || actions?.sendBack || actions?.reject) && journal.status === 'PENDING_APPROVAL' ? (
        <div className="mb-4">
          <label className="mb-1 block text-[12px] font-medium">Approver comments</label>
          <Textarea
            rows={2}
            value={decisionComments}
            onChange={(e) => setDecisionComments(e.target.value)}
            placeholder="Optional for approve; required for send back or reject"
          />
        </div>
      ) : null}

      <div className="mb-4 overflow-x-auto rounded border border-erp-border">
        <table className="w-full min-w-[720px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-erp-border bg-slate-50 text-left text-erp-muted">
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Account</th>
              <th className="px-2 py-2 text-right">Debit</th>
              <th className="px-2 py-2 text-right">Credit</th>
              <th className="px-2 py-2">Narration</th>
            </tr>
          </thead>
          <tbody>
            {journal.lines.map((line) => (
              <tr key={line.id ?? line.lineNumber} className="border-b border-erp-border/70">
                <td className="px-2 py-2">{line.lineNumber}</td>
                <td className="px-2 py-2 font-mono text-[11px]">{line.accountId.slice(0, 8)}…</td>
                <td className="px-2 py-2 text-right tabular-nums">{line.debitAmount}</td>
                <td className="px-2 py-2 text-right tabular-nums">{line.creditAmount}</td>
                <td className="px-2 py-2">{line.lineNarration ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {report ? (
        <div className="mb-4 rounded border border-erp-border p-3 text-[12px]">
          <div className="mb-2 font-medium">Validation report</div>
          <div className={report.valid ? 'text-emerald-700' : 'text-rose-700'}>
            {report.valid ? 'Valid — ready to submit (if period open and approval resolved).' : 'Invalid — fix errors before submit.'}
          </div>
          {report.errors.length ? (
            <ul className="mt-2 list-disc pl-5 text-rose-700">
              {report.errors.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-2 text-erp-muted">
            Approval: {report.approval.required ? `required (${report.approval.totalLevels ?? 1} level(s))` : 'not required'}
            {report.approval.blockReason ? ` — ${report.approval.blockReason}` : ''}
          </div>
        </div>
      ) : null}

      {timeline.length > 0 ? (
        <div className="mb-4 rounded border border-erp-border p-3 text-[12px]">
          <div className="mb-2 font-medium">Approval timeline</div>
          <ul className="space-y-2">
            {timeline.map((cycle) => (
              <li key={cycle.requestId}>
                <div className="font-medium">
                  Cycle {cycle.cycleNumber} — {cycle.status.replace(/_/g, ' ')}
                </div>
                <ul className="mt-1 pl-4 text-erp-muted">
                  {cycle.steps.map((step) => (
                    <li key={step.id}>
                      Level {step.level}: {step.status}
                      {step.comments ? ` — ${step.comments}` : ''}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showCancel ? (
        <div className="mb-4 rounded border border-rose-200 bg-rose-50 p-3">
          <div className="mb-2 text-[13px] font-medium text-rose-900">Cancel journal</div>
          <Textarea rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason required" />
          <div className="mt-2 flex gap-2">
            <ErpButton variant="secondary" onClick={() => setShowCancel(false)}>Close</ErpButton>
            <ErpButton variant="primary" onClick={() => void runCancel()}>Confirm cancel</ErpButton>
          </div>
        </div>
      ) : null}

      <div className="rounded border border-erp-border p-3 text-[12px]">
        <div className="mb-2 font-medium">Audit trail</div>
        {audit.length === 0 ? (
          <p className="text-erp-muted">No audit entries yet.</p>
        ) : (
          <ul className="space-y-1">
            {audit.map((entry) => (
              <li key={entry.id} className="flex justify-between gap-3">
                <span>{entry.action}</span>
                <span className="text-erp-muted">{new Date(entry.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 text-[11px] text-erp-muted">
        Phase 2C2A: Approve / send back / reject are available when allowed. Post is disabled until Phase 2C2B — no GL posting or voucher number assignment in this phase.
      </p>

      <Link className="mt-3 inline-block text-[12px] text-sky-700 hover:underline" to="/accounting/entries/journals">
        ← Back to journals
      </Link>
    </JournalsWorkspaceShell>
  )
}
