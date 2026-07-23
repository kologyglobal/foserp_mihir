import { useEffect, useState } from 'react'
import { CrmDrawerShell } from '@/components/crm/CrmDrawerShell'
import { FormActionBar } from '@/components/erp/FormActionBar'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
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

export type PlanningBuyerOption = { id: string; name: string }

type Props = {
  open: boolean
  row: PurchasePlanningSheetRow | null
  vendors: Vendor[]
  buyers: PlanningBuyerOption[]
  saving?: boolean
  onClose: () => void
  onSave: (patch: PurchasePlanningSheetInput) => Promise<void>
}

export function PurchasePlanningEditDrawer({
  open,
  row,
  vendors,
  buyers,
  saving,
  onClose,
  onSave,
}: Props) {
  const [preferredVendorId, setPreferredVendorId] = useState('')
  const [expectedRate, setExpectedRate] = useState(0)
  const [negotiatedRate, setNegotiatedRate] = useState<string>('')
  const [requiredByDate, setRequiredByDate] = useState('')
  const [purchaseType, setPurchaseType] = useState<PurchasePlanningPurchaseType>('direct_purchase')
  const [buyerId, setBuyerId] = useState('')
  const [priority, setPriority] = useState<PurchasePlanningPriority>('medium')
  const [remarks, setRemarks] = useState('')

  useEffect(() => {
    if (!row || !open) return
    setPreferredVendorId(row.preferredVendorId ?? '')
    setExpectedRate(row.expectedRate)
    setNegotiatedRate(row.negotiatedRate == null ? '' : String(row.negotiatedRate))
    setRequiredByDate(row.requiredByDate || '')
    setPurchaseType(row.purchaseType)
    setBuyerId(row.buyerId || '')
    setPriority(row.priority)
    setRemarks(row.remarks || '')
  }, [row, open])

  if (!row) return null

  const selectedBuyer = buyers.find((b) => b.id === buyerId)
  const dirty =
    preferredVendorId !== (row.preferredVendorId ?? '') ||
    Number(expectedRate) !== Number(row.expectedRate) ||
    negotiatedRate !== (row.negotiatedRate == null ? '' : String(row.negotiatedRate)) ||
    requiredByDate !== (row.requiredByDate || '') ||
    purchaseType !== row.purchaseType ||
    buyerId !== (row.buyerId || '') ||
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
              buyerId,
              buyerName: selectedBuyer?.name ?? row.buyerName,
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
          <ErpViewField label="PR Line" value={row.purchaseRequisitionLineId || '—'} />
          <ErpViewField label="Item" value={`${row.itemCode} — ${row.itemName}`} />
          <ErpViewField label="Required Quantity" value={String(row.requiredQuantity)} />
          <ErpViewField label="Current Stock" value={String(row.currentStock)} />
          <ErpViewField label="Open PO Quantity" value={String(row.openPoQuantity)} />
          <ErpViewField label="Net Purchase Quantity" value={String(row.netPurchaseQuantity)} />
          <ErpViewField
            label="PO Reference"
            value={row.purchaseOrderNumber || '—'}
          />
        </div>

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
          <ErpFieldRow label="Buyer" horizontal={false}>
            <Select value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
              <option value="">— Select buyer —</option>
              {buyers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
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
