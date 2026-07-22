import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import {
  applyCorrection,
  createCorrection,
  previewCorrection,
  submitCorrection,
} from '@/services/api/manufacturingApi'
import type {
  CorrectionAction,
  CorrectionPreview,
  CorrectionProposedValue,
  CorrectionTransactionType,
} from '@/types/manufacturingCorrection'
import {
  CORRECTION_ACTION_LABELS,
  CORRECTION_ACTIONS,
  CORRECTION_TRANSACTION_TYPE_LABELS,
  CORRECTION_TRANSACTION_TYPES,
} from '@/types/manufacturingCorrection'
import {
  canRequestCorrection,
  canRequestCorrectionOfType,
} from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'

export type CorrectionDrawerContext = {
  workOrderId?: string
  workOrderNumber?: string
  sourceEntityType?: CorrectionTransactionType
  sourceEntityId?: string
  sourceEntityLabel?: string
}

type Props = {
  open: boolean
  onClose: () => void
  onChanged?: () => void
  context?: CorrectionDrawerContext
}

function display(value: unknown): string {
  if (value == null) return '—'
  if (typeof value !== 'object') return String(value)
  return Object.entries(value as Record<string, unknown>)
    .map(([key, entry]) => `${key.replace(/([A-Z])/g, ' $1')}: ${Array.isArray(entry) ? entry.length : display(entry)}`)
    .join(' · ')
}

/** Preview-first correction / reverse flow — mirrors RuntimeChangeDrawer. */
export function CorrectionDrawer({ open, onClose, onChanged, context }: Props) {
  const permittedTypes = useMemo(
    () => CORRECTION_TRANSACTION_TYPES.filter((type) => canRequestCorrectionOfType(type)),
    [],
  )

  const [step, setStep] = useState(1)
  const [action, setAction] = useState<CorrectionAction>('REVERSE')
  const [transactionType, setTransactionType] = useState<CorrectionTransactionType>(
    context?.sourceEntityType ?? permittedTypes[0] ?? 'PROGRESS',
  )
  const [sourceEntityId, setSourceEntityId] = useState(context?.sourceEntityId ?? '')
  const [reason, setReason] = useState('')
  const [justification, setJustification] = useState('')
  const [qty, setQty] = useState({ good: '', rework: '', rejected: '', scrap: '', quantity: '' })
  const [preview, setPreview] = useState<CorrectionPreview | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setReason('')
    setJustification('')
    setQty({ good: '', rework: '', rejected: '', scrap: '', quantity: '' })
    setPreview(null)
    setAction('REVERSE')
    const nextType = context?.sourceEntityType && permittedTypes.includes(context.sourceEntityType)
      ? context.sourceEntityType
      : permittedTypes[0] ?? 'PROGRESS'
    setTransactionType(nextType)
    setSourceEntityId(context?.sourceEntityId ?? '')
  }, [open, context, permittedTypes])

  const proposedValue = (): CorrectionProposedValue | undefined => {
    if (action !== 'CORRECT') return undefined
    const num = (v: string) => (v.trim() === '' ? undefined : Number(v))
    if (transactionType === 'PROGRESS' || transactionType === 'DAILY_PRODUCTION') {
      return {
        goodQuantity: num(qty.good),
        reworkQuantity: num(qty.rework),
        rejectedQuantity: num(qty.rejected),
        scrapQuantity: num(qty.scrap),
      }
    }
    return { quantity: num(qty.quantity) }
  }

  const baseBody = () => ({
    action,
    transactionType,
    sourceEntityId: sourceEntityId.trim(),
    productionOrderId: context?.workOrderId,
    proposedValue: proposedValue(),
  })

  const runPreview = async () => {
    if (!sourceEntityId.trim()) return notify.error('Enter the source transaction id')
    setBusy(true)
    try {
      const result = await previewCorrection(baseBody())
      setPreview(result.data)
      setStep(3)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Unable to preview correction')
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    if (!reason.trim()) return notify.error('A reason is required')
    setBusy(true)
    try {
      const created = await createCorrection({
        ...baseBody(),
        reason: reason.trim(),
        businessJustification: justification.trim() || undefined,
        idempotencyKey: `mfg-correction:${crypto.randomUUID()}`,
      })
      if (preview?.risk.approvalRequired) {
        await submitCorrection(created.data.id)
        notify.success('Correction sent for approval')
      } else {
        await applyCorrection(created.data.id, {
          idempotencyKey: `mfg-correction-apply:${crypto.randomUUID()}`,
        })
        notify.success('Correction applied')
      }
      onChanged?.()
      onClose()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Unable to save correction')
    } finally {
      setBusy(false)
    }
  }

  if (!canRequestCorrection()) {
    return (
      <Modal open={open} onClose={onClose} title="Correct / Reverse">
        <p className="text-sm text-erp-muted">You do not have permission to request corrections.</p>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Correct / Reverse"
      closeDisabled={busy}
      footer={
        <div className="flex justify-between gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => (step === 1 ? onClose() : setStep(step - 1))}>
            Back
          </Button>
          {step === 1 ? (
            <Button disabled={!transactionType || busy} onClick={() => setStep(2)}>
              Continue
            </Button>
          ) : step === 2 ? (
            <Button disabled={busy} onClick={() => void runPreview()}>
              Preview impact
            </Button>
          ) : step === 3 ? (
            <Button disabled={busy} onClick={() => setStep(4)}>
              Continue
            </Button>
          ) : (
            <Button disabled={busy || !reason.trim()} onClick={() => void submit()}>
              {preview?.risk.approvalRequired ? 'Send for approval' : 'Apply correction'}
            </Button>
          )}
        </div>
      }
    >
      {context?.workOrderNumber ? (
        <p className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-erp-muted">
          Work order <span className="font-mono font-semibold text-erp-text">{context.workOrderNumber}</span>
          {context.sourceEntityLabel ? <> · {context.sourceEntityLabel}</> : null}
        </p>
      ) : null}

      {permittedTypes.length === 0 ? (
        <p className="text-sm text-erp-muted">No correction types are available for your permissions.</p>
      ) : null}

      {step === 1 && permittedTypes.length > 0 ? (
        <div className="space-y-3">
          <FormField label="What do you want to do?" required>
            <Select value={action} onChange={(e) => setAction(e.target.value as CorrectionAction)}>
              {CORRECTION_ACTIONS.map((value) => (
                <option key={value} value={value}>
                  {CORRECTION_ACTION_LABELS[value]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Transaction type" required>
            <Select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value as CorrectionTransactionType)}
              disabled={Boolean(context?.sourceEntityType)}
            >
              {permittedTypes.map((type) => (
                <option key={type} value={type}>
                  {CORRECTION_TRANSACTION_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <FormField label="Source transaction id" required>
            <Input
              value={sourceEntityId}
              onChange={(e) => setSourceEntityId(e.target.value)}
              placeholder="Ledger / issue / movement id"
              disabled={Boolean(context?.sourceEntityId)}
              className="font-mono"
            />
          </FormField>
          {action === 'CORRECT' && (transactionType === 'PROGRESS' || transactionType === 'DAILY_PRODUCTION') ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Good qty">
                <Input type="number" value={qty.good} onChange={(e) => setQty((q) => ({ ...q, good: e.target.value }))} />
              </FormField>
              <FormField label="Rework qty">
                <Input type="number" value={qty.rework} onChange={(e) => setQty((q) => ({ ...q, rework: e.target.value }))} />
              </FormField>
              <FormField label="Rejected qty">
                <Input type="number" value={qty.rejected} onChange={(e) => setQty((q) => ({ ...q, rejected: e.target.value }))} />
              </FormField>
              <FormField label="Scrap qty">
                <Input type="number" value={qty.scrap} onChange={(e) => setQty((q) => ({ ...q, scrap: e.target.value }))} />
              </FormField>
            </div>
          ) : null}
          {action === 'CORRECT' && transactionType !== 'PROGRESS' && transactionType !== 'DAILY_PRODUCTION' ? (
            <FormField label="Corrected quantity">
              <Input
                type="number"
                value={qty.quantity}
                onChange={(e) => setQty((q) => ({ ...q, quantity: e.target.value }))}
              />
            </FormField>
          ) : null}
          <p className="text-[12px] text-erp-muted">
            Original transactions are never edited. The system posts a compensating reverse
            {action === 'CORRECT' ? ' and a corrected re-entry' : ''}.
          </p>
        </div>
      ) : null}

      {step === 3 && preview ? (
        <div className="space-y-3 text-sm">
          <p className="rounded-md border border-slate-200 bg-slate-50 p-3">
            {preview.impact.summary || 'Review the impact below before continuing.'}
          </p>
          <dl className="space-y-2">
            <div>
              <dt className="text-erp-muted">Current</dt>
              <dd>{display(preview.original)}</dd>
            </div>
            <div>
              <dt className="text-erp-muted">Proposed</dt>
              <dd>{display(preview.proposed)}</dd>
            </div>
          </dl>
          {preview.impact.warnings?.map((warning) => (
            <p key={warning} className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-900">
              {warning}
            </p>
          ))}
          {preview.impact.blockers?.map((blocker) => (
            <p key={blocker} className="rounded-md border border-rose-200 bg-rose-50 p-2 text-rose-900">
              {blocker}
            </p>
          ))}
          {preview.dependencies && preview.dependencies.length > 0 ? (
            <div className="rounded-md border border-sky-200 bg-sky-50 p-2 text-[12px] text-sky-900">
              <p className="font-medium">Dependencies</p>
              <ul className="mt-1 list-inside list-disc">
                {preview.dependencies.map((dep) => (
                  <li key={`${dep.entityType}:${dep.entityId}`}>
                    {dep.label}
                    {dep.blocksApply ? ' (blocks apply)' : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-erp-muted">
            Risk: <strong>{preview.risk.riskLevel.toLowerCase()}</strong>
            {' · '}
            {preview.risk.approvalRequired ? 'Approval required' : 'Can be applied directly'}
          </p>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-3">
          <FormField label="Reason" required>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why is this correction needed?"
            />
          </FormField>
          <FormField label="Business justification (optional)">
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={2}
              placeholder="Additional context for approvers"
            />
          </FormField>
        </div>
      ) : null}
    </Modal>
  )
}
