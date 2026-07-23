import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import type { ProductionOrderStage, RecordProgressPayload } from '@/types/manufacturingProduction'

const RECORDABLE_STAGE_STATUSES = new Set(['READY', 'IN_PROGRESS', 'NOT_STARTED'])
const TERMINAL_STAGE_STATUSES = new Set(['COMPLETED', 'SKIPPED', 'CANCELLED'])
const ACTIVE_RECORD_STATUSES = new Set(['READY', 'IN_PROGRESS'])

interface RecordProgressDrawerProps {
  open: boolean
  onClose: () => void
  stages: ProductionOrderStage[]
  currentStageId?: string | null
  busy?: boolean
  onSubmit: (payload: RecordProgressPayload) => Promise<void> | void
}

function parseNonNeg(raw: string): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

function clampQty(raw: string, max: number | null): string {
  if (raw.trim() === '') return ''
  const n = Number(raw)
  if (!Number.isFinite(n)) return '0'
  if (n < 0) return '0'
  if (max != null && n > max) return String(max)
  return raw
}

/** Good / Rework / Rejected / Scrap quantity capture for a work order stage (Phase 2A). */
export function RecordProgressDrawer({
  open,
  onClose,
  stages,
  currentStageId = null,
  busy,
  onSubmit,
}: RecordProgressDrawerProps) {
  const sorted = useMemo(
    () => [...stages].sort((a, b) => a.displayOrder - b.displayOrder),
    [stages],
  )

  const recordable = useMemo(() => {
    const readyOrRunning = sorted.filter((s) => ACTIVE_RECORD_STATUSES.has(s.status))
    if (readyOrRunning.length > 0) return readyOrRunning

    const current = currentStageId ? sorted.find((s) => s.id === currentStageId) : undefined
    if (current && !TERMINAL_STAGE_STATUSES.has(current.status)) return [current]

    const next = sorted.find((s) => !TERMINAL_STAGE_STATUSES.has(s.status))
    return next ? [next] : []
  }, [sorted, currentStageId])

  const [stageId, setStageId] = useState('')
  const [good, setGood] = useState('0')
  const [rework, setRework] = useState('0')
  const [rejected, setRejected] = useState('0')
  const [scrap, setScrap] = useState('0')
  const [remarks, setRemarks] = useState('')

  useEffect(() => {
    if (!open) return
    const preferred =
      (currentStageId && recordable.find((s) => s.id === currentStageId)?.id) ||
      recordable.find((s) => RECORDABLE_STAGE_STATUSES.has(s.status))?.id ||
      recordable[0]?.id ||
      ''
    setStageId(preferred)
    const preferredStage = recordable.find((s) => s.id === preferred)
    const plannedN = Number(preferredStage?.plannedQuantity ?? 0)
    const goodSoFarN = Number(preferredStage?.goodQuantity ?? 0)
    const rem = Math.max(0, (Number.isFinite(plannedN) ? plannedN : 0) - (Number.isFinite(goodSoFarN) ? goodSoFarN : 0))
    setGood(String(rem > 0 ? rem : 0))
    setRework('0')
    setRejected('0')
    setScrap('0')
    setRemarks('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentStageId])

  const selectedStage = recordable.find((s) => s.id === stageId) ?? sorted.find((s) => s.id === stageId)
  const canRecordOnSelected = selectedStage ? RECORDABLE_STAGE_STATUSES.has(selectedStage.status) : false

  const goodN = parseNonNeg(good)
  const reworkN = parseNonNeg(rework)
  const rejectedN = parseNonNeg(rejected)
  const scrapN = parseNonNeg(scrap)
  const total = goodN + reworkN + rejectedN + scrapN

  const planned = Number(selectedStage?.plannedQuantity ?? 0)
  const goodSoFar = Number(selectedStage?.goodQuantity ?? 0)
  const recordedTotalSoFar =
    goodSoFar +
    Number(selectedStage?.reworkQuantity ?? 0) +
    Number(selectedStage?.rejectedQuantity ?? 0) +
    Number(selectedStage?.scrapQuantity ?? 0)
  const remainingGood = Number.isFinite(planned) ? Math.max(0, planned - goodSoFar) : null
  const remainingTotal = Number.isFinite(planned) ? Math.max(0, planned - recordedTotalSoFar) : null

  const hasNegative =
    Number(good) < 0 || Number(rework) < 0 || Number(rejected) < 0 || Number(scrap) < 0
  const exceedsGood = remainingGood != null && goodN > remainingGood
  const exceedsTotal = remainingTotal != null && total > remainingTotal
  const qtyInvalid = hasNegative || exceedsGood || exceedsTotal

  const canSubmit =
    Boolean(stageId) && canRecordOnSelected && total > 0 && !qtyInvalid && !busy

  const submit = async () => {
    if (!canSubmit) return
    await onSubmit({
      stageId,
      goodQuantity: goodN,
      reworkQuantity: reworkN,
      rejectedQuantity: rejectedN,
      scrapQuantity: scrapN,
      remarks: remarks.trim() || undefined,
      idempotencyKey: crypto.randomUUID(),
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Progress"
      description="Partial updates allowed. Cumulative stage quantities update automatically."
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
          <Select
            value={stageId}
            onChange={(e) => {
              const nextId = e.target.value
              setStageId(nextId)
              const next = recordable.find((s) => s.id === nextId) ?? sorted.find((s) => s.id === nextId)
              const plannedN = Number(next?.plannedQuantity ?? 0)
              const goodSoFarN = Number(next?.goodQuantity ?? 0)
              const rem = Math.max(
                0,
                (Number.isFinite(plannedN) ? plannedN : 0) - (Number.isFinite(goodSoFarN) ? goodSoFarN : 0),
              )
              setGood(String(rem))
              setRework('0')
              setRejected('0')
              setScrap('0')
            }}
            disabled={recordable.length === 0}
          >
            <option value="">
              {recordable.length === 0 ? 'No stage available for progress' : SELECT_PLACEHOLDER}
            </option>
            {recordable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayOrder}. {s.name}
                {s.id === currentStageId ? ' (current)' : ''} — {s.status.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </FormField>
        {selectedStage ? (
          <div className="rounded-md border border-erp-border bg-erp-surface-alt px-3 py-2 text-[12px] text-erp-text">
            <p>
              Planned <span className="font-semibold tabular-nums">{selectedStage.plannedQuantity}</span>
              {' · '}Good so far{' '}
              <span className="font-semibold tabular-nums text-emerald-700">{selectedStage.goodQuantity}</span>
              {remainingGood != null ? (
                <>
                  {' · '}Remaining good <span className="font-semibold tabular-nums">{remainingGood}</span>
                </>
              ) : null}
            </p>
            <p className="mt-1 text-erp-muted">
              Rework {selectedStage.reworkQuantity} · Rejected {selectedStage.rejectedQuantity} · Scrap{' '}
              {selectedStage.scrapQuantity}
              {remainingTotal != null ? (
                <>
                  {' · '}Remaining total <span className="font-semibold tabular-nums text-erp-text">{remainingTotal}</span>
                </>
              ) : null}
            </p>
            {!ACTIVE_RECORD_STATUSES.has(selectedStage.status) && selectedStage.status === 'NOT_STARTED' ? (
              <p className="mt-1.5 text-[11px] font-medium text-amber-800">
                This stage has not been started yet. Recording progress will start it automatically.
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Good Quantity">
            <Input
              type="number"
              min={0}
              max={remainingGood ?? undefined}
              step="any"
              value={good}
              disabled={!canRecordOnSelected}
              onChange={(e) => setGood(clampQty(e.target.value, remainingGood))}
            />
          </FormField>
          <FormField label="Rework Quantity">
            <Input
              type="number"
              min={0}
              max={remainingTotal ?? undefined}
              step="any"
              value={rework}
              disabled={!canRecordOnSelected}
              onChange={(e) => setRework(clampQty(e.target.value, remainingTotal))}
            />
          </FormField>
          <FormField label="Rejected Quantity">
            <Input
              type="number"
              min={0}
              max={remainingTotal ?? undefined}
              step="any"
              value={rejected}
              disabled={!canRecordOnSelected}
              onChange={(e) => setRejected(clampQty(e.target.value, remainingTotal))}
            />
          </FormField>
          <FormField label="Scrap Quantity">
            <Input
              type="number"
              min={0}
              max={remainingTotal ?? undefined}
              step="any"
              value={scrap}
              disabled={!canRecordOnSelected}
              onChange={(e) => setScrap(clampQty(e.target.value, remainingTotal))}
            />
          </FormField>
        </div>
        <FormField label="Remarks">
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
        </FormField>
        {total <= 0 && canRecordOnSelected ? (
          <p className="text-[12px] text-amber-800">Enter at least one quantity greater than zero.</p>
        ) : null}
        {hasNegative ? (
          <p className="text-[12px] text-rose-700">Quantities cannot be negative.</p>
        ) : null}
        {exceedsGood ? (
          <p className="text-[12px] text-rose-700">
            Good quantity cannot exceed remaining ({remainingGood}).
          </p>
        ) : null}
        {!exceedsGood && exceedsTotal ? (
          <p className="text-[12px] text-rose-700">
            Total of good + rework + rejected + scrap cannot exceed remaining ({remainingTotal}).
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
