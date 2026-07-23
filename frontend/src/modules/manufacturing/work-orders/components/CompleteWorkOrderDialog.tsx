/**
 * FORM 23 — Work Order Complete with server close-readiness details.
 * No generic "Are you sure?" — shows production position, blockers and warnings.
 */
import { useEffect, useState } from 'react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { FormField } from '@/components/forms/FormField'
import { Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { ValidationSummary } from '../../ui'
import { getCloseReadiness } from '@/services/api/manufacturingApi'
import type { WorkOrderDetail } from '@/types/manufacturingProduction'

interface CloseReadinessCheck {
  code: string
  severity: 'BLOCKER' | 'WARNING' | 'INFO'
  message: string
}

export function CompleteWorkOrderDialog({
  open,
  onClose,
  workOrder,
  busy,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  workOrder: WorkOrderDetail
  busy?: boolean
  onConfirm: (remarks: string) => void
}) {
  const [remarks, setRemarks] = useState('')
  const [loading, setLoading] = useState(false)
  const [checks, setChecks] = useState<CloseReadinessCheck[]>([])

  useEffect(() => {
    if (!open) return
    setRemarks('')
    setLoading(true)
    getCloseReadiness(workOrder.id, { allowInProgress: true })
      .then((res) => {
        const data = res.data as { checks?: CloseReadinessCheck[] }
        setChecks(data.checks ?? [])
      })
      .catch(() => setChecks([]))
      .finally(() => setLoading(false))
  }, [open, workOrder.id])

  const blockers = checks
    .filter((c) => c.severity === 'BLOCKER' && c.code !== 'OPERATIONAL_STATUS')
    .map((c) => c.message)
  const warnings = checks.filter((c) => c.severity === 'WARNING').map((c) => c.message)
  const remaining = Math.max(
    0,
    Number(workOrder.plannedQuantity) -
      Number(workOrder.completedGoodQuantity) -
      Number(workOrder.rejectedQuantity) -
      Number(workOrder.scrapQuantity),
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Complete Work Order"
      description="Marks operational production complete. No inventory or GL postings occur — finished goods receipt remains a separate posting."
      closeDisabled={busy}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button disabled={busy || loading || blockers.length > 0} onClick={() => onConfirm(remarks)}>
            {busy ? 'Completing…' : 'Complete Work Order'}
          </Button>
        </div>
      }
    >
      <div className="grid gap-3">
        <div className="grid grid-cols-3 gap-2 rounded-md bg-erp-surface-alt px-3 py-2 text-[12px] sm:grid-cols-6">
          <div>
            <p className="text-erp-muted">Planned</p>
            <p className="font-semibold tabular-nums">{workOrder.plannedQuantity}</p>
          </div>
          <div>
            <p className="text-erp-muted">Good</p>
            <p className="font-semibold tabular-nums">{workOrder.completedGoodQuantity}</p>
          </div>
          <div>
            <p className="text-erp-muted">Rework</p>
            <p className="font-semibold tabular-nums">{workOrder.reworkQuantity}</p>
          </div>
          <div>
            <p className="text-erp-muted">Rejected</p>
            <p className="font-semibold tabular-nums">{workOrder.rejectedQuantity}</p>
          </div>
          <div>
            <p className="text-erp-muted">Scrap</p>
            <p className="font-semibold tabular-nums">{workOrder.scrapQuantity}</p>
          </div>
          <div>
            <p className="text-erp-muted">Remaining</p>
            <p className="font-semibold tabular-nums">{remaining}</p>
          </div>
        </div>

        {loading ? (
          <LoadingState variant="form" rows={2} />
        ) : (
          <ValidationSummary blockers={blockers} warnings={warnings} />
        )}
        {!loading && blockers.length === 0 && warnings.length === 0 ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-900">
            No close-readiness blockers found — this work order is ready to complete.
          </p>
        ) : null}
        {!loading && blockers.length === 0 && warnings.length > 0 ? (
          <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-950">
            Warnings above do not block Complete. Finished goods receipt can stay a separate step if not
            posted automatically.
          </p>
        ) : null}

        <FormField label="Remarks">
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
        </FormField>
      </div>
    </Modal>
  )
}
