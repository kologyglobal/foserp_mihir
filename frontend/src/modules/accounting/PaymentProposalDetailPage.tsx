import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Ban,
  Check,
  FileSpreadsheet,
  FileText,
  Printer,
  Send,
  Wand2,
  X,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableLink } from '@/components/ui/AppLink'
import { PayableConfirmModal, PaymentProposalStatusBadge } from '@/components/accounting/payables'
import {
  approvePaymentProposal,
  createPaymentDraftsDemo,
  exportPayables,
  getPaymentProposalById,
  getPayablesAuditTrail,
  getPayablesPrintPreview,
  rejectPaymentProposal,
  submitPaymentProposal,
  PayablesServiceError,
} from '@/services/accounting/payablesService'
import type { PayablesAuditEntry, PaymentProposal } from '@/types/payables'
import { usePayablesPermissions } from '@/utils/permissions/payables'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

type SectionTab = 'lines' | 'tds' | 'approval' | 'audit'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-erp-text">{value ?? '—'}</dd>
    </div>
  )
}

export function PaymentProposalDetailPage() {
  const { proposalId } = useParams<{ proposalId: string }>()
  const navigate = useNavigate()
  const perms = usePayablesPermissions()
  const [proposal, setProposal] = useState<PaymentProposal | null>(null)
  const [audit, setAudit] = useState<PayablesAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [sectionTab, setSectionTab] = useState<SectionTab>('lines')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)

  const reload = useCallback(async () => {
    if (!proposalId) return
    setLoading(true)
    try {
      const [p, a] = await Promise.all([
        getPaymentProposalById(proposalId),
        getPayablesAuditTrail('payment_proposal', proposalId),
      ])
      setProposal(p)
      setAudit(a)
    } catch {
      setProposal(null)
    } finally {
      setLoading(false)
    }
  }, [proposalId])

  useEffect(() => {
    void reload()
  }, [reload])

  const vendorGroups = useMemo(() => {
    if (!proposal) return []
    const map = new Map<string, typeof proposal.lines>()
    for (const line of proposal.lines) {
      const arr = map.get(line.vendorId) ?? []
      arr.push(line)
      map.set(line.vendorId, arr)
    }
    return [...map.entries()].map(([vendorId, lines]) => ({
      vendorId,
      vendorName: lines[0]?.vendorName ?? vendorId,
      lines,
      total: lines.filter((l) => l.selected).reduce((s, l) => s + l.proposedAmount, 0),
    }))
  }, [proposal])

  const breadcrumbs = [
    { label: 'Accounting', to: '/accounting' },
    { label: 'Payables', to: '/accounting/payables' },
    { label: 'Payment Proposals', to: '/accounting/payables/payment-proposals' },
    { label: proposal?.proposalNumber ?? 'Detail' },
  ]

  const handleExport = async () => {
    try {
      const result = await exportPayables({ scope: 'payment_proposals', format: 'csv' })
      notify.success(`${result.filename} — ${result.disclaimer}`)
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Export failed')
    }
  }

  const handlePrint = async () => {
    if (!proposal) return
    try {
      const preview = await getPayablesPrintPreview('payment_proposal', proposal.id)
      notify.info(`${preview.title} — ${preview.disclaimer}`)
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Print failed')
    }
  }

  const handleCreateDrafts = async () => {
    if (!proposal) return
    setBusy(true)
    try {
      const drafts = await createPaymentDraftsDemo(proposal.id)
      notify.success(
        `Created ${drafts.length} payment draft(s) in demo mode. No bank file or real disbursement was triggered.`,
      )
      navigate('/accounting/payables/payments')
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Draft creation failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Proposal" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <LoadingState variant="form" rows={6} />
      </OperationalPageShell>
    )
  }

  if (!proposal) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Not found" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <EmptyState
          icon={FileText}
          title="Proposal not found"
          action={
            <Link to="/accounting/payables/payment-proposals" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]">
              Back
            </Link>
          }
        />
      </OperationalPageShell>
    )
  }

  const canSubmit = perms.canSubmitPaymentProposal && proposal.status === 'Draft'
  const canApprove =
    perms.canApprovePaymentProposal && (proposal.status === 'Submitted' || proposal.status === 'Pending Approval')
  const canReject = perms.canApprovePaymentProposal && proposal.status === 'Submitted'
  const canDrafts =
    perms.canCreatePayment && (proposal.status === 'Approved' || proposal.status === 'Partially Processed')
  const canCancel = perms.canCreatePaymentProposal && proposal.status === 'Draft'

  const secondary = [
    ...(canSubmit
      ? [{
          id: 'submit',
          label: 'Submit',
          icon: Send,
          onClick: async () => {
            setBusy(true)
            try {
              await submitPaymentProposal(proposal.id)
              notify.success('Submitted for approval')
              await reload()
            } catch (e) {
              notify.error(e instanceof PayablesServiceError ? e.message : 'Submit failed')
            } finally {
              setBusy(false)
            }
          },
        }]
      : []),
    ...(canApprove
      ? [{
          id: 'approve',
          label: 'Approve',
          icon: Check,
          onClick: async () => {
            setBusy(true)
            try {
              await approvePaymentProposal(proposal.id)
              notify.success('Proposal approved')
              await reload()
            } catch (e) {
              notify.error(e instanceof PayablesServiceError ? e.message : 'Approve failed')
            } finally {
              setBusy(false)
            }
          },
        }]
      : []),
    ...(canReject ? [{ id: 'reject', label: 'Reject', icon: X, onClick: () => setRejectOpen(true) }] : []),
    ...(canDrafts ? [{ id: 'drafts', label: 'Create Drafts (Demo)', icon: Wand2, onClick: () => void handleCreateDrafts() }] : []),
    ...(perms.canExport ? [{ id: 'export', label: 'Export', icon: FileSpreadsheet, onClick: () => void handleExport() }] : []),
    ...(perms.canPrint ? [{ id: 'print', label: 'Print', icon: Printer, onClick: () => void handlePrint() }] : []),
    ...(canCancel ? [{ id: 'cancel', label: 'Cancel', icon: Ban, onClick: () => setCancelOpen(true) }] : []),
  ]

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={proposal.proposalNumber}
      description={`Payment date ${proposal.proposedPaymentDate} · ${proposal.invoiceCount} invoices`}
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath={`/accounting/payables/payment-proposals/${proposal.id}`}
      commandBar={<ErpCommandBar inline sticky secondaryActions={secondary} />}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <PaymentProposalStatusBadge status={proposal.status} />
        {proposal.rejectionReason ? (
          <span className="text-[12px] text-rose-700">Rejected: {proposal.rejectionReason}</span>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-erp-border p-4 lg:col-span-2">
          <h3 className="mb-3 text-[13px] font-semibold">Criteria & summary</h3>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Proposed payment date" value={proposal.proposedPaymentDate} />
            <Field label="Total amount" value={formatCurrency(proposal.totalAmount)} />
            <Field label="Vendors" value={proposal.vendorCount} />
            <Field label="Invoices" value={proposal.invoiceCount} />
            <Field label="Created by" value={proposal.createdBy} />
            <Field label="Created at" value={formatDateTime(proposal.createdAt)} />
            {proposal.submittedAt ? <Field label="Submitted at" value={formatDateTime(proposal.submittedAt)} /> : null}
            {proposal.approvedBy ? (
              <Field label="Approved by" value={`${proposal.approvedBy}${proposal.approvedAt ? ` · ${formatDateTime(proposal.approvedAt)}` : ''}`} />
            ) : null}
          </dl>
        </section>

        <aside className="rounded-lg border border-erp-border bg-erp-surface-alt/30 p-4">
          <h3 className="mb-3 text-[13px] font-semibold">Vendor summary</h3>
          <ul className="space-y-2 text-[13px]">
            {vendorGroups.map((g) => (
              <li key={g.vendorId} className="flex justify-between gap-2 border-b border-erp-border/60 pb-2">
                <span className="font-medium">{g.vendorName}</span>
                <span className="tabular-nums">{formatCurrency(g.total)}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex gap-1 border-b border-erp-border" role="tablist">
          {(
            [
              ['lines', 'Proposal lines'],
              ['tds', 'TDS summary'],
              ['approval', 'Approval history'],
              ['audit', 'Audit trail'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={sectionTab === id}
              className={cn(
                'border-b-2 px-3 py-2 text-[12px] font-semibold',
                sectionTab === id ? 'border-erp-primary text-erp-primary' : 'border-transparent text-erp-muted',
              )}
              onClick={() => setSectionTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {sectionTab === 'lines' ? (
          <div className="space-y-4">
            {vendorGroups.map((group) => (
              <section key={group.vendorId} className="rounded-lg border border-erp-border">
                <header className="border-b border-erp-border bg-erp-surface-alt/40 px-4 py-2 text-[13px] font-semibold">
                  {group.vendorName} — {formatCurrency(group.total)}
                </header>
                <div className="overflow-x-auto">
                  <table className="erp-table w-full min-w-[720px] text-[13px]">
                    <thead>
                      <tr className="text-[11px] uppercase text-erp-muted">
                        <th className="px-3 py-2 text-left">Invoice</th>
                        <th className="px-3 py-2 text-left">Due</th>
                        <th className="px-3 py-2 text-right">Outstanding</th>
                        <th className="px-3 py-2 text-right">Proposed</th>
                        <th className="px-3 py-2 text-left">Selected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.lines.map((line) => (
                        <tr key={line.id} className="border-t border-erp-border/70">
                          <td className="px-3 py-2">
                            <TableLink to={`/accounting/payables/invoices/${line.invoiceId}`}>{line.invoiceNumber}</TableLink>
                          </td>
                          <td className="px-3 py-2 tabular-nums">{line.dueDate}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(line.outstanding)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(line.proposedAmount)}</td>
                          <td className="px-3 py-2">{line.selected ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        ) : null}

        {sectionTab === 'tds' ? (
          <p className="rounded-lg border border-dashed border-erp-border px-4 py-6 text-[13px] text-erp-muted">
            {perms.canViewTds
              ? 'TDS on vendor payments is calculated at payment posting — proposal lines show gross outstanding only (demo).'
              : 'TDS details require accounting.payables.view_tds permission.'}
          </p>
        ) : null}

        {sectionTab === 'approval' ? (
          <p className="text-[13px] text-erp-muted">
            {proposal.status === 'Submitted' || proposal.status === 'Pending Approval'
              ? 'Awaiting approval — demo workflow only.'
              : proposal.status === 'Approved'
                ? `Approved by ${proposal.approvedBy ?? '—'}`
                : proposal.status === 'Rejected'
                  ? `Rejected: ${proposal.rejectionReason ?? '—'}`
                  : 'No approval history yet.'}
          </p>
        ) : null}

        {sectionTab === 'audit' && perms.canViewAudit ? (
          <ul className="space-y-2">
            {audit.map((a) => (
              <li key={a.id} className="rounded-md border border-erp-border px-3 py-2 text-[13px]">
                <span className="font-medium">{a.action}</span>
                <span className="text-erp-muted"> — {a.details}</span>
                <p className="text-[11px] text-erp-muted">
                  {a.performedBy} · {formatDateTime(a.performedAt)}
                  {a.isDemo ? ' · Demo' : ''}
                </p>
              </li>
            ))}
            {audit.length === 0 ? <p className="text-[13px] text-erp-muted">No audit entries.</p> : null}
          </ul>
        ) : null}
      </div>

      <PayableConfirmModal
        open={rejectOpen}
        onClose={() => {
          setRejectOpen(false)
          setRejectReason('')
        }}
        title="Reject proposal"
        description={`Reject ${proposal.proposalNumber}?`}
        confirmLabel={busy ? 'Rejecting…' : 'Confirm reject'}
        onConfirm={async () => {
          if (!rejectReason.trim()) {
            notify.error('Rejection reason is required')
            return
          }
          setBusy(true)
          try {
            await rejectPaymentProposal(proposal.id, rejectReason.trim())
            notify.success('Proposal rejected')
            setRejectOpen(false)
            setRejectReason('')
            await reload()
          } catch (e) {
            notify.error(e instanceof PayablesServiceError ? e.message : 'Reject failed')
          } finally {
            setBusy(false)
          }
        }}
      >
        <textarea
          className="erp-input mt-3 w-full text-[13px]"
          rows={3}
          placeholder="Rejection reason (required)"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </PayableConfirmModal>

      <PayableConfirmModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel proposal (demo)"
        description="Cancel this draft proposal? Demo store does not persist cancellation — refresh will restore seed data."
        confirmLabel="Confirm cancel"
        onConfirm={() => {
          setCancelOpen(false)
          notify.info('Proposal cancel acknowledged — demo UI only. Use reject workflow for submitted proposals.')
          navigate('/accounting/payables/payment-proposals')
        }}
      />
    </OperationalPageShell>
  )
}
