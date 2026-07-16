import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw, Save, ShieldOff, Trash2 } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { PayablesWorkspaceTabs } from '@/components/accounting/payables'
import { getPayablesSetup, PayablesServiceError, updatePayablesSetupDemo } from '@/services/accounting/payablesService'
import type { PayablesSetup } from '@/types/payables'
import { PAYABLES_PERMISSIONS, usePayablesPermissions } from '@/utils/permissions/payables'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

type SetupTabId =
  | 'general'
  | 'number_series'
  | 'payment_controls'
  | 'payment_proposal'
  | 'allocation'
  | 'tds'
  | 'msme'
  | 'payment_holds'
  | 'bank_verification'
  | 'approval'
  | 'notifications'
  | 'permissions'

const SETUP_TABS: { id: SetupTabId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'number_series', label: 'Number Series' },
  { id: 'payment_controls', label: 'Payment Controls' },
  { id: 'payment_proposal', label: 'Payment Proposal' },
  { id: 'allocation', label: 'Allocation' },
  { id: 'tds', label: 'TDS' },
  { id: 'msme', label: 'MSME' },
  { id: 'payment_holds', label: 'Payment Holds' },
  { id: 'bank_verification', label: 'Bank Verification' },
  { id: 'approval', label: 'Approval' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'permissions', label: 'Permissions' },
]

interface NumberSeriesRow {
  id: string
  document: string
  prefix: string
  nextNumber: number
  padding: number
}

interface MsmeThresholdRow {
  id: string
  category: string
  investmentLimitCr: number
  turnoverLimitCr: number
  paymentDueDays: number
  effectiveFrom: string
}

interface ExtendedSetup {
  numberSeries: NumberSeriesRow[]
  blockPaymentOnMatchFailure: boolean
  allowPartialPayments: boolean
  proposalAutoSelectOverdue: boolean
  proposalMaxVendorsPerRun: number
  allocationFifoByDueDate: boolean
  allocationAllowManualOverride: boolean
  holdAutoOnDispute: boolean
  holdReviewDays: number
  bankReverifyOnChange: boolean
  bankBlockPaymentIfUnverified: boolean
  msmeThresholds: MsmeThresholdRow[]
}

const DEFAULT_EXTENDED: ExtendedSetup = {
  numberSeries: [
    { id: 'ns-1', document: 'Payment Proposal', prefix: 'PP-', nextNumber: 120, padding: 5 },
    { id: 'ns-2', document: 'Vendor Payment', prefix: 'PAY-', nextNumber: 8840, padding: 5 },
    { id: 'ns-3', document: 'Debit Note', prefix: 'DN-', nextNumber: 45, padding: 5 },
    { id: 'ns-4', document: 'Vendor Advance', prefix: 'ADV-', nextNumber: 18, padding: 5 },
  ],
  blockPaymentOnMatchFailure: true,
  allowPartialPayments: true,
  proposalAutoSelectOverdue: true,
  proposalMaxVendorsPerRun: 25,
  allocationFifoByDueDate: true,
  allocationAllowManualOverride: true,
  holdAutoOnDispute: true,
  holdReviewDays: 7,
  bankReverifyOnChange: true,
  bankBlockPaymentIfUnverified: true,
  msmeThresholds: [
    { id: 'msme-1', category: 'Micro', investmentLimitCr: 1, turnoverLimitCr: 5, paymentDueDays: 45, effectiveFrom: '2024-04-01' },
    { id: 'msme-2', category: 'Small', investmentLimitCr: 10, turnoverLimitCr: 50, paymentDueDays: 45, effectiveFrom: '2024-04-01' },
    { id: 'msme-3', category: 'Medium', investmentLimitCr: 50, turnoverLimitCr: 250, paymentDueDays: 45, effectiveFrom: '2024-04-01' },
  ],
}

const inputCls =
  'mt-1 h-9 w-full rounded-md border border-erp-border bg-white px-2.5 text-[13px] text-erp-text'
const labelCls = 'block text-[12px] font-medium text-erp-text'

const PERMISSION_ROLES = [
  { role: 'accounts_head', label: 'Accounts Head', grants: 'Full payables access' },
  { role: 'accounts_user', label: 'Accounts User', grants: 'Payments, proposals, allocations — no reverse' },
  { role: 'purchase_head', label: 'Purchase Head', grants: 'View + disputes + reports' },
  { role: 'purchase_user', label: 'Purchase User', grants: 'View invoices + manage disputes' },
  { role: 'auditor', label: 'Auditor', grants: 'Read-only registers, export, audit' },
]

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-erp-border p-4">
      <div className="mb-3">
        <h2 className="text-[15px] font-semibold text-erp-text">{title}</h2>
        {description ? <p className="mt-0.5 text-[12px] text-erp-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="flex items-start gap-3 rounded-md border border-erp-border/70 px-3 py-2.5">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-erp-border"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>
        <span className="block text-[13px] font-medium text-erp-text">{label}</span>
        {hint ? <span className="block text-[11px] text-erp-muted">{hint}</span> : null}
      </span>
    </label>
  )
}

export function PayablesSetupPage() {
  const perms = usePayablesPermissions()
  const [setup, setSetup] = useState<PayablesSetup | null>(null)
  const [extended, setExtended] = useState<ExtendedSetup>(DEFAULT_EXTENDED)
  const [tab, setTab] = useState<SetupTabId>('general')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSetup(await getPayablesSetup())
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Failed to load setup')
      setSetup(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    if (!setup) return
    if (!perms.canManageSetup) {
      notify.error('You do not have permission to manage payables setup.')
      return
    }
    setSaving(true)
    try {
      const updated = await updatePayablesSetupDemo({
        general: setup.general,
        approval: setup.approval,
        tds: setup.tds,
        notifications: setup.notifications,
      })
      setSetup(updated)
      notify.success('Settings saved (session demo only)')
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const addMsmeRow = () => {
    setExtended((x) => ({
      ...x,
      msmeThresholds: [
        ...x.msmeThresholds,
        {
          id: crypto.randomUUID(),
          category: 'New category',
          investmentLimitCr: 0,
          turnoverLimitCr: 0,
          paymentDueDays: setup?.general.msmePaymentDays ?? 45,
          effectiveFrom: new Date().toISOString().slice(0, 10),
        },
      ],
    }))
  }

  const removeMsmeRow = (id: string) => {
    setExtended((x) => ({ ...x, msmeThresholds: x.msmeThresholds.filter((r) => r.id !== id) }))
  }

  if (!perms.canView) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Payables Setup"
        breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Setup' }]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ShieldOff} title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Payables Setup"
      description="Configure payables behaviour — session demo only, not persisted to backend."
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Payables', to: '/accounting/payables' },
        { label: 'Setup' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/payables/setup"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canManageSetup
              ? { id: 'save', label: saving ? 'Saving…' : 'Save', icon: Save, onClick: () => void save() }
              : undefined
          }
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      <PayablesWorkspaceTabs active="setup" />
      <div className="mt-3 flex flex-wrap gap-1 border-b border-erp-border pb-2">
        {SETUP_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cn(
              'rounded-md px-2.5 py-1.5 text-[12px] font-medium',
              tab === t.id ? 'bg-sky-50 text-sky-900 ring-1 ring-sky-300' : 'text-erp-muted hover:text-erp-text',
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-4">
          <LoadingState variant="form" rows={8} />
        </div>
      ) : null}

      {!loading && !setup ? (
        <div className="mt-4">
          <EmptyState icon={ShieldOff} title="Setup unavailable" />
        </div>
      ) : null}

      {!loading && setup ? (
        <div className="mt-4 space-y-4">
          {tab === 'general' ? (
            <SectionCard title="General" description="Default terms and three-way match tolerances.">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <label className={labelCls}>
                  Default payment terms (days)
                  <input
                    type="number"
                    className={inputCls}
                    value={setup.general.defaultPaymentTerms}
                    onChange={(e) =>
                      setSetup((s) => s && { ...s, general: { ...s.general, defaultPaymentTerms: Number(e.target.value) } })
                    }
                    disabled={!perms.canManageSetup}
                  />
                </label>
                <label className={labelCls}>
                  Auto-match tolerance (%)
                  <input
                    type="number"
                    step="0.1"
                    className={inputCls}
                    value={setup.general.autoMatchTolerancePercent}
                    onChange={(e) =>
                      setSetup((s) => s && { ...s, general: { ...s.general, autoMatchTolerancePercent: Number(e.target.value) } })
                    }
                    disabled={!perms.canManageSetup}
                  />
                </label>
                <label className={labelCls}>
                  Auto-match tolerance (₹)
                  <input
                    type="number"
                    className={inputCls}
                    value={setup.general.autoMatchToleranceAmount}
                    onChange={(e) =>
                      setSetup((s) => s && { ...s, general: { ...s.general, autoMatchToleranceAmount: Number(e.target.value) } })
                    }
                    disabled={!perms.canManageSetup}
                  />
                </label>
              </div>
              <div className="mt-3 space-y-2">
                <ToggleRow
                  label="Require three-way match"
                  checked={setup.general.requireThreeWayMatch}
                  onChange={(v) => setSetup((s) => s && { ...s, general: { ...s.general, requireThreeWayMatch: v } })}
                  disabled={!perms.canManageSetup}
                />
                <ToggleRow
                  label="Block payment without GRN"
                  checked={setup.general.blockPaymentWithoutGrn}
                  onChange={(v) => setSetup((s) => s && { ...s, general: { ...s.general, blockPaymentWithoutGrn: v } })}
                  disabled={!perms.canManageSetup}
                />
              </div>
            </SectionCard>
          ) : null}

          {tab === 'number_series' ? (
            <SectionCard title="Number series" description="Document numbering prefixes — demo configuration.">
              <div className="overflow-x-auto">
                <table className="erp-table w-full min-w-[640px] text-[13px]">
                  <thead>
                    <tr className="border-b bg-erp-surface-alt/60 text-[11px] uppercase text-erp-muted">
                      <th className="px-3 py-2 text-left">Document</th>
                      <th className="px-3 py-2 text-left">Prefix</th>
                      <th className="px-3 py-2 text-right">Next no.</th>
                      <th className="px-3 py-2 text-right">Padding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extended.numberSeries.map((row, idx) => (
                      <tr key={row.id} className="border-b border-erp-border/70">
                        <td className="px-3 py-2">{row.document}</td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            className="h-8 w-full rounded border border-erp-border px-2 text-[12px]"
                            value={row.prefix}
                            onChange={(e) => {
                              const prefix = e.target.value
                              setExtended((x) => ({
                                ...x,
                                numberSeries: x.numberSeries.map((r, i) => (i === idx ? { ...r, prefix } : r)),
                              }))
                            }}
                            disabled={!perms.canManageSetup}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            className="h-8 w-24 rounded border border-erp-border px-2 text-right text-[12px]"
                            value={row.nextNumber}
                            onChange={(e) => {
                              const nextNumber = Number(e.target.value)
                              setExtended((x) => ({
                                ...x,
                                numberSeries: x.numberSeries.map((r, i) => (i === idx ? { ...r, nextNumber } : r)),
                              }))
                            }}
                            disabled={!perms.canManageSetup}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            className="h-8 w-16 rounded border border-erp-border px-2 text-right text-[12px]"
                            value={row.padding}
                            onChange={(e) => {
                              const padding = Number(e.target.value)
                              setExtended((x) => ({
                                ...x,
                                numberSeries: x.numberSeries.map((r, i) => (i === idx ? { ...r, padding } : r)),
                              }))
                            }}
                            disabled={!perms.canManageSetup}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          ) : null}

          {tab === 'payment_controls' ? (
            <SectionCard title="Payment controls" description="Gating rules before vendor disbursement.">
              <div className="space-y-2">
                <ToggleRow
                  label="Block payment on match failure"
                  checked={extended.blockPaymentOnMatchFailure}
                  onChange={(v) => setExtended((x) => ({ ...x, blockPaymentOnMatchFailure: v }))}
                  disabled={!perms.canManageSetup}
                />
                <ToggleRow
                  label="Allow partial payments"
                  checked={extended.allowPartialPayments}
                  onChange={(v) => setExtended((x) => ({ ...x, allowPartialPayments: v }))}
                  disabled={!perms.canManageSetup}
                />
                <ToggleRow
                  label="Bank verification required"
                  checked={setup.approval.bankVerificationRequired}
                  onChange={(v) => setSetup((s) => s && { ...s, approval: { ...s.approval, bankVerificationRequired: v } })}
                  disabled={!perms.canManageSetup}
                />
              </div>
            </SectionCard>
          ) : null}

          {tab === 'payment_proposal' ? (
            <SectionCard title="Payment proposal" description="Batch payment planning defaults.">
              <div className="space-y-2">
                <ToggleRow
                  label="Proposal approval required"
                  checked={setup.approval.paymentProposalApprovalRequired}
                  onChange={(v) =>
                    setSetup((s) => s && { ...s, approval: { ...s.approval, paymentProposalApprovalRequired: v } })
                  }
                  disabled={!perms.canManageSetup}
                />
                <ToggleRow
                  label="Auto-select overdue invoices in planning"
                  checked={extended.proposalAutoSelectOverdue}
                  onChange={(v) => setExtended((x) => ({ ...x, proposalAutoSelectOverdue: v }))}
                  disabled={!perms.canManageSetup}
                />
                <label className={labelCls}>
                  Max vendors per proposal run
                  <input
                    type="number"
                    className={inputCls}
                    value={extended.proposalMaxVendorsPerRun}
                    onChange={(e) => setExtended((x) => ({ ...x, proposalMaxVendorsPerRun: Number(e.target.value) }))}
                    disabled={!perms.canManageSetup}
                  />
                </label>
              </div>
            </SectionCard>
          ) : null}

          {tab === 'allocation' ? (
            <SectionCard title="Allocation" description="Payment-to-invoice allocation behaviour.">
              <div className="space-y-2">
                <ToggleRow
                  label="FIFO by due date"
                  hint="Suggest oldest due invoices first during auto-allocation."
                  checked={extended.allocationFifoByDueDate}
                  onChange={(v) => setExtended((x) => ({ ...x, allocationFifoByDueDate: v }))}
                  disabled={!perms.canManageSetup}
                />
                <ToggleRow
                  label="Allow manual override"
                  checked={extended.allocationAllowManualOverride}
                  onChange={(v) => setExtended((x) => ({ ...x, allocationAllowManualOverride: v }))}
                  disabled={!perms.canManageSetup}
                />
              </div>
            </SectionCard>
          ) : null}

          {tab === 'tds' ? (
            <SectionCard title="TDS" description="Tax deduction at source on vendor payments.">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelCls}>
                  Default TDS section
                  <input
                    type="text"
                    className={inputCls}
                    value={setup.tds.defaultTdsSection}
                    onChange={(e) => setSetup((s) => s && { ...s, tds: { ...s.tds, defaultTdsSection: e.target.value } })}
                    disabled={!perms.canManageSetup}
                  />
                </label>
                <label className={labelCls}>
                  TDS threshold (₹)
                  <input
                    type="number"
                    className={inputCls}
                    value={setup.tds.tdsThresholdAmount}
                    onChange={(e) =>
                      setSetup((s) => s && { ...s, tds: { ...s.tds, tdsThresholdAmount: Number(e.target.value) } })
                    }
                    disabled={!perms.canManageSetup}
                  />
                </label>
              </div>
              <div className="mt-3 space-y-2">
                <ToggleRow
                  label="Auto-calculate TDS"
                  checked={setup.tds.autoCalculateTds}
                  onChange={(v) => setSetup((s) => s && { ...s, tds: { ...s.tds, autoCalculateTds: v } })}
                  disabled={!perms.canManageSetup}
                />
                <ToggleRow
                  label="Show TDS on payment advice"
                  checked={setup.tds.showTdsOnPaymentAdvice}
                  onChange={(v) => setSetup((s) => s && { ...s, tds: { ...s.tds, showTdsOnPaymentAdvice: v } })}
                  disabled={!perms.canManageSetup}
                />
              </div>
            </SectionCard>
          ) : null}

          {tab === 'msme' ? (
            <SectionCard
              title="MSME configuration"
              description="Configurable category thresholds and payment due days with effective dates — not hardcoded statutory limits."
            >
              <div className="mb-4 space-y-2">
                <ToggleRow
                  label="MSME priority in payment planning"
                  checked={setup.general.msmePriorityEnabled}
                  onChange={(v) => setSetup((s) => s && { ...s, general: { ...s.general, msmePriorityEnabled: v } })}
                  disabled={!perms.canManageSetup}
                />
                <label className={labelCls}>
                  Default MSME payment due days
                  <input
                    type="number"
                    className={inputCls}
                    value={setup.general.msmePaymentDays}
                    onChange={(e) =>
                      setSetup((s) => s && { ...s, general: { ...s.general, msmePaymentDays: Number(e.target.value) } })
                    }
                    disabled={!perms.canManageSetup}
                  />
                </label>
              </div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold">Category thresholds</h3>
                {perms.canManageSetup ? (
                  <button type="button" className="erp-btn erp-btn-ghost h-8 px-2 text-[12px]" onClick={addMsmeRow}>
                    <Plus className="mr-1 inline h-3.5 w-3.5" />
                    Add row
                  </button>
                ) : null}
              </div>
              <div className="overflow-x-auto">
                <table className="erp-table w-full min-w-[760px] text-[13px]">
                  <thead>
                    <tr className="border-b bg-erp-surface-alt/60 text-[11px] uppercase text-erp-muted">
                      <th className="px-3 py-2 text-left">Category</th>
                      <th className="px-3 py-2 text-right">Investment limit (₹ Cr)</th>
                      <th className="px-3 py-2 text-right">Turnover limit (₹ Cr)</th>
                      <th className="px-3 py-2 text-right">Payment due days</th>
                      <th className="px-3 py-2 text-left">Effective from</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {extended.msmeThresholds.map((row, idx) => (
                      <tr key={row.id} className="border-b border-erp-border/70">
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            className="h-8 w-full rounded border border-erp-border px-2 text-[12px]"
                            value={row.category}
                            onChange={(e) => {
                              const category = e.target.value
                              setExtended((x) => ({
                                ...x,
                                msmeThresholds: x.msmeThresholds.map((r, i) => (i === idx ? { ...r, category } : r)),
                              }))
                            }}
                            disabled={!perms.canManageSetup}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            className="h-8 w-full rounded border border-erp-border px-2 text-right text-[12px]"
                            value={row.investmentLimitCr}
                            onChange={(e) => {
                              const investmentLimitCr = Number(e.target.value)
                              setExtended((x) => ({
                                ...x,
                                msmeThresholds: x.msmeThresholds.map((r, i) => (i === idx ? { ...r, investmentLimitCr } : r)),
                              }))
                            }}
                            disabled={!perms.canManageSetup}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            className="h-8 w-full rounded border border-erp-border px-2 text-right text-[12px]"
                            value={row.turnoverLimitCr}
                            onChange={(e) => {
                              const turnoverLimitCr = Number(e.target.value)
                              setExtended((x) => ({
                                ...x,
                                msmeThresholds: x.msmeThresholds.map((r, i) => (i === idx ? { ...r, turnoverLimitCr } : r)),
                              }))
                            }}
                            disabled={!perms.canManageSetup}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            className="h-8 w-full rounded border border-erp-border px-2 text-right text-[12px]"
                            value={row.paymentDueDays}
                            onChange={(e) => {
                              const paymentDueDays = Number(e.target.value)
                              setExtended((x) => ({
                                ...x,
                                msmeThresholds: x.msmeThresholds.map((r, i) => (i === idx ? { ...r, paymentDueDays } : r)),
                              }))
                            }}
                            disabled={!perms.canManageSetup}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            className="h-8 w-full rounded border border-erp-border px-2 text-[12px]"
                            value={row.effectiveFrom}
                            onChange={(e) => {
                              const effectiveFrom = e.target.value
                              setExtended((x) => ({
                                ...x,
                                msmeThresholds: x.msmeThresholds.map((r, i) => (i === idx ? { ...r, effectiveFrom } : r)),
                              }))
                            }}
                            disabled={!perms.canManageSetup}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          {perms.canManageSetup && extended.msmeThresholds.length > 1 ? (
                            <button type="button" className="text-red-600 hover:underline" onClick={() => removeMsmeRow(row.id)}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-erp-muted">
                Threshold values are tenant-configurable. Update effective dates when MSME notification rules change.
              </p>
            </SectionCard>
          ) : null}

          {tab === 'payment_holds' ? (
            <SectionCard title="Payment holds" description="Automatic and review rules for vendor payment blocks.">
              <div className="space-y-2">
                <ToggleRow
                  label="Auto-hold on new dispute"
                  checked={extended.holdAutoOnDispute}
                  onChange={(v) => setExtended((x) => ({ ...x, holdAutoOnDispute: v }))}
                  disabled={!perms.canManageSetup}
                />
                <label className={labelCls}>
                  Hold review interval (days)
                  <input
                    type="number"
                    className={inputCls}
                    value={extended.holdReviewDays}
                    onChange={(e) => setExtended((x) => ({ ...x, holdReviewDays: Number(e.target.value) }))}
                    disabled={!perms.canManageSetup}
                  />
                </label>
              </div>
            </SectionCard>
          ) : null}

          {tab === 'bank_verification' ? (
            <SectionCard title="Bank verification" description="Controls before releasing vendor bank disbursements.">
              <div className="space-y-2">
                <ToggleRow
                  label="Re-verify on bank detail change"
                  checked={extended.bankReverifyOnChange}
                  onChange={(v) => setExtended((x) => ({ ...x, bankReverifyOnChange: v }))}
                  disabled={!perms.canManageSetup}
                />
                <ToggleRow
                  label="Block payment if bank unverified"
                  checked={extended.bankBlockPaymentIfUnverified}
                  onChange={(v) => setExtended((x) => ({ ...x, bankBlockPaymentIfUnverified: v }))}
                  disabled={!perms.canManageSetup}
                />
              </div>
            </SectionCard>
          ) : null}

          {tab === 'approval' ? (
            <SectionCard title="Approval" description="Payment and debit note approval thresholds.">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelCls}>
                  Payment approval threshold (₹)
                  <input
                    type="number"
                    className={inputCls}
                    value={setup.approval.paymentApprovalThreshold}
                    onChange={(e) =>
                      setSetup((s) =>
                        s ? { ...s, approval: { ...s.approval, paymentApprovalThreshold: Number(e.target.value) } } : s,
                      )
                    }
                    disabled={!perms.canManageSetup}
                  />
                </label>
              </div>
              <div className="mt-3 space-y-2">
                <ToggleRow
                  label="Payment approval required"
                  checked={setup.approval.paymentApprovalRequired}
                  onChange={(v) => setSetup((s) => s && { ...s, approval: { ...s.approval, paymentApprovalRequired: v } })}
                  disabled={!perms.canManageSetup}
                />
                <ToggleRow
                  label="Debit note approval required"
                  checked={setup.approval.debitNoteApprovalRequired}
                  onChange={(v) => setSetup((s) => s && { ...s, approval: { ...s.approval, debitNoteApprovalRequired: v } })}
                  disabled={!perms.canManageSetup}
                />
              </div>
            </SectionCard>
          ) : null}

          {tab === 'notifications' ? (
            <SectionCard title="Notifications" description="Alert triggers for payables operations.">
              <div className="space-y-2">
                <ToggleRow
                  label="Notify on overdue invoices"
                  checked={setup.notifications.notifyOnOverdue}
                  onChange={(v) =>
                    setSetup((s) => s && { ...s, notifications: { ...s.notifications, notifyOnOverdue: v } })
                  }
                  disabled={!perms.canManageSetup}
                />
                <ToggleRow
                  label="Notify on proposal pending approval"
                  checked={setup.notifications.notifyOnProposalPending}
                  onChange={(v) =>
                    setSetup((s) => s && { ...s, notifications: { ...s.notifications, notifyOnProposalPending: v } })
                  }
                  disabled={!perms.canManageSetup}
                />
                <ToggleRow
                  label="Notify on bank detail change"
                  checked={setup.notifications.notifyOnBankChange}
                  onChange={(v) =>
                    setSetup((s) => s && { ...s, notifications: { ...s.notifications, notifyOnBankChange: v } })
                  }
                  disabled={!perms.canManageSetup}
                />
                <ToggleRow
                  label="Notify on MSME payment due"
                  checked={setup.notifications.notifyOnMsmeDue}
                  onChange={(v) =>
                    setSetup((s) => s && { ...s, notifications: { ...s.notifications, notifyOnMsmeDue: v } })
                  }
                  disabled={!perms.canManageSetup}
                />
              </div>
            </SectionCard>
          ) : null}

          {tab === 'permissions' ? (
            <SectionCard title="Permissions" description="Role packs for payables — enforced on backend when API is connected.">
              <div className="mb-4 overflow-x-auto">
                <table className="erp-table w-full min-w-[520px] text-[13px]">
                  <thead>
                    <tr className="border-b bg-erp-surface-alt/60 text-[11px] uppercase text-erp-muted">
                      <th className="px-3 py-2 text-left">Role</th>
                      <th className="px-3 py-2 text-left">Access summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSION_ROLES.map((r) => (
                      <tr key={r.role} className="border-b border-erp-border/70">
                        <td className="px-3 py-2 font-medium">{r.label}</td>
                        <td className="px-3 py-2 text-erp-muted">{r.grants}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mb-2 text-[12px] font-semibold text-erp-text">Payables permission keys ({PAYABLES_PERMISSIONS.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {PAYABLES_PERMISSIONS.map((p) => (
                  <span key={p} className="rounded bg-erp-surface-alt px-2 py-0.5 font-mono text-[10px] text-erp-muted">
                    {p}
                  </span>
                ))}
              </div>
            </SectionCard>
          ) : null}

          {setup.lastUpdatedAt ? (
            <p className="text-[11px] text-erp-muted">
              Last updated by {setup.lastUpdatedBy ?? '—'} · {setup.lastUpdatedAt}
            </p>
          ) : null}
        </div>
      ) : null}
    </OperationalPageShell>
  )
}
