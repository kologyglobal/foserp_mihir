import { useEffect, useMemo, useRef, useState } from 'react'
import { ErpButton, ErpButtonGroup } from '../erp/ErpButton'
import { ErpSmartSelect, type ErpSmartSelectOption } from '../erp/ErpSmartSelect'
import { useCrmOwnerOptions } from '../../hooks/useCrmMasters'

export type AssignOwnerEntityKind = 'lead' | 'opportunity' | 'contact' | 'company' | 'quotation'

export interface AssignOwnerDialogProps {
  open: boolean
  onClose: () => void
  entityKind: AssignOwnerEntityKind
  /** Number of records being assigned */
  count: number
  /** Current owner when a single record is selected */
  currentOwnerId?: string | null
  currentOwnerName?: string | null
  /**
   * Called with the selected owner's id and display label.
   * Return `{ ok: false, error }` or throw to keep the dialog open with an error.
   */
  onAssign: (
    ownerId: string,
    ownerLabel: string,
  ) => Promise<{ ok: boolean; error?: string } | void> | { ok: boolean; error?: string } | void
}

const ENTITY_LABELS: Record<AssignOwnerEntityKind, { one: string; many: string }> = {
  lead: { one: 'lead', many: 'leads' },
  opportunity: { one: 'opportunity', many: 'opportunities' },
  contact: { one: 'contact', many: 'contacts' },
  company: { one: 'company', many: 'companies' },
  quotation: { one: 'quotation', many: 'quotations' },
}

function entityCountLabel(kind: AssignOwnerEntityKind, count: number): string {
  const labels = ENTITY_LABELS[kind]
  return `${count} ${count === 1 ? labels.one : labels.many}`
}

export function AssignOwnerDialog({
  open,
  onClose,
  entityKind,
  count,
  currentOwnerId,
  currentOwnerName,
  onAssign,
}: AssignOwnerDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const ownerOptions = useCrmOwnerOptions()
  const [ownerId, setOwnerId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectOptions: ErpSmartSelectOption[] = useMemo(
    () =>
      ownerOptions.map((o) => ({
        value: o.value,
        label: o.label,
        searchText: `${o.label} ${o.value} ${o.role ?? ''} ${o.department ?? ''}`.toLowerCase(),
        meta: o.role || o.department
          ? (
              <span className="text-[11px] text-erp-muted">
                {[o.role, o.department].filter(Boolean).join(' · ')}
              </span>
            )
          : undefined,
      })),
    [ownerOptions],
  )

  useEffect(() => {
    if (!open) return
    setError(null)
    setSubmitting(false)
    const initial =
      (currentOwnerId && ownerOptions.some((o) => o.value === currentOwnerId) ? currentOwnerId : '')
      || ownerOptions[0]?.value
      || ''
    setOwnerId(initial)
  }, [open, currentOwnerId, ownerOptions])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    // Focus first control after paint (matches other ERP dialogs — Escape + aria-modal)
    requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('input, button')?.focus()
    })
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, submitting])

  if (!open) return null

  const selected = ownerOptions.find((o) => o.value === ownerId)
  const subtitle = `Assign owner to ${entityCountLabel(entityKind, count)}`
  const showCurrent = count === 1 && Boolean(currentOwnerName || currentOwnerId)

  async function handleAssign() {
    if (!ownerId || !selected) {
      setError(ownerOptions.length ? 'Select an owner from the directory' : 'No assignable owners loaded — refresh and try again')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await onAssign(ownerId, selected.label)
      if (result && result.ok === false) {
        setError(result.error ?? 'Assignment failed')
        setSubmitting(false)
        return
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed')
      setSubmitting(false)
    }
  }

  return (
    <div className="erp-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="assign-owner-title">
      <div ref={panelRef} className="erp-modal-panel max-w-md">
        <h2 id="assign-owner-title" className="text-[16px] font-semibold text-erp-text">
          Assign owner
        </h2>
        <p className="mt-1 text-[13px] text-erp-muted">{subtitle}</p>

        {showCurrent ? (
          <p className="mt-3 text-[13px] text-erp-text">
            Current owner:{' '}
            <span className="font-medium">{currentOwnerName?.trim() || 'Unassigned'}</span>
          </p>
        ) : null}

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-erp-muted">
            New owner
          </span>
          <ErpSmartSelect
            options={selectOptions}
            value={ownerId}
            onChange={(v) => {
              setOwnerId(v)
              setError(null)
            }}
            placeholder="Search owners…"
            disabled={submitting || selectOptions.length === 0}
            emptyMessage="No owners match"
            appearance="combo"
            error={Boolean(error)}
          />
        </label>

        {error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800" role="alert">
            {error}
          </p>
        ) : null}

        <ErpButtonGroup className="mt-5 justify-end">
          <ErpButton type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </ErpButton>
          <ErpButton
            type="button"
            variant="primary"
            onClick={() => void handleAssign()}
            disabled={submitting || !ownerId || selectOptions.length === 0}
          >
            {submitting ? 'Assigning…' : 'Assign'}
          </ErpButton>
        </ErpButtonGroup>
      </div>
    </div>
  )
}
