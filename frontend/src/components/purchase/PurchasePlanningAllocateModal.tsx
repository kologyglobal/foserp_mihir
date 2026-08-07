import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Modal } from '@/design-system/components/Modal'
import { ErpButton } from '@/components/erp/ErpButton'
import { DecimalInput, Input, Select } from '@/components/forms/Inputs'
import type { Vendor } from '@/types/purchaseDomain'
import type { FeConsolidatedGroup } from '@/utils/purchase/purchasePlanningConsolidation'
import {
  assertAllocationBalances,
} from '@/utils/purchase/purchasePlanningConsolidation'
import { formatCurrency } from '@/utils/formatters/currency'

export type PlanningAllocationLine = {
  vendorId: string
  quantity: number
  rate: number
}

type Props = {
  open: boolean
  group: FeConsolidatedGroup | null
  vendors: Vendor[]
  busy?: boolean
  onClose: () => void
  onConfirm: (allocations: PlanningAllocationLine[]) => void | Promise<void>
}

export function PurchasePlanningAllocateModal({
  open,
  group,
  vendors,
  busy,
  onClose,
  onConfirm,
}: Props) {
  const requiredQty = group?.totalNetQty || group?.totalRequiredQty || 0
  const defaultRate =
    group?.members.find((m) => (m.negotiatedRate ?? m.expectedRate) > 0)?.negotiatedRate ??
    group?.members.find((m) => m.expectedRate > 0)?.expectedRate ??
    0
  const suggestedVendorId = group?.suggestedVendors[0]?.id ?? ''

  const [lines, setLines] = useState<PlanningAllocationLine[]>([
    {
      vendorId: suggestedVendorId,
      quantity: requiredQty,
      rate: defaultRate || 0,
    },
  ])
  const [error, setError] = useState<string | null>(null)
  const groupKey = group?.groupKey

  useEffect(() => {
    if (!open || !group) return
    setLines([
      {
        vendorId: group.suggestedVendors[0]?.id ?? '',
        quantity: group.totalNetQty || group.totalRequiredQty || 0,
        rate:
          group.members.find((m) => (m.negotiatedRate ?? m.expectedRate) > 0)?.negotiatedRate ??
          group.members.find((m) => m.expectedRate > 0)?.expectedRate ??
          0,
      },
    ])
    setError(null)
  }, [open, groupKey, group])

  const allocated = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0)
  const balance = Number((requiredQty - allocated).toFixed(4))
  const linesValid = lines.every(
    (l) => Boolean(l.vendorId?.trim()) && Number(l.quantity) > 0 && Number(l.rate) > 0,
  )
  // Partial raise: Create when 0 < allocated ≤ required and all vendor rows are valid.
  const canCreate =
    linesValid && allocated > 0 && allocated - requiredQty <= 0.0001

  if (!open || !group) return null

  const patchLine = (index: number, patch: Partial<PlanningAllocationLine>) => {
    setLines((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const handleConfirm = async () => {
    try {
      assertAllocationBalances(requiredQty, lines)
      setError(null)
      await onConfirm(lines)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid allocation')
    }
  }

  const balanceTone =
    balance < -0.0001
      ? 'text-red-700'
      : balance > 0.0001
        ? 'text-amber-700'
        : 'text-emerald-700'

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Procure allocation"
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <ErpButton type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </ErpButton>
          <ErpButton
            type="button"
            variant="primary"
            disabled={busy || !canCreate}
            onClick={() => void handleConfirm()}
          >
            Create PO(s) for vendors
          </ErpButton>
        </div>
      }
    >
      <div className="space-y-3 text-[13px]">
        <div className="rounded-md border border-erp-border bg-erp-surface-alt/50 px-3 py-2">
          <div className="font-semibold text-erp-text">
            {group.itemCode} · {group.itemName}
          </div>
          <div className="mt-1 text-[12px] text-erp-muted">{group.description}</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
            <span>
              Open / required qty:{' '}
              <strong className="tabular-nums text-erp-text">{requiredQty}</strong>
            </span>
            <span>
              PRs: <strong className="tabular-nums text-erp-text">{group.prCount}</strong>
            </span>
            <span>
              Earliest need: <strong className="text-erp-text">{group.earliestRequiredDate || '-'}</strong>
            </span>
          </div>
        </div>

        <div className="rounded-md border border-erp-border">
          <div className="border-b border-erp-border bg-erp-surface-alt px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
            Contributing PRs
          </div>
          <ul className="max-h-32 divide-y divide-erp-border overflow-y-auto text-[12px]">
            {group.members.map((m) => (
              <li key={m.planningRowId} className="flex justify-between gap-3 px-3 py-1.5">
                <span className="font-medium">{m.purchaseRequisitionNumber}</span>
                <span className="tabular-nums text-erp-muted">{m.netPurchaseQuantity || m.requiredQuantity}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="overflow-x-auto rounded-md border border-erp-border">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-erp-surface-alt text-[10px] uppercase tracking-wide text-erp-muted">
              <tr>
                <th className="px-2 py-1.5">Vendor</th>
                <th className="px-2 py-1.5 w-28">Qty</th>
                <th className="px-2 py-1.5 w-28">Rate</th>
                <th className="px-2 py-1.5 w-28">Amount</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} className="border-t border-erp-border">
                  <td className="px-2 py-1.5">
                    <Select
                      value={line.vendorId}
                      onChange={(e) => patchLine(index, { vendorId: e.target.value })}
                    >
                      <option value="">— Select —</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.vendorName || v.vendorCode}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-2 py-1.5">
                    <DecimalInput
                      min={0}
                      value={line.quantity}
                      onChange={(v) => patchLine(index, { quantity: v })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={line.rate}
                      onChange={(e) => patchLine(index, { rate: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">
                    {formatCurrency((Number(line.quantity) || 0) * (Number(line.rate) || 0))}
                  </td>
                  <td className="px-1 py-1.5">
                    <button
                      type="button"
                      className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt hover:text-red-600 disabled:opacity-40"
                      disabled={lines.length <= 1}
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                      aria-label="Remove allocation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <ErpButton
            type="button"
            size="sm"
            variant="outline"
            icon={Plus}
            onClick={() =>
              setLines((prev) => [
                ...prev,
                { vendorId: '', quantity: Math.max(0, balance), rate: defaultRate || 0 },
              ])
            }
          >
            Split to another vendor
          </ErpButton>
          <div className={`text-[12px] font-semibold tabular-nums ${balanceTone}`}>
            Allocated {allocated} / {requiredQty}
            {balance > 0.0001
              ? ` · ${balance} stays open / pending`
              : balance < -0.0001
                ? ` · over by ${Math.abs(balance)}`
                : ' · fully allocated'}
          </div>
        </div>

        {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
        <p className="text-[11px] text-erp-muted">
          Creates one draft Purchase Order per vendor for the allocated qty only. Unallocated qty stays
          open on the planning sheet (Partially Ordered) so you can raise more POs later. PO lines keep
          PR breakdown (FIFO by required date). PR documents are not merged.
        </p>
      </div>
    </Modal>
  )
}
