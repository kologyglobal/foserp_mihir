/**
 * Phase 7C2 — Reserve FG against draft outbound dispatch lines (preview + post).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CrmDrawerShell } from '@/components/crm/CrmDrawerShell'
import { Button } from '@/components/ui/Button'
import { notify } from '@/store/toastStore'
import {
  getDispatchReservationPosition,
  postDispatchReservations,
  previewDispatchReservations,
  type DispatchReservationPosition,
  type ReservationPreviewLine,
} from '@/services/api/dispatchApi'

type Props = {
  open: boolean
  onClose: () => void
  dispatchId: string
  onReserved?: () => void
}

type LineDraft = {
  outboundDispatchLineId: string
  lineNo: number
  itemId: string
  dispatchQty: number
  unreservedQty: number
  quantity: string
}

export function DispatchReservationDrawer({ open, onClose, dispatchId, onReserved }: Props) {
  const [position, setPosition] = useState<DispatchReservationPosition | null>(null)
  const [lines, setLines] = useState<LineDraft[]>([])
  const [previews, setPreviews] = useState<ReservationPreviewLine[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!dispatchId) return
    setLoading(true)
    try {
      const pos = await getDispatchReservationPosition(dispatchId)
      setPosition(pos)
      const drafts: LineDraft[] = (pos?.lines ?? [])
        .filter((l) => l.unreservedQty > 0)
        .map((l) => ({
          outboundDispatchLineId: l.outboundDispatchLineId,
          lineNo: l.lineNo,
          itemId: l.itemId,
          dispatchQty: l.dispatchQty,
          unreservedQty: l.unreservedQty,
          quantity: String(l.unreservedQty),
        }))
      setLines(drafts)
      setPreviews([])
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to load reservation position')
      setPosition(null)
      setLines([])
    } finally {
      setLoading(false)
    }
  }, [dispatchId])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const previewMap = useMemo(
    () => new Map(previews.map((p) => [p.outboundDispatchLineId, p])),
    [previews],
  )

  async function runPreview(nextLines: LineDraft[]) {
    const payload = nextLines
      .map((l) => ({
        outboundDispatchLineId: l.outboundDispatchLineId,
        quantity: Number(l.quantity) || 0,
      }))
      .filter((l) => l.quantity > 0)
    if (!payload.length) {
      setPreviews([])
      return
    }
    try {
      setPreviews(await previewDispatchReservations(dispatchId, payload))
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Preview failed')
    }
  }

  function updateQty(lineId: string, value: string) {
    setLines((prev) => {
      const next = prev.map((l) =>
        l.outboundDispatchLineId === lineId ? { ...l, quantity: value } : l,
      )
      void runPreview(next)
      return next
    })
  }

  function reserveAvailable() {
    setLines((prev) => {
      const next = prev.map((l) => {
        const allowed = previewMap.get(l.outboundDispatchLineId)?.allowedQty ?? l.unreservedQty
        return { ...l, quantity: String(allowed) }
      })
      void runPreview(next)
      return next
    })
  }

  async function reserveStock() {
    if (busy) return
    const payload = lines
      .map((l) => ({
        outboundDispatchLineId: l.outboundDispatchLineId,
        quantity: Number(l.quantity) || 0,
      }))
      .filter((l) => l.quantity > 0)
    if (!payload.length) {
      notify.error('Enter quantity for at least one line')
      return
    }
    setBusy(true)
    try {
      const preview = await previewDispatchReservations(dispatchId, payload)
      setPreviews(preview)
      if (preview.some((p) => !p.ok)) {
        notify.error('Fix validation errors before reserving')
        return
      }
      await postDispatchReservations(dispatchId, {
        lines: payload,
        idempotencyKey: `reserve-${dispatchId}-${Date.now()}`,
      })
      notify.success('Stock reserved (allocation only — not dispatched)')
      onReserved?.()
      onClose()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Reserve failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <CrmDrawerShell
      open={open}
      onClose={onClose}
      title="Reserve stock"
      subtitle={
        position
          ? `${position.dispatchNo} · Reserved ≠ Dispatched (allocation only)`
          : 'Loading…'
      }
      eyebrow="Logistics"
      width="lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => reserveAvailable()} disabled={busy || loading}>
            Reserve Available
          </Button>
          <Button size="sm" onClick={() => void reserveStock()} disabled={busy || loading || !lines.length}>
            Reserve Stock
          </Button>
        </div>
      }
    >
      {loading ? (
        <p className="text-sm text-erp-muted">Loading lines…</p>
      ) : !lines.length ? (
        <p className="text-sm text-erp-muted">All dispatch lines are fully reserved.</p>
      ) : (
        <div className="space-y-4">
          {lines.map((line) => {
            const preview = previewMap.get(line.outboundDispatchLineId)
            return (
              <div
                key={line.outboundDispatchLineId}
                className="rounded-md border border-erp-border p-3 space-y-2"
              >
                <div className="flex justify-between text-sm">
                  <span className="font-medium">
                    Line {line.lineNo} · {line.itemId.slice(0, 8)}
                  </span>
                  <span className="text-erp-muted">
                    Unreserved {line.unreservedQty} / {line.dispatchQty}
                  </span>
                </div>
                <label className="block text-sm">
                  <span className="text-erp-muted">Quantity to reserve</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    className="mt-1 w-full rounded border border-erp-border px-2 py-1.5 text-sm"
                    value={line.quantity}
                    onChange={(e) => updateQty(line.outboundDispatchLineId, e.target.value)}
                  />
                </label>
                {preview ? (
                  <p className={`text-xs ${preview.ok ? 'text-green-700' : 'text-red-600'}`}>
                    Available {preview.allowedQty ?? '—'} · {preview.message}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </CrmDrawerShell>
  )
}
