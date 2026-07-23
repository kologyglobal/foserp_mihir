/**
 * Phase 5 guided Role Builder — identity → modules → sensitive review → summary.
 */
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { FormField } from '../forms/FormField'
import { Input, Textarea } from '../forms/Inputs'
import { ErpButton } from '../erp/ErpButton'
import { Badge } from '../ui/Badge'
import {
  AdminPermissionMatrix,
  adminModuleLabel,
  isAdminSensitivePermission,
  type AdminPermissionPreset,
} from './AdminPermissionMatrix'
import type { AdminPermission } from '../../types/admin'
import { cn } from '../../utils/cn'

const STEPS = [
  { id: 'identity', label: 'Identity' },
  { id: 'modules', label: 'Module access' },
  { id: 'sensitive', label: 'Sensitive review' },
  { id: 'summary', label: 'Summary' },
] as const

type StepId = (typeof STEPS)[number]['id']

export function AdminRoleBuilderWizard({
  catalog,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  selected,
  onToggle,
  onToggleModule,
  onApplyPreset,
  onSubmit,
  onCancel,
  submitting,
  isEdit,
  footer,
}: {
  catalog: AdminPermission[]
  name: string
  description: string
  onNameChange: (v: string) => void
  onDescriptionChange: (v: string) => void
  selected: Set<string>
  onToggle: (name: string) => void
  onToggleModule: (names: string[], checked: boolean) => void
  onApplyPreset?: (module: string, names: string[], preset: AdminPermissionPreset) => void
  onSubmit: (e: FormEvent) => void
  onCancel: () => void
  submitting?: boolean
  isEdit?: boolean
  footer?: ReactNode
}) {
  const [step, setStep] = useState<StepId>('identity')
  const stepIndex = STEPS.findIndex((s) => s.id === step)

  const sensitiveSelected = useMemo(
    () => [...selected].filter(isAdminSensitivePermission).sort(),
    [selected],
  )

  const moduleSummary = useMemo(() => {
    const map = new Map<string, number>()
    for (const perm of catalog) {
      if (!selected.has(perm.name)) continue
      map.set(perm.module, (map.get(perm.module) ?? 0) + 1)
    }
    return [...map.entries()]
      .map(([module, count]) => ({ module, count, label: adminModuleLabel(module) }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [catalog, selected])

  function canNext(): boolean {
    if (step === 'identity') return name.trim().length > 0
    return true
  }

  function goNext() {
    if (!canNext()) return
    const next = STEPS[stepIndex + 1]
    if (next) setStep(next.id)
  }

  function goBack() {
    const prev = STEPS[stepIndex - 1]
    if (prev) setStep(prev.id)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <nav aria-label="Role builder steps" className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => {
          const done = i < stepIndex
          const active = s.id === step
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (i <= stepIndex || (i === stepIndex + 1 && canNext())) setStep(s.id)
              }}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',
                active && 'border-erp-primary bg-erp-primary-soft/40 text-erp-primary',
                done && !active && 'border-emerald-200 bg-emerald-50 text-emerald-800',
                !active && !done && 'border-erp-border bg-erp-surface text-erp-muted',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
                  active || done ? 'bg-erp-primary text-white' : 'bg-erp-surface-alt',
                )}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {s.label}
            </button>
          )
        })}
      </nav>

      {step === 'identity' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Role Name" required>
            <Input value={name} onChange={(e) => onNameChange(e.target.value)} />
          </FormField>
          <FormField label="Description" className="md:col-span-2">
            <Textarea value={description} onChange={(e) => onDescriptionChange(e.target.value)} />
          </FormField>
          <p className="md:col-span-2 text-xs text-erp-muted">
            Start with a clear job-oriented name (for example Purchase Executive). Permissions come next.
          </p>
        </div>
      ) : null}

      {step === 'modules' ? (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-erp-text">Module permissions</h3>
            <p className="mt-0.5 text-xs text-erp-muted">
              Use View Only / No Access presets per module, then refine. Selected: {selected.size}
            </p>
          </div>
          <AdminPermissionMatrix
            catalog={catalog}
            selected={selected}
            onToggle={onToggle}
            onToggleModule={onToggleModule}
            onApplyPreset={onApplyPreset}
          />
        </div>
      ) : null}

      {step === 'sensitive' ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3">
            <p className="text-sm font-semibold text-amber-950">Sensitive access review</p>
            <p className="mt-1 text-xs text-amber-900/90">
              These grants can change security, postings, or platform scope. Confirm they belong on this role.
            </p>
          </div>
          {sensitiveSelected.length === 0 ? (
            <p className="text-sm text-erp-muted">No sensitive permissions selected — good for operational roles.</p>
          ) : (
            <ul className="divide-y divide-erp-border rounded-xl border border-erp-border bg-erp-surface">
              {sensitiveSelected.map((permName) => (
                <li key={permName} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="font-mono text-xs text-erp-text">{permName}</span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-erp-danger-fg hover:underline"
                    onClick={() => onToggle(permName)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {step === 'summary' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-erp-border bg-erp-surface p-4">
            <p className="text-sm font-semibold text-erp-text">{name.trim() || 'Untitled role'}</p>
            {description.trim() ? <p className="mt-1 text-sm text-erp-muted">{description}</p> : null}
            <p className="mt-3 text-xs text-erp-muted">
              {selected.size} permission{selected.size === 1 ? '' : 's'} · {sensitiveSelected.length} sensitive
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {moduleSummary.map((m) => (
              <Badge key={m.module} color="blue">
                {m.label}: {m.count}
              </Badge>
            ))}
            {moduleSummary.length === 0 ? (
              <span className="text-sm text-erp-muted">No modules selected</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-erp-border pt-4">
        <ErpButton type="button" size="sm" variant="secondary" onClick={onCancel}>
          Cancel
        </ErpButton>
        <div className="flex flex-wrap gap-2">
          {stepIndex > 0 ? (
            <ErpButton type="button" size="sm" variant="secondary" onClick={goBack}>
              Back
            </ErpButton>
          ) : null}
          {step !== 'summary' ? (
            <ErpButton type="button" size="sm" disabled={!canNext()} onClick={goNext}>
              Continue
            </ErpButton>
          ) : (
            <ErpButton type="submit" size="sm" disabled={submitting || !name.trim()}>
              {submitting ? 'Saving…' : isEdit ? 'Save role' : 'Create role'}
            </ErpButton>
          )}
        </div>
      </div>
      {footer}
    </form>
  )
}
