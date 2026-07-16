import { useState } from 'react'
import { CrmDrawerShell } from '@/components/crm/CrmDrawerShell'
import type { InventoryReceipt, MovementLine, QualityDisposition } from '@/types/inventoryDomain'
import { QUALITY_DISPOSITION_LABELS } from '@/utils/inventoryMovementLabels'
import { notify } from '@/store/toastStore'
import { updateReceiptDraft } from '@/services/inventory'

interface QualityReviewDrawerProps {
  open: boolean
  receipt: InventoryReceipt | null
  onClose: () => void
  onUpdated: (receipt: InventoryReceipt) => void
}

export function QualityReviewDrawer({ open, receipt, onClose, onUpdated }: QualityReviewDrawerProps) {
  const [lines, setLines] = useState<MovementLine[]>([])
  const [saving, setSaving] = useState(false)

  const initLines = receipt?.lines ?? []

  const workingLines = lines.length ? lines : initLines

  const setLine = (lineId: string, patch: Partial<MovementLine>) => {
    setLines(workingLines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)))
  }

  const save = async (action: 'release' | 'reject' | 'hold') => {
    if (!receipt) return
    setSaving(true)
    try {
      const updatedLines = workingLines.map((l) => {
        if (action === 'release') {
          return { ...l, acceptedQty: l.receivedQty, rejectedQty: 0, quarantineQty: 0, qualityStatus: 'available' as QualityDisposition }
        }
        if (action === 'reject') {
          return { ...l, acceptedQty: 0, rejectedQty: l.receivedQty, quarantineQty: 0, qualityStatus: 'rejected' as QualityDisposition }
        }
        return { ...l, acceptedQty: 0, rejectedQty: 0, quarantineQty: l.receivedQty, qualityStatus: 'quarantine' as QualityDisposition }
      })
      const updated = await updateReceiptDraft(receipt.id, {
        lines: updatedLines.map((l) => ({
          itemId: l.itemId,
          receivedQty: l.receivedQty,
          acceptedQty: l.acceptedQty,
          rejectedQty: l.rejectedQty,
          quarantineQty: l.quarantineQty,
          pendingQty: l.pendingQty,
        })),
      })
      updated.status = action === 'release' ? 'pending_receipt' : action === 'hold' ? 'quality_hold' : 'rejected'
      onUpdated(updated)
      notify.success(`Quality review: ${action}`)
      onClose()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Quality review failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CrmDrawerShell
      open={open}
      onClose={onClose}
      title="Quality Review"
      subtitle={receipt?.documentNumber}
      width="lg"
      footer={(
        <div className="flex flex-wrap gap-2">
          <button type="button" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]" disabled={saving} onClick={() => void save('release')}>Release to Available</button>
          <button type="button" className="erp-btn erp-btn-secondary h-9 px-4 text-[13px]" disabled={saving} onClick={() => void save('hold')}>Move to Quarantine</button>
          <button type="button" className="erp-btn erp-btn-ghost h-9 px-4 text-[13px] text-red-700" disabled={saving} onClick={() => void save('reject')}>Reject</button>
        </div>
      )}
    >
      {receipt ? (
        <div className="space-y-4 text-[13px]">
          <p className="text-erp-muted">Inspect received quantities and set disposition per line.</p>
          <table className="erp-table w-full">
            <thead><tr><th>Item</th><th className="text-right">Received</th><th className="text-right">Accepted</th><th className="text-right">Rejected</th><th className="text-right">Quarantine</th><th>Status</th></tr></thead>
            <tbody>
              {workingLines.filter((l) => l.receivedQty > 0).map((line) => (
                <tr key={line.id}>
                  <td><span className="font-mono text-xs">{line.itemCode}</span></td>
                  <td className="text-right font-mono">{line.receivedQty}</td>
                  <td className="text-right"><input type="number" min={0} max={line.receivedQty} className="erp-input h-8 w-16 text-right" value={line.acceptedQty} onChange={(e) => setLine(line.id, { acceptedQty: Number(e.target.value) })} /></td>
                  <td className="text-right"><input type="number" min={0} className="erp-input h-8 w-16 text-right" value={line.rejectedQty} onChange={(e) => setLine(line.id, { rejectedQty: Number(e.target.value) })} /></td>
                  <td className="text-right"><input type="number" min={0} className="erp-input h-8 w-16 text-right" value={line.quarantineQty} onChange={(e) => setLine(line.id, { quarantineQty: Number(e.target.value) })} /></td>
                  <td>{QUALITY_DISPOSITION_LABELS[line.qualityStatus]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </CrmDrawerShell>
  )
}
