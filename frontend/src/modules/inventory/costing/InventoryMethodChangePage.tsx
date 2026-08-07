/**
 * Valuation method change wizard — readiness → preview → confirm → execute.
 */
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { Button } from '@/design-system/components/Button'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import {
  fetchEffectiveValuationMethod,
  fetchMethodChangePreview,
  postValuationMethodChange,
  type MethodChangeResultDto,
} from '@/services/api/inventoryCostingApi'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { InventoryCostingShell } from './InventoryCostingShell'
import { inventoryCostingPaths } from './inventoryCostingPaths'
import { methodLabel } from './costingDemoData'
import { appConfirm } from '@/store/confirmDialogStore'

const METHODS = [
  { value: 'fifo', label: 'FIFO' },
  { value: 'average', label: 'Moving weighted average' },
  { value: 'standard', label: 'Standard cost' },
  { value: 'specific', label: 'Specific identification' },
] as const

type PreviewDto = Awaited<ReturnType<typeof fetchMethodChangePreview>>['data']

export function InventoryMethodChangePage() {
  const perms = useInventoryPermissions()
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<MethodChangeResultDto | null>(null)
  const [currentMethod, setCurrentMethod] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewDto | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [form, setForm] = useState({
    toMethod: '' as '' | 'fifo' | 'average' | 'standard' | 'specific',
    effectiveDate: new Date().toISOString().slice(0, 10),
    reason: '',
    runOpeningMigration: true,
    force: false,
  })

  useEffect(() => {
    void fetchEffectiveValuationMethod()
      .then((res) => setCurrentMethod(String(res.data.method)))
      .catch(() => setCurrentMethod(null))
  }, [])

  async function loadPreview() {
    if (!form.toMethod) return
    setBusy(true)
    setPreviewError(null)
    try {
      const res = await fetchMethodChangePreview({
        toMethod: form.toMethod,
        effectiveDate: form.effectiveDate || undefined,
      })
      setPreview(res.data)
      setStep(2)
    } catch (err) {
      setPreview(null)
      setPreviewError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setBusy(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!perms.canManageSetup) {
      notify.error('inventory.setup.manage required to execute method change')
      return
    }
    if (!form.toMethod || form.reason.trim().length < 3) {
      notify.error('Select a target method and provide a reason')
      return
    }
    if (preview?.readiness === 'BLOCKED' && !form.force) {
      notify.error('Resolve readiness blockers or enable Force with audit reason')
      return
    }
    const ok = await appConfirm({
      title: 'Change valuation method?',
      description: `Switch default costing to ${METHODS.find((m) => m.value === form.toMethod)?.label}. Historical cost entries are not rewritten. Readiness: ${preview?.readiness ?? 'unknown'}.`,
      confirmLabel: 'Execute change',
    })
    if (!ok) return

    setBusy(true)
    try {
      const res = await postValuationMethodChange({
        toMethod: form.toMethod,
        effectiveDate: form.effectiveDate || undefined,
        reason: form.reason.trim(),
        force: form.force,
        runOpeningMigration: form.runOpeningMigration,
      })
      setResult(res.data)
      setStep(4)
      notify.success('Valuation method updated')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Method change failed')
    } finally {
      setBusy(false)
    }
  }

  const readinessTone =
    preview?.readiness === 'BLOCKED' ? 'critical' : preview?.readiness === 'WARNING' ? 'warning' : 'success'

  return (
    <InventoryCostingShell title="Method Change" favoritePath={inventoryCostingPaths.methodChange}>
      <div className="p-4">
        {currentMethod ? (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-erp-border bg-erp-surface/40 px-3 py-2 text-[13px]">
            <span className="text-erp-muted">Current method</span>
            <DynamicsStatusChip label={methodLabel(currentMethod)} tone="info" />
            <span className="text-[11px] text-erp-muted">
              Change only via this wizard — not a silent settings toggle.
            </span>
          </div>
        ) : null}
        {!perms.canManageSetup ? (
          <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
            Preview is available with costing view permission. Execute requires{' '}
            <code className="text-[12px]">inventory.setup.manage</code>.
          </p>
        ) : null}

        <ol className="mb-4 flex flex-wrap gap-2 text-[12px]">
          {[
            { n: 1, label: 'Select' },
            { n: 2, label: 'Readiness & preview' },
            { n: 3, label: 'Approve & execute' },
            { n: 4, label: 'Result' },
          ].map((s) => (
            <li
              key={s.n}
              className={`rounded-full px-3 py-1 ${step === s.n ? 'bg-erp-primary text-white' : 'bg-erp-surface text-erp-muted'}`}
            >
              {s.n}. {s.label}
            </li>
          ))}
        </ol>

        {step === 1 ? (
          <div className="max-w-lg space-y-3 rounded-md border border-erp-border p-4">
            <label className="block text-[12px]">
              <span className="text-erp-muted">Target method</span>
              <Select
                className="mt-1"
                value={form.toMethod}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    toMethod: e.target.value as typeof form.toMethod,
                  }))
                }
              >
                <option value="">{SELECT_PLACEHOLDER}</option>
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block text-[12px]">
              <span className="text-erp-muted">Effective date</span>
              <Input
                type="date"
                className="mt-1"
                value={form.effectiveDate}
                onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))}
              />
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={form.runOpeningMigration}
                onChange={(e) => setForm((f) => ({ ...f, runOpeningMigration: e.target.checked }))}
              />
              Run opening-stock layer migration when switching to FIFO or Specific identification
            </label>
            {previewError ? <p className="text-[13px] text-rose-700">{previewError}</p> : null}
            <Button size="sm" disabled={!form.toMethod || busy} onClick={() => void loadPreview()}>
              {busy ? 'Loading preview…' : 'Continue to readiness'}
            </Button>
          </div>
        ) : null}

        {step === 2 && preview ? (
          <div className="max-w-2xl space-y-4 rounded-md border border-erp-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px]">
                {methodLabel(preview.fromMethod)} → <strong>{methodLabel(preview.toMethod)}</strong>
              </span>
              <DynamicsStatusChip label={preview.readiness} tone={readinessTone} />
            </div>
            <div className="grid gap-2 text-[13px] sm:grid-cols-2">
              <div>
                Affected balances: <strong>{preview.preview.affectedItems}</strong>
              </div>
              <div>
                On-hand qty: <strong className="tabular-nums">{preview.preview.onHandQty.toLocaleString()}</strong>
              </div>
              <div>
                Current inventory value:{' '}
                <strong className="tabular-nums">{formatCurrency(preview.preview.currentInventoryValue)}</strong>
              </div>
              <div>
                Proposed opening value:{' '}
                <strong className="tabular-nums">{formatCurrency(preview.preview.proposedOpeningValue)}</strong>
              </div>
              <div>
                Expected difference:{' '}
                <strong className="tabular-nums">{formatCurrency(preview.preview.expectedDifference)}</strong>
              </div>
              <div>
                GL impact: <strong>{preview.financialDifference.glImpact}</strong>
              </div>
            </div>
            <p className="text-[12px] text-erp-muted">{preview.preview.note}</p>
            <p className="text-[12px] text-erp-muted">{preview.financialDifference.glImpactReason}</p>
            <div>
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Checks</h4>
              <ul className="space-y-1 text-[12px]">
                {preview.checks.map((c) => (
                  <li key={c.code} className="flex flex-wrap items-start gap-2">
                    <DynamicsStatusChip
                      label={c.severity}
                      tone={c.severity === 'BLOCKED' ? 'critical' : c.severity === 'WARNING' ? 'warning' : 'success'}
                    />
                    <span>
                      <code className="text-[11px]">{c.code}</code> — {c.message}
                    </span>
                  </li>
                ))}
                {preview.checks.length === 0 ? (
                  <li className="text-erp-muted">No readiness issues reported.</li>
                ) : null}
              </ul>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button size="sm" onClick={() => setStep(3)}>
                Continue
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <form className="max-w-lg space-y-3 rounded-md border border-erp-border p-4" onSubmit={onSubmit}>
            <p className="text-[13px]">
              Changing to <strong>{METHODS.find((m) => m.value === form.toMethod)?.label}</strong> effective{' '}
              {form.effectiveDate}. Readiness: <strong>{preview?.readiness ?? '-'}</strong>.
            </p>
            <label className="block text-[12px]">
              <span className="text-erp-muted">Reason (required)</span>
              <Textarea
                className="mt-1"
                rows={3}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Policy / audit reason…"
              />
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={form.force}
                onChange={(e) => setForm((f) => ({ ...f, force: e.target.checked }))}
              />
              Force (override BLOCKED readiness / soft policy gates — audit required)
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button type="submit" size="sm" disabled={busy || !perms.canManageSetup}>
                {busy ? 'Applying…' : 'Execute method change'}
              </Button>
            </div>
          </form>
        ) : null}

        {step === 4 && result ? (
          <div className="max-w-lg space-y-3 rounded-md border border-emerald-200 bg-emerald-50/50 p-4 text-[13px]">
            <p>
              Changed <strong>{methodLabel(String(result.fromMethod))}</strong> →{' '}
              <strong>{methodLabel(String(result.toMethod))}</strong> effective {result.effectiveDate}.
            </p>
            {result.openingMigrationRequired ? (
              <p>
                Opening migration:{' '}
                {result.openingMigrationCompleted ? 'completed' : 'incomplete / exceptions'}{' '}
                {result.migration
                  ? `(layers ${result.migration.createdLayers}, skipped ${result.migration.skipped}, exceptions ${result.migration.exceptions})`
                  : null}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Link to={inventoryCostingPaths.summary} className="font-semibold text-erp-primary hover:underline">
                Overview
              </Link>
              <Link
                to={inventoryCostingPaths.reconciliation}
                className="font-semibold text-erp-primary hover:underline"
              >
                Reconciliation
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </InventoryCostingShell>
  )
}
