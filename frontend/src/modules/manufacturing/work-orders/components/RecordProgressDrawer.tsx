import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import type { ProductionOrderStage, RecordProgressPayload } from '@/types/manufacturingProduction'

const RECORDABLE_STAGE_STATUSES = new Set(['READY', 'IN_PROGRESS'])

interface RecordProgressDrawerProps {
  open: boolean
  onClose: () => void
  stages: ProductionOrderStage[]
  busy?: boolean
  onSubmit: (payload: RecordProgressPayload) => Promise<void> | void
}

/** Good / Rework / Rejected / Scrap quantity capture for a work order stage (Phase 2A). */
export function RecordProgressDrawer({ open, onClose, stages, busy, onSubmit }: RecordProgressDrawerProps) {
  const recordable = useMemo(() => stages.filter((s) => RECORDABLE_STAGE_STATUSES.has(s.status)), [stages])
  const [stageId, setStageId] = useState('')
  const [good, setGood] = useState('0')
  const [rework, setRework] = useState('0')
  const [rejected, setRejected] = useState('0')
  const [scrap, setScrap] = useState('0')
  const [remarks, setRemarks] = useState('')

  useEffect(() => {
    if (!open) return
    setStageId(recordable[0]?.id ?? '')
    setGood('0')
    setRework('0')
    setRejected('0')
    setScrap('0')
    setRemarks('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const selectedStage = recordable.find((s) => s.id === stageId)
  const total = (Number(good) || 0) + (Number(rework) || 0) + (Number(rejected) || 0) + (Number(scrap) || 0)
  const canSubmit = Boolean(stageId) && total > 0 && !busy

  const submit = async () => {
    if (!canSubmit) return
    await onSubmit({
      stageId,
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
      title="Record Progress"
      description="Good / Rework / Rejected / Scrap quantities against the selected stage."
      closeDisabled={busy}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {busy ? 'Recording…' : 'Record Progress'}
          </Button>
        </div>
      }
    >
      <div className="grid gap-3">
        <FormField label="Stage" required>
          <Select value={stageId} onChange={(e) => setStageId(e.target.value)} disabled={recordable.length === 0}>
            <option value="">{recordable.length === 0 ? 'No stage is ready for progress' : 'Select stage…'}</option>
            {recordable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.status})
              </option>
            ))}
          </Select>
        </FormField>
        {selectedStage ? (
          <p className="rounded-md bg-erp-surface-alt px-3 py-2 text-[12px] text-erp-muted">
            Planned {selectedStage.plannedQuantity} · Good so far {selectedStage.goodQuantity} · Rework{' '}
            {selectedStage.reworkQuantity} · Rejected {selectedStage.rejectedQuantity} · Scrap{' '}
            {selectedStage.scrapQuantity}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Good Quantity">
            <Input type="number" min={0} step="any" value={good} onChange={(e) => setGood(e.target.value)} />
          </FormField>
          <FormField label="Rework Quantity">
            <Input type="number" min={0} step="any" value={rework} onChange={(e) => setRework(e.target.value)} />
          </FormField>
          <FormField label="Rejected Quantity">
            <Input type="number" min={0} step="any" value={rejected} onChange={(e) => setRejected(e.target.value)} />
          </FormField>
          <FormField label="Scrap Quantity">
            <Input type="number" min={0} step="any" value={scrap} onChange={(e) => setScrap(e.target.value)} />
          </FormField>
        </div>
        <FormField label="Remarks">
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
        </FormField>
        {total <= 0 ? (
          <p className="text-[12px] text-amber-800">Enter at least one quantity greater than zero.</p>
        ) : null}
      </div>
    </Modal>
  )
}
