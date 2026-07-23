/**
 * FORM 21 — Finished Goods Receipt posting drawer.
 * Server-derived eligibility + preview; explicit Inventory posting warning.
 */
import { useCallback, useEffect, useState } from 'react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { FormField } from '@/components/forms/FormField'
import { Input, Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { PostingImpactPanel, ValidationSummary } from '../../ui'
import { getFgEligibility, postFgReceipt, previewFgReceipt } from '@/services/api/manufacturingApi'
import { notify } from '@/store/toastStore'

interface FgEligibility {
  orderNumber: string
  completedGoodQuantity: string
  plannedQuantity: string
  alreadyReceivedQuantity: string
  eligibleQuantity: string
  qualityHold: boolean
  qualityBlockers: Array<{ message?: string; reason?: string }>
  isStockable: boolean
  batchTrackingRequired: boolean
  serialTrackingRequired: boolean
  canReceive: boolean
}

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(3))

export function FgReceiptDrawer({
  open,
  onClose,
  workOrderId,
  workOrderNo,
  onPosted,
}: {
  open: boolean
  onClose: () => void
  workOrderId: string
  workOrderNo: string
  onPosted: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [eligibility, setEligibility] = useState<FgEligibility | null>(null)
  const [qty, setQty] = useState('')
  const [receiptDate, setReceiptDate] = useState('')
  const [batchOrLot, setBatchOrLot] = useState('')
  const [remarks, setRemarks] = useState('')
  const [previewErrors, setPreviewErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getFgEligibility(workOrderId)
      const data = res.data as unknown as FgEligibility
      setEligibility(data)
      setQty(num(data.eligibleQuantity) > 0 ? fmt(num(data.eligibleQuantity)) : '')
      setReceiptDate(new Date().toISOString().slice(0, 10))
      setBatchOrLot('')
      setRemarks('')
      setPreviewErrors([])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load FG eligibility')
      setEligibility(null)
    } finally {
      setLoading(false)
    }
  }, [workOrderId])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const eligible = eligibility ? num(eligibility.eligibleQuantity) : 0
  const quantity = num(qty)
  const overEligible = quantity > eligible
  const blockers = [
    ...(eligibility && !eligibility.isStockable ? ['Item is not stockable'] : []),
    ...(eligibility?.qualityHold ? ['Quality blockers prevent unrestricted FG receipt'] : []),
    ...(eligibility && eligible <= 0 ? ['No eligible finished goods quantity remaining'] : []),
    ...previewErrors,
  ]
  const canPost = Boolean(eligibility?.canReceive) && quantity > 0 && !overEligible && !busy

  const post = async () => {
    if (!eligibility) return
    setBusy(true)
    try {
      const preview = await previewFgReceipt(workOrderId, { quantity })
      const previewData = preview.data as { ok?: boolean; errors?: string[] }
      if (previewData.ok === false) {
        setPreviewErrors(previewData.errors ?? ['Finished goods receipt is not ready to post'])
        return
      }
      await postFgReceipt(workOrderId, {
        quantity,
        receiptDate: receiptDate || undefined,
        batchOrLotNumber: batchOrLot.trim() || undefined,
        remarks: remarks.trim() || undefined,
        idempotencyKey: crypto.randomUUID(),
      })
      notify.success(`${fmt(quantity)} received into finished goods for ${workOrderNo}`)
      onPosted()
      onClose()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to post FG receipt')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Post Finished Goods Receipt"
      description={workOrderNo}
      closeDisabled={busy}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void post()} disabled={!canPost}>
            {busy ? 'Posting…' : 'Post Finished Goods Receipt'}
          </Button>
        </div>
      }
    >
      {loading ? (
        <LoadingState variant="form" />
      ) : !eligibility ? (
        <p className="text-[13px] text-erp-muted">Eligibility could not be loaded. Close and retry.</p>
      ) : (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2 rounded-md bg-erp-surface-alt px-3 py-2 text-[12px] sm:grid-cols-4">
            <div>
              <p className="text-erp-muted">Planned</p>
              <p className="font-semibold tabular-nums">{fmt(num(eligibility.plannedQuantity))}</p>
            </div>
            <div>
              <p className="text-erp-muted">Good produced</p>
              <p className="font-semibold tabular-nums">{fmt(num(eligibility.completedGoodQuantity))}</p>
            </div>
            <div>
              <p className="text-erp-muted">Already received</p>
              <p className="font-semibold tabular-nums">{fmt(num(eligibility.alreadyReceivedQuantity))}</p>
            </div>
            <div>
              <p className="text-erp-muted">Eligible now</p>
              <p className="font-semibold tabular-nums text-emerald-700">{fmt(eligible)}</p>
            </div>
          </div>

          <ValidationSummary blockers={blockers} warnings={[]} />

          <FormField
            label="Receipt Quantity"
            required
            error={overEligible ? `Cannot exceed eligible quantity (${fmt(eligible)})` : undefined}
            hint="Eligible = accepted good production minus quantity already received."
          >
            <Input
              type="number"
              min={0}
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="text-right text-[15px] font-semibold"
              error={overEligible}
              disabled={!eligibility.canReceive}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Receipt Date">
              <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
            </FormField>
            <FormField
              label="Batch / Lot Number"
              required={eligibility.batchTrackingRequired}
              hint={eligibility.batchTrackingRequired ? 'Batch tracking is required by the manufacturing profile.' : undefined}
            >
              <Input value={batchOrLot} onChange={(e) => setBatchOrLot(e.target.value)} />
            </FormField>
          </div>

          <FormField label="Remarks">
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
          </FormField>

          <PostingImpactPanel
            rows={[
              { label: 'Finished goods inventory', value: `+ ${fmt(quantity)}`, tone: 'success' },
              {
                label: 'Eligible after posting',
                value: fmt(Math.max(0, eligible - quantity)),
                tone: eligible - quantity <= 0 ? 'success' : 'default',
              },
            ]}
            warning="This action creates an Inventory transaction and cannot be directly edited. Use a correction to reverse."
          />
        </div>
      )}
    </Modal>
  )
}
