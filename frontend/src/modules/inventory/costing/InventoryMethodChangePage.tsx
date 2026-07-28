/**
 * Valuation method change wizard — policy update + optional FIFO opening migration.
 */
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { Button } from '@/design-system/components/Button'
import { isApiMode } from '@/config/apiConfig'
import { postValuationMethodChange, type MethodChangeResultDto } from '@/services/api/inventoryCostingApi'
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

export function InventoryMethodChangePage() {
  const api = isApiMode()
  const perms = useInventoryPermissions()
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<MethodChangeResultDto | null>(null)
  const [form, setForm] = useState({
    toMethod: '' as '' | 'fifo' | 'average' | 'standard' | 'specific',
    effectiveDate: new Date().toISOString().slice(0, 10),
    reason: '',
    runOpeningMigration: true,
    force: false,
  })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!api) {
      notify.info('Method change requires API mode')
      return
    }
    if (!perms.canManageSetup) {
      notify.error('inventory.setup.manage required')
      return
    }
    if (!form.toMethod || form.reason.trim().length < 3) {
      notify.error('Select a target method and provide a reason')
      return
    }
    const ok = await appConfirm({
      title: 'Change valuation method?',
      description: `Switch default costing to ${METHODS.find((m) => m.value === form.toMethod)?.label}. This updates inventory policy${form.runOpeningMigration && (form.toMethod === 'fifo' || form.toMethod === 'specific') ? ' and may create opening cost layers' : ''}.`,
      confirmLabel: 'Change method',
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
      setStep(3)
      notify.success('Valuation method updated')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Method change failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <InventoryCostingShell
      title="Method Change"
      favoritePath={inventoryCostingPaths.methodChange}
    >
      <div className="p-4">
      {!perms.canManageSetup ? (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
          Requires <code className="text-[12px]">inventory.setup.manage</code>. You can review steps but cannot post.
        </p>
      ) : null}

      <ol className="mb-4 flex flex-wrap gap-2 text-[12px]">
        {[
          { n: 1, label: 'Select method' },
          { n: 2, label: 'Confirm & reason' },
          { n: 3, label: 'Result' },
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
          <Button
            size="sm"
            disabled={!form.toMethod}
            onClick={() => setStep(2)}
          >
            Continue
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <form className="max-w-lg space-y-3 rounded-md border border-erp-border p-4" onSubmit={onSubmit}>
          <p className="text-[13px]">
            Changing to <strong>{METHODS.find((m) => m.value === form.toMethod)?.label}</strong> effective{' '}
            {form.effectiveDate}.
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
            Force (override soft policy gates when API allows)
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="submit" size="sm" disabled={busy || !perms.canManageSetup || !api}>
              {busy ? 'Applying…' : 'Apply method change'}
            </Button>
          </div>
        </form>
      ) : null}

      {step === 3 && result ? (
        <div className="max-w-lg space-y-3 rounded-md border border-emerald-200 bg-emerald-50/50 p-4 text-[13px]">
          <p className="font-semibold text-emerald-900">Method change recorded</p>
          <dl className="grid gap-1 sm:grid-cols-2">
            <div>
              <dt className="text-erp-muted">From</dt>
              <dd>{methodLabel(String(result.fromMethod))}</dd>
            </div>
            <div>
              <dt className="text-erp-muted">To</dt>
              <dd>{methodLabel(String(result.toMethod))}</dd>
            </div>
            <div>
              <dt className="text-erp-muted">Opening migration</dt>
              <dd>
                {result.openingMigrationRequired
                  ? result.openingMigrationCompleted
                    ? 'Completed'
                    : 'Required / pending'
                  : 'Not required'}
              </dd>
            </div>
            {result.migration ? (
              <div className="sm:col-span-2">
                <dt className="text-erp-muted">Migration</dt>
                <dd>
                  Created {result.migration.createdLayers} layers · skipped {result.migration.skipped} · exceptions{' '}
                  {result.migration.exceptions}
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link to={inventoryCostingPaths.summary} className="font-semibold text-erp-primary hover:underline">
              Valuation summary →
            </Link>
            <Link to={inventoryCostingPaths.reconciliation} className="font-semibold text-erp-primary hover:underline">
              Run reconciliation →
            </Link>
            <Link to="/inventory/setup" className="font-semibold text-erp-primary hover:underline">
              Inventory setup →
            </Link>
          </div>
          <Button size="sm" variant="secondary" onClick={() => { setStep(1); setResult(null) }}>
            Change again
          </Button>
        </div>
      ) : null}
      </div>
    </InventoryCostingShell>
  )
}
