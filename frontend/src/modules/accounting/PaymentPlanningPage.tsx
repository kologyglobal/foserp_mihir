import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileSpreadsheet,
  HandCoins,
  Play,
  RefreshCw,
  Save,
  Send,
  ShieldOff,
  Users,
  Wand2,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Input, Select } from '@/components/forms/Inputs'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { PayablesCoreFlowStrip, PayablesWorkspaceTabs } from '@/components/accounting/payables'
import {
  createPaymentDraftsDemo,
  createPaymentProposal,
  exportPayables,
  getPayableLookups,
  getPaymentPlanningPreview,
  submitPaymentProposal,
  updatePaymentProposal,
  PayablesServiceError,
} from '@/services/accounting/payablesService'
import type {
  PaymentPlanningCriteria,
  PaymentPlanningPreviewLine,
  PaymentPlanningPriority,
} from '@/types/payables'
import { usePayablesPermissions } from '@/utils/permissions/payables'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

type WorkspaceTab = 'criteria' | 'proposed'

type PlanningFormState = {
  paymentDate: string
  bankAccountId: string
  includeOverdue: boolean
  includeDueWithinDays: string
  msmePriority: boolean
  excludeOnHold: boolean
  excludeDisputed: boolean
  maxPaymentAmount: string
  priority: PaymentPlanningPriority
  applyDebitNotes: boolean
  applyAdvances: boolean
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function defaultForm(): PlanningFormState {
  return {
    paymentDate: today(),
    bankAccountId: '',
    includeOverdue: true,
    includeDueWithinDays: '30',
    msmePriority: true,
    excludeOnHold: true,
    excludeDisputed: true,
    maxPaymentAmount: '',
    priority: 'MSME First',
    applyDebitNotes: false,
    applyAdvances: false,
  }
}

function toCriteria(form: PlanningFormState): PaymentPlanningCriteria {
  return {
    paymentDate: form.paymentDate,
    maxPaymentAmount: form.maxPaymentAmount ? Number(form.maxPaymentAmount) : null,
    includeOverdue: form.includeOverdue,
    includeDueWithinDays: Number(form.includeDueWithinDays) || 0,
    msmePriority: form.msmePriority,
    excludeOnHold: form.excludeOnHold,
    excludeDisputed: form.excludeDisputed,
    vendorIds: [],
    minimumInvoiceAmount: null,
    priority: form.priority,
  }
}

const PRIORITIES: PaymentPlanningPriority[] = [
  'MSME First',
  'Overdue First',
  'Due Date',
  'Amount Descending',
  'Vendor Priority',
]

export function PaymentPlanningPage() {
  const navigate = useNavigate()
  const perms = usePayablesPermissions()
  const [workspace, setWorkspace] = useState<WorkspaceTab>('criteria')
  const [form, setForm] = useState<PlanningFormState>(() => defaultForm())
  const [lookups, setLookups] = useState<Awaited<ReturnType<typeof getPayableLookups>> | null>(null)
  const [previewLines, setPreviewLines] = useState<PaymentPlanningPreviewLine[]>([])
  const [previewMeta, setPreviewMeta] = useState<{
    totalProposed: number
    vendorCount: number
    invoiceCount: number
    msmeAmount: number
    overdueAmount: number
    warnings: string[]
  } | null>(null)
  const [savedProposalId, setSavedProposalId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void getPayableLookups().then(setLookups)
  }, [])

  const setField = <K extends keyof PlanningFormState>(key: K, value: PlanningFormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const generatePreview = async () => {
    if (!form.paymentDate) {
      notify.error('Payment date is required')
      return
    }
    setGenerating(true)
    try {
      const preview = await getPaymentPlanningPreview(toCriteria(form))
      setPreviewLines(preview.lines)
      setPreviewMeta({
        totalProposed: preview.totalProposed,
        vendorCount: preview.vendorCount,
        invoiceCount: preview.invoiceCount,
        msmeAmount: preview.msmeAmount,
        overdueAmount: preview.overdueAmount,
        warnings: preview.warnings,
      })
      setWorkspace('proposed')
      if (preview.warnings.length) {
        notify.info(preview.warnings[0])
      } else {
        notify.success(`Preview generated — ${preview.invoiceCount} invoice(s)`)
      }
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Preview failed')
    } finally {
      setGenerating(false)
    }
  }

  const selectedLines = useMemo(() => previewLines.filter((l) => l.selected), [previewLines])
  const selectedTotal = useMemo(() => selectedLines.reduce((s, l) => s + l.proposedAmount, 0), [selectedLines])

  const vendorGroups = useMemo(() => {
    const map = new Map<string, PaymentPlanningPreviewLine[]>()
    for (const line of previewLines) {
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
  }, [previewLines])

  const updateLine = (invoiceId: string, patch: Partial<PaymentPlanningPreviewLine>) => {
    setPreviewLines((lines) => lines.map((l) => (l.invoiceId === invoiceId ? { ...l, ...patch } : l)))
  }

  const toggleVendor = (vendorId: string, selected: boolean) => {
    setPreviewLines((lines) => lines.map((l) => (l.vendorId === vendorId ? { ...l, selected } : l)))
  }

  const saveProposal = async (): Promise<string | null> => {
    if (!perms.canCreatePaymentProposal) {
      notify.error('Missing create payment proposal permission')
      return null
    }
    const ids = selectedLines.map((l) => l.invoiceId)
    if (!ids.length) {
      notify.error('Select at least one invoice for the proposal')
      return null
    }
    setBusy(true)
    try {
      let proposal = await createPaymentProposal(ids, form.paymentDate)
      const updatedLines = proposal.lines.map((l) => {
        const src = previewLines.find((p) => p.invoiceId === l.invoiceId)
        if (!src) return l
        return { ...l, proposedAmount: src.proposedAmount, selected: src.selected }
      })
      proposal = await updatePaymentProposal(proposal.id, { lines: updatedLines })
      setSavedProposalId(proposal.id)
      notify.success(`Proposal saved — ${proposal.proposalNumber}`)
      return proposal.id
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Save failed')
      return null
    } finally {
      setBusy(false)
    }
  }

  const handleSave = async () => {
    await saveProposal()
  }

  const handleSubmit = async () => {
    if (!perms.canSubmitPaymentProposal) {
      notify.error('Missing submit payment proposal permission')
      return
    }
    const id = savedProposalId ?? (await saveProposal())
    if (!id) return
    setBusy(true)
    try {
      const submitted = await submitPaymentProposal(id)
      notify.success(`${submitted.proposalNumber} submitted for approval`)
      navigate(`/accounting/payables/payment-proposals/${id}`)
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  const handleExport = async () => {
    try {
      const result = await exportPayables({ scope: 'payment_proposals', format: 'csv' })
      notify.success(`${result.filename} — ${result.disclaimer}`)
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Export failed')
    }
  }

  const handleCreateDrafts = async () => {
    if (!savedProposalId) {
      notify.error('Save the proposal first')
      return
    }
    setBusy(true)
    try {
      const drafts = await createPaymentDraftsDemo(savedProposalId)
      notify.success(
        `Created ${drafts.length} payment draft(s) in demo mode. No bank file or real disbursement was triggered.`,
      )
      navigate('/accounting/payables/payments')
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Draft creation failed — proposal must be approved first.')
    } finally {
      setBusy(false)
    }
  }

  const breadcrumbs = [
    { label: 'Accounting', to: '/accounting' },
    { label: 'Payables', to: '/accounting/payables' },
    { label: 'Payment Planning' },
  ]

  if (!perms.canViewPaymentPlanning) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Payment Planning" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="Missing accounting.payables.view_payment_planning permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Payment Planning"
      description="Primary AP workspace — select open invoices from outstanding, build the payment run, then submit for approval."
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath="/accounting/payables/payment-planning"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreatePaymentProposal
              ? { id: 'save', label: busy ? 'Saving…' : 'Save Proposal', icon: Save, onClick: () => void handleSave() }
              : undefined
          }
          secondaryActions={[
            {
              id: 'outstanding',
              label: 'Vendor Outstanding',
              icon: Users,
              onClick: () => navigate('/accounting/payables/outstanding'),
            },
            ...(perms.canSubmitPaymentProposal
              ? [{ id: 'submit', label: 'Submit for Approval', icon: Send, onClick: () => void handleSubmit() }]
              : []),
            ...(perms.canExport ? [{ id: 'export', label: 'Export', icon: FileSpreadsheet, onClick: () => void handleExport() }] : []),
            ...(perms.canCreatePayment
              ? [{
                  id: 'drafts',
                  label: 'Create Payment Drafts',
                  icon: Wand2,
                  onClick: () => void handleCreateDrafts(),
                }]
              : []),
            ...(perms.canAllocatePayment
              ? [{
                  id: 'allocations',
                  label: 'Invoice Allocation',
                  icon: HandCoins,
                  onClick: () => navigate('/accounting/payables/allocations'),
                }]
              : []),
            { id: 'refresh', label: 'Regenerate', icon: RefreshCw, onClick: () => void generatePreview() },
          ]}
        />
      }
    >
      <PayablesWorkspaceTabs active="payment_planning" />
      <PayablesCoreFlowStrip active="planning" className="mt-3" />

      <div className="mt-3 flex gap-1 border-b border-erp-border" role="tablist" aria-label="Planning workspace">
        {(
          [
            ['criteria', 'Selection Criteria'],
            ['proposed', 'Proposed Payments'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={workspace === id}
            className={cn(
              'border-b-2 px-3 py-2 text-[12px] font-semibold',
              workspace === id ? 'border-erp-primary text-erp-primary' : 'border-transparent text-erp-muted hover:text-erp-text',
            )}
            onClick={() => setWorkspace(id)}
          >
            {label}
            {id === 'proposed' && previewLines.length > 0 ? (
              <span className="ml-1.5 tabular-nums text-[11px] opacity-80">({previewLines.length})</span>
            ) : null}
          </button>
        ))}
      </div>

      {workspace === 'criteria' ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-erp-border p-4">
            <h3 className="mb-3 text-[13px] font-semibold">Payment criteria</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Proposed payment date *</label>
                <Input type="date" value={form.paymentDate} onChange={(e) => setField('paymentDate', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Pay from bank account</label>
                <Select value={form.bankAccountId} onChange={(e) => setField('bankAccountId', e.target.value)}>
                  <option value="">Any / not specified</option>
                  {lookups?.bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-[11px] text-erp-muted">Used when generating payment drafts (demo)</p>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Due date up to (days)</label>
                <Input
                  type="number"
                  min={0}
                  value={form.includeDueWithinDays}
                  onChange={(e) => setField('includeDueWithinDays', e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Available cash limit</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="No limit"
                  value={form.maxPaymentAmount}
                  onChange={(e) => setField('maxPaymentAmount', e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Prioritization</label>
                <Select value={form.priority} onChange={(e) => setField('priority', e.target.value as PaymentPlanningPriority)}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-erp-border p-4">
            <h3 className="mb-3 text-[13px] font-semibold">Include / exclude</h3>
            <div className="grid gap-2 text-[13px]">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 rounded border-erp-border" checked={form.includeOverdue} onChange={(e) => setField('includeOverdue', e.target.checked)} />
                Include overdue invoices
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 rounded border-erp-border" checked={form.msmePriority} onChange={(e) => setField('msmePriority', e.target.checked)} />
                MSME priority
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 rounded border-erp-border" checked={form.excludeOnHold} onChange={(e) => setField('excludeOnHold', e.target.checked)} />
                Exclude on-hold vendors / invoices
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 rounded border-erp-border" checked={form.excludeDisputed} onChange={(e) => setField('excludeDisputed', e.target.checked)} />
                Exclude disputed invoices
              </label>
              {perms.canApplyDebitNote ? (
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 rounded border-erp-border" checked={form.applyDebitNotes} onChange={(e) => setField('applyDebitNotes', e.target.checked)} />
                  Apply open debit notes (demo — not in preview)
                </label>
              ) : null}
              {perms.canApplyAdvance ? (
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 rounded border-erp-border" checked={form.applyAdvances} onChange={(e) => setField('applyAdvances', e.target.checked)} />
                  Apply vendor advances (demo — not in preview)
                </label>
              ) : null}
            </div>
            {(form.applyDebitNotes || form.applyAdvances) && (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                Debit note / advance netting is shown for planning only — amounts are not adjusted in the demo preview.
              </p>
            )}
          </section>

          <div className="lg:col-span-2 flex justify-end">
            <button
              type="button"
              className="erp-btn erp-btn-primary h-9 px-4 text-[13px]"
              disabled={generating}
              onClick={() => void generatePreview()}
            >
              <Play className="mr-1 inline h-4 w-4" />
              {generating ? 'Generating…' : 'Generate Preview'}
            </button>
          </div>
        </div>
      ) : null}

      {workspace === 'proposed' ? (
        <div className="mt-4 space-y-4">
          {!previewMeta ? (
            <EmptyState icon={Wand2} title="No preview yet" description="Configure criteria and generate a payment planning preview." />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ['Total proposed', formatCurrency(previewMeta.totalProposed)],
                  ['Selected', formatCurrency(selectedTotal)],
                  ['Vendors', String(previewMeta.vendorCount)],
                  ['Invoices', String(previewMeta.invoiceCount)],
                  ['MSME / Overdue', `${formatCurrency(previewMeta.msmeAmount)} / ${formatCurrency(previewMeta.overdueAmount)}`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-erp-border bg-erp-surface-alt/30 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase text-erp-muted">{label}</p>
                    <p className="text-[14px] font-semibold tabular-nums">{value}</p>
                  </div>
                ))}
              </div>

              {previewMeta.warnings.length > 0 ? (
                <ul className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                  {previewMeta.warnings.map((w) => (
                    <li key={w}>• {w}</li>
                  ))}
                </ul>
              ) : null}

              {generating ? <LoadingState variant="table" rows={4} /> : null}

              {vendorGroups.map((group) => (
                <section key={group.vendorId} className="rounded-lg border border-erp-border">
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-erp-border bg-erp-surface-alt/40 px-4 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-erp-border"
                        checked={group.lines.every((l) => l.selected)}
                        onChange={(e) => toggleVendor(group.vendorId, e.target.checked)}
                        aria-label={`Select all for ${group.vendorName}`}
                      />
                      <h3 className="text-[13px] font-semibold">{group.vendorName}</h3>
                    </div>
                    <span className="text-[12px] tabular-nums text-erp-muted">Selected {formatCurrency(group.total)}</span>
                  </header>
                  <div className="overflow-x-auto">
                    <table className="erp-table w-full min-w-[800px] text-[13px]">
                      <thead>
                        <tr className="text-[11px] uppercase text-erp-muted">
                          <th className="px-3 py-2 text-left">Select</th>
                          <th className="px-3 py-2 text-left">Invoice</th>
                          <th className="px-3 py-2 text-left">Due</th>
                          <th className="px-3 py-2 text-right">Outstanding</th>
                          <th className="px-3 py-2 text-right">Proposed</th>
                          <th className="px-3 py-2 text-left">Flags</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.lines.map((line) => (
                          <tr key={line.invoiceId} className="border-t border-erp-border/70">
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-erp-border"
                                checked={line.selected}
                                onChange={(e) => updateLine(line.invoiceId, { selected: e.target.checked })}
                              />
                            </td>
                            <td className="px-3 py-2">{line.invoiceNumber}</td>
                            <td className="px-3 py-2 tabular-nums">{line.dueDate}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(line.outstanding)}</td>
                            <td className="px-3 py-2 text-right">
                              <Input
                                type="number"
                                min={0}
                                max={line.outstanding}
                                step="0.01"
                                className="ml-auto max-w-[120px] text-right"
                                value={line.proposedAmount}
                                onChange={(e) =>
                                  updateLine(line.invoiceId, {
                                    proposedAmount: Math.min(line.outstanding, Math.max(0, Number(e.target.value) || 0)),
                                  })
                                }
                              />
                            </td>
                            <td className="px-3 py-2 text-[11px] text-erp-muted">
                              {line.msmeVendor ? 'MSME ' : ''}
                              {line.overdueDays > 0 ? `${line.overdueDays}d overdue ` : ''}
                              {line.paymentHold ? 'Hold' : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}

              <p className="text-[12px] text-erp-muted">
                Create Payment Drafts generates demo vendor payment records only — no bank file or NEFT/RTGS disbursement is sent.
              </p>
            </>
          )}
        </div>
      ) : null}
    </OperationalPageShell>
  )
}
