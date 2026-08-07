import { useEffect, useMemo, useState } from 'react'
import { CrmDrawerShell } from '@/components/crm/CrmDrawerShell'
import { FormActionBar } from '@/components/erp/FormActionBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { ErpFieldRow, ErpViewField } from '@/components/erp/card-form'
import { TableLink } from '@/components/ui/AppLink'
import {
  PURCHASE_PLANNING_PRIORITIES,
  PURCHASE_PLANNING_PRIORITY_LABELS,
  PURCHASE_PLANNING_PURCHASE_TYPES,
  PURCHASE_PLANNING_PURCHASE_TYPE_LABELS,
  type PurchasePlanningSheetInput,
} from '@/services/purchase'
import type {
  PurchasePlanningPriority,
  PurchasePlanningPurchaseType,
  PurchasePlanningSheetRow,
  Vendor,
} from '@/types/purchaseDomain'
import { formatCurrency } from '@/utils/formatters/currency'

type SplitRow = { vendorId: string; allocatedQuantity: string }

type Props = {
  open: boolean
  row: PurchasePlanningSheetRow | null
  vendors: Vendor[]
  saving?: boolean
  splitting?: boolean
  onClose: () => void
  onSave: (patch: PurchasePlanningSheetInput) => Promise<void>
  onSplit?: (splits: Array<{ vendorId: string; allocatedQuantity: number }>) => Promise<void>
}

function canSplitRow(row: PurchasePlanningSheetRow): boolean {
  if (row.orderedQuantity > 0) return false
  if (['cancelled', 'po_created', 'completed'].includes(row.status)) return false
  const alloc = row.allocatedQuantity || row.netPurchaseQuantity || row.requiredQuantity
  return alloc > 0
}

export function PurchasePlanningEditDrawer({
  open,
  row,
  vendors,
  saving,
  splitting,
  onClose,
  onSave,
  onSplit,
}: Props) {
  const [preferredVendorId, setPreferredVendorId] = useState('')
  const [expectedRate, setExpectedRate] = useState(0)
  const [negotiatedRate, setNegotiatedRate] = useState<string>('')
  const [requiredByDate, setRequiredByDate] = useState('')
  const [purchaseType, setPurchaseType] = useState<PurchasePlanningPurchaseType>('direct_purchase')
  const [priority, setPriority] = useState<PurchasePlanningPriority>('medium')
  const [remarks, setRemarks] = useState('')
  const [splitRows, setSplitRows] = useState<SplitRow[]>([])

  const allocatedQty = useMemo(() => {
    if (!row) return 0
    return row.allocatedQuantity || row.netPurchaseQuantity || row.requiredQuantity
  }, [row])

  useEffect(() => {
    if (!row || !open) return
    setPreferredVendorId(row.preferredVendorId ?? '')
    setExpectedRate(row.expectedRate)
    setNegotiatedRate(row.negotiatedRate == null ? '' : String(row.negotiatedRate))
    setRequiredByDate(row.requiredByDate || '')
    setPurchaseType(row.purchaseType)
    setPriority(row.priority)
    setRemarks(row.remarks || '')
    setSplitRows([
      { vendorId: row.preferredVendorId ?? '', allocatedQuantity: String(allocatedQty) },
      { vendorId: '', allocatedQuantity: '' },
    ])
  }, [row, open, allocatedQty])

  if (!row) return null

  const splitTotal = splitRows.reduce((s, r) => s + (Number(r.allocatedQuantity) || 0), 0)
  const splitValid =
    splitRows.length >= 2 &&
    splitRows.every((r) => r.vendorId && Number(r.allocatedQuantity) > 0) &&
    Math.abs(splitTotal - allocatedQty) < 1e-6
  const showSplit = Boolean(onSplit && canSplitRow(row))

  const dirty =
    preferredVendorId !== (row.preferredVendorId ?? '') ||
    Number(expectedRate) !== Number(row.expectedRate) ||
    negotiatedRate !== (row.negotiatedRate == null ? '' : String(row.negotiatedRate)) ||
    requiredByDate !== (row.requiredByDate || '') ||
    purchaseType !== row.purchaseType ||
    priority !== row.priority ||
    remarks !== (row.remarks || '')

  return (
    <CrmDrawerShell
      open={open}
      onClose={onClose}
      title={`Edit ${row.planningNumber}`}
      subtitle={`${row.itemCode} · ${row.itemName}`}
      eyebrow="Purchase"
      width="lg"
      footer={
        <FormActionBar
          embedded
          cancelFirst
          busy={saving}
          dirty={dirty}
          onCancel={onClose}
          onSave={() =>
            onSave({
              preferredVendorId: preferredVendorId || null,
              expectedRate: Number(expectedRate) || 0,
              negotiatedRate: negotiatedRate.trim() === '' ? null : Number(negotiatedRate),
              requiredByDate,
              purchaseType,
              priority,
              remarks,
            })
          }
        />
      }
    >
      <div className="space-y-4 p-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <ErpViewField
            label="PR Number"
            value={
              <TableLink to={`/purchase/requisitions/${row.purchaseRequisitionId}`}>
                {row.purchaseRequisitionNumber}
              </TableLink>
            }
          />
          <ErpViewField label="PR Line" value={row.purchaseRequisitionLineId || '-'} />
          <ErpViewField label="Item" value={`${row.itemCode} — ${row.itemName}`} />
          <ErpViewField label="Required Quantity" value={String(row.requiredQuantity)} />
          <ErpViewField label="Allocated" value={String(row.allocatedQuantity || row.netPurchaseQuantity)} />
          <ErpViewField label="Ordered" value={String(row.orderedQuantity)} />
          <ErpViewField label="Remaining" value={String(row.remainingQuantity)} />
          <ErpViewField label="Current Stock" value={String(row.currentStock)} />
          <ErpViewField label="Open PO Quantity" value={String(row.openPoQuantity)} />
          <ErpViewField
            label="PO Reference"
            value={row.purchaseOrderNumber || '-'}
          />
        </div>

        {showSplit ? (
          <div className="rounded-md border border-erp-border bg-erp-surface-alt/40 p-3">
            <p className="text-[13px] font-semibold text-erp-text">Split by vendor</p>
            <p className="mt-1 text-[12px] text-erp-muted">
              Distribute {allocatedQty} units across vendors. Split totals must equal allocated quantity.
            </p>
            <div className="mt-3 space-y-2">
              {splitRows.map((split, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                  <Select
                    value={split.vendorId}
                    onChange={(e) => {
                      const next = [...splitRows]
                      next[index] = { ...next[index], vendorId: e.target.value }
                      setSplitRows(next)
                    }}
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vendorName}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    placeholder="Qty"
                    value={split.allocatedQuantity}
                    onChange={(e) => {
                      const next = [...splitRows]
                      next[index] = { ...next[index], allocatedQuantity: e.target.value }
                      setSplitRows(next)
                    }}
                  />
                  {splitRows.length > 2 ? (
                    <ErpButton
                      type="button"
                      variant="secondary"
                      onClick={() => setSplitRows(splitRows.filter((_, i) => i !== index))}
                    >
                      Remove
                    </ErpButton>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <span className={Math.abs(splitTotal - allocatedQty) < 1e-6 ? 'text-emerald-700' : 'text-red-700'}>
                Split total: {splitTotal} / {allocatedQty}
              </span>
              <div className="flex gap-2">
                <ErpButton
                  type="button"
                  variant="secondary"
                  onClick={() => setSplitRows([...splitRows, { vendorId: '', allocatedQuantity: '' }])}
                >
                  Add vendor
                </ErpButton>
                <ErpButton
                  type="button"
                  variant="primary"
                  disabled={!splitValid || splitting}
                  onClick={() =>
                    void onSplit?.(
                      splitRows.map((r) => ({
                        vendorId: r.vendorId,
                        allocatedQuantity: Number(r.allocatedQuantity),
                      })),
                    )
                  }
                >
                  {splitting ? 'Splitting…' : 'Apply split'}
                </ErpButton>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <ErpFieldRow label="Selected Vendor" horizontal={false}>
            <Select
              value={preferredVendorId}
              onChange={(e) => setPreferredVendorId(e.target.value)}
            >
              <option value="">— Select vendor —</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vendorName}
                </option>
              ))}
            </Select>
          </ErpFieldRow>
          <ErpFieldRow label="Expected Rate" horizontal={false}>
            <Input
              type="number"
              min={0}
              step="any"
              value={expectedRate}
              onChange={(e) => setExpectedRate(Number(e.target.value))}
            />
          </ErpFieldRow>
          <ErpFieldRow label="Negotiated Rate" horizontal={false}>
            <Input
              type="number"
              min={0}
              step="any"
              value={negotiatedRate}
              onChange={(e) => setNegotiatedRate(e.target.value)}
              placeholder="Optional"
            />
          </ErpFieldRow>
          <ErpFieldRow label="Required Date" horizontal={false}>
            <Input
              type="date"
              value={requiredByDate}
              onChange={(e) => setRequiredByDate(e.target.value)}
            />
          </ErpFieldRow>
          <ErpFieldRow label="Purchase Type" horizontal={false}>
            <Select
              value={purchaseType}
              onChange={(e) => setPurchaseType(e.target.value as PurchasePlanningPurchaseType)}
            >
              {PURCHASE_PLANNING_PURCHASE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PURCHASE_PLANNING_PURCHASE_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </ErpFieldRow>
          <ErpFieldRow label="Priority" horizontal={false}>
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PurchasePlanningPriority)}
            >
              {PURCHASE_PLANNING_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PURCHASE_PLANNING_PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          </ErpFieldRow>
          <div className="sm:col-span-2">
            <ErpFieldRow label="Remarks" horizontal={false}>
              <Textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </ErpFieldRow>
          </div>
          <ErpViewField
            label="Estimated Amount (preview)"
            value={formatCurrency(
              Math.max(0, row.netPurchaseQuantity || row.requiredQuantity) *
                (Number(expectedRate) || 0),
            )}
          />
        </div>
      </div>
    </CrmDrawerShell>
  )
}
