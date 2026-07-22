import { useEffect, useState } from 'react'
import { Modal } from '@/design-system/components/Modal'
import { FormField } from '@/components/forms/FormField'
import { Input, Textarea } from '@/components/forms/Inputs'
import type { CompleteAssignmentPayload } from '@/types/manufacturingPhase2b'
import { t } from '../i18n/operatorStrings'
import { operatorBtnPrimary, operatorBtnSecondary } from './operatorCss'

interface ProductionCompletionSheetProps {
  open: boolean
  onClose: () => void
  busy?: boolean
  onSubmit: (payload: CompleteAssignmentPayload) => Promise<void> | void
}

/** Good / Rework / Rejected / Scrap capture for operator assignment completion. */
export function ProductionCompletionSheet({ open, onClose, busy, onSubmit }: ProductionCompletionSheetProps) {
  const [good, setGood] = useState('0')
  const [rework, setRework] = useState('0')
  const [rejected, setRejected] = useState('0')
  const [scrap, setScrap] = useState('0')
  const [remarks, setRemarks] = useState('')

  useEffect(() => {
    if (!open) return
    setGood('0')
    setRework('0')
    setRejected('0')
    setScrap('0')
    setRemarks('')
  }, [open])

  const total = (Number(good) || 0) + (Number(rework) || 0) + (Number(rejected) || 0) + (Number(scrap) || 0)
  const canSubmit = total > 0 && !busy

  const submit = async () => {
    if (!canSubmit) return
    await onSubmit({
      goodQuantity: Number(good) || 0,
      reworkQuantity: Number(rework) || 0,
      rejectedQuantity: Number(rejected) || 0,
      scrapQuantity: Number(scrap) || 0,
      remarks: remarks.trim() || undefined,
      idempotencyKey: crypto.randomUUID(),
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('completion.title')}
      closeDisabled={busy}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={operatorBtnSecondary} onClick={onClose} disabled={busy}>
            {t('completion.cancel')}
          </button>
          <button type="button" className={operatorBtnPrimary} onClick={() => void submit()} disabled={!canSubmit}>
            {busy ? '…' : t('completion.submit')}
          </button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t('completion.good')}>
          <Input type="number" min={0} step="any" value={good} onChange={(e) => setGood(e.target.value)} className="min-h-12 text-lg" />
        </FormField>
        <FormField label={t('completion.rework')}>
          <Input type="number" min={0} step="any" value={rework} onChange={(e) => setRework(e.target.value)} className="min-h-12 text-lg" />
        </FormField>
        <FormField label={t('completion.rejected')}>
          <Input type="number" min={0} step="any" value={rejected} onChange={(e) => setRejected(e.target.value)} className="min-h-12 text-lg" />
        </FormField>
        <FormField label={t('completion.scrap')}>
          <Input type="number" min={0} step="any" value={scrap} onChange={(e) => setScrap(e.target.value)} className="min-h-12 text-lg" />
        </FormField>
        <FormField label={t('completion.remarks')} className="sm:col-span-2">
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
        </FormField>
      </div>
      <p className="mt-2 text-[12px] text-erp-muted tabular-nums">Total: {total}</p>
    </Modal>
  )
}
