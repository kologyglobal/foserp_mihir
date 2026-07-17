import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, RotateCw, Save } from 'lucide-react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import { ErpCardSection, ErpFieldRow, ErpStickySaveBar } from '@/components/erp/card-form'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Input, Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getPurchaseOrderById,
  revisePurchaseOrder,
  PurchaseServiceError,
  PURCHASE_ORDER_DOMAIN_STATUS_LABELS,
} from '@/services/purchase'
import type { PurchaseOrder, PurchaseOrderLine, PurchaseOrderReviseInput } from '@/types/purchaseDomain'
import { purchaseStatusTone } from '@/components/purchase/purchaseCardFormShared'
import { PurchaseTermsNotesTabs } from '@/components/purchase/PurchaseTermsNotesTabs'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import {
  commercialTermsSummary,
  notesSummary,
} from '@/modules/purchase/purchaseFastTabSummaries'

const REVISABLE_STATUSES: PurchaseOrder['status'][] = [
  'released',
  'partially_received',
  'fully_received',
  'invoiced',
]

interface RevisableLine {
  id: string
  itemId: string
  itemCode: string
  itemName: string
  uom: string
  originalQuantity: number
  originalRate: number
  quantity: number
  rate: number
  receivedQty: number
}

interface Hint {
  label: string
  original: string
  next: string
}

function ChangedHint({ changed, original }: { changed: boolean; original: string }) {
  if (!changed) return null
  return <p className="mt-1 text-[11px] text-erp-warning-fg">was: {original}</p>
}

export function PurchaseOrderRevisePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [po, setPo] = useState<PurchaseOrder | null>(null)
  const [reason, setReason] = useState('')
  const [lines, setLines] = useState<RevisableLine[]>([])

  const [paymentTerms, setPaymentTerms] = useState('')
  const [deliveryTerms, setDeliveryTerms] = useState('')
  const [freightTerms, setFreightTerms] = useState('')
  const [packingTerms, setPackingTerms] = useState('')
  const [insuranceTerms, setInsuranceTerms] = useState('')
  const [warranty, setWarranty] = useState('')
  const [inspectionRequirement, setInspectionRequirement] = useState('')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [freight, setFreight] = useState(0)
  const [packingCharges, setPackingCharges] = useState(0)
  const [insuranceCharges, setInsuranceCharges] = useState(0)
  const [otherCharges, setOtherCharges] = useState(0)
  const [tradeDiscount, setTradeDiscount] = useState(0)
  const [internalNotes, setInternalNotes] = useState('')
  const [termsAndConditions, setTermsAndConditions] = useState('')
  const [remarks, setRemarks] = useState('')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const row = await getPurchaseOrderById(id)
      if (cancelled) return
      if (!row) {
        notify.error('Purchase order not found')
        navigate('/purchase/orders')
        return
      }
      if (!REVISABLE_STATUSES.includes(row.status)) {
        if (row.status === 'draft' || row.status === 'pending_approval') {
          notify.info('This order is still editable — opening the editor')
          navigate(`/purchase/orders/${row.id}/edit`, { replace: true })
        } else {
          notify.info(`${row.documentNumber} (${PURCHASE_ORDER_DOMAIN_STATUS_LABELS[row.status]}) cannot be revised`)
          navigate(`/purchase/orders/${row.id}`, { replace: true })
        }
        return
      }
      setPo(row)
      setLines(
        row.lines.map((l: PurchaseOrderLine) => ({
          id: l.id,
          itemId: l.itemId,
          itemCode: l.itemCode,
          itemName: l.itemName,
          uom: l.uom,
          originalQuantity: l.quantity,
          originalRate: l.rate,
          quantity: l.quantity,
          rate: l.rate,
          receivedQty: l.receivedQty,
        })),
      )
      setPaymentTerms(row.paymentTerms)
      setDeliveryTerms(row.deliveryTerms)
      setFreightTerms(row.freightTerms)
      setPackingTerms(row.packingTerms)
      setInsuranceTerms(row.insuranceTerms)
      setWarranty(row.warranty)
      setInspectionRequirement(row.inspectionRequirement)
      setExpectedDeliveryDate(row.expectedDeliveryDate)
      setFreight(row.freight)
      setPackingCharges(row.packingCharges)
      setInsuranceCharges(row.insuranceCharges)
      setOtherCharges(row.otherCharges)
      setTradeDiscount(row.tradeDiscount)
      setInternalNotes(row.internalNotes)
      setTermsAndConditions(row.termsAndConditions)
      setRemarks(row.remarks)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  const commercialHints: Hint[] = useMemo(() => {
    if (!po) return []
    const rows: Hint[] = []
    const push = (label: string, original: string, next: string) => {
      if (original !== next) rows.push({ label, original, next })
    }
    push('Payment Terms', po.paymentTerms, paymentTerms)
    push('Delivery Terms', po.deliveryTerms, deliveryTerms)
    push('Freight Terms', po.freightTerms, freightTerms)
    push('Packing Terms', po.packingTerms, packingTerms)
    push('Insurance Terms', po.insuranceTerms, insuranceTerms)
    push('Warranty', po.warranty, warranty)
    push('Inspection Requirement', po.inspectionRequirement, inspectionRequirement)
    push('Expected Delivery Date', po.expectedDeliveryDate, expectedDeliveryDate)
    push('Freight', formatCurrency(po.freight), formatCurrency(freight))
    push('Packing Charges', formatCurrency(po.packingCharges), formatCurrency(packingCharges))
    push('Insurance Charges', formatCurrency(po.insuranceCharges), formatCurrency(insuranceCharges))
    push('Other Charges', formatCurrency(po.otherCharges), formatCurrency(otherCharges))
    push('Trade Discount', formatCurrency(po.tradeDiscount), formatCurrency(tradeDiscount))
    return rows
  }, [
    po,
    paymentTerms,
    deliveryTerms,
    freightTerms,
    packingTerms,
    insuranceTerms,
    warranty,
    inspectionRequirement,
    expectedDeliveryDate,
    freight,
    packingCharges,
    insuranceCharges,
    otherCharges,
    tradeDiscount,
  ])

  const lineChangeCount = lines.filter((l) => l.quantity !== l.originalQuantity || l.rate !== l.originalRate).length
  const newValue = lines.reduce((s, l) => s + l.quantity * l.rate, 0)
  const commercialPeek = commercialTermsSummary({
    expectedDelivery: expectedDeliveryDate,
    paymentTerms,
    freightTerms,
    deliveryTerms,
  })
  const notesPeek = notesSummary(termsAndConditions, internalNotes, remarks)

  const patchLine = (lineId: string, patch: Partial<Pick<RevisableLine, 'quantity' | 'rate'>>) => {
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l)))
  }

  const save = async () => {
    if (!po) return
    if (!reason.trim()) {
      notify.error('Revision reason is required')
      return
    }
    setSaving(true)
    try {
      const input: PurchaseOrderReviseInput = {
        reason: reason.trim(),
        lines: lines
          .filter((l) => l.quantity !== l.originalQuantity || l.rate !== l.originalRate)
          .map((l) => ({ id: l.id, itemId: l.itemId, quantity: l.quantity, rate: l.rate })),
        paymentTerms,
        deliveryTerms,
        freightTerms,
        packingTerms,
        insuranceTerms,
        warranty,
        inspectionRequirement,
        expectedDeliveryDate,
        freight,
        packingCharges,
        insuranceCharges,
        otherCharges,
        tradeDiscount,
        internalNotes,
        termsAndConditions,
        remarks,
      }
      const revised = await revisePurchaseOrder(po.id, input)
      notify.success(`${revised.documentNumber} revised · Rev ${revised.revisionNo}`)
      navigate(`/purchase/orders/${revised.id}`)
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Revision failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !po) {
    return (
      <PurchaseCardFormShell
        title="Revise Purchase Order"
        description="Loading…"
        status="…"
        favoritePath="/purchase/orders"
        breadcrumbs={[{ label: 'Purchase Orders', to: '/purchase/orders' }, { label: 'Loading' }]}
        footer={null}
      >
        <LoadingState variant="form" rows={8} />
      </PurchaseCardFormShell>
    )
  }

  return (
    <PurchaseCardFormShell
      title={`Revise ${po.documentNumber}`}
      description={`Creates revision ${po.revisionNo + 1} — vendor already released. Provide a reason and adjust rates, quantities, or commercial terms.`}
      recordNo={po.documentNumber}
      status={PURCHASE_ORDER_DOMAIN_STATUS_LABELS[po.status]}
      statusTone={purchaseStatusTone(po.status)}
      favoritePath={`/purchase/orders/${po.id}/revise`}
      breadcrumbs={[
        { label: 'Purchase Orders', to: '/purchase/orders' },
        { label: po.documentNumber, to: `/purchase/orders/${po.id}` },
        { label: 'Revise' },
      ]}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'save',
            label: saving ? 'Saving…' : `Save as Rev ${po.revisionNo + 1}`,
            icon: Save,
            onClick: () => void save(),
            disabled: saving || !reason.trim(),
          }}
        />
      }
      footer={
        <ErpStickySaveBar
          sticky
          onSave={() => void save()}
          submitLabel={`Save as Rev ${po.revisionNo + 1}`}
          isSubmitting={saving}
          submitDisabled={saving || !reason.trim()}
          submitDisabledReason={!reason.trim() ? 'Revision reason is required' : undefined}
          cancelLabel="Back"
          onCancel={() => navigate(`/purchase/orders/${po.id}`)}
        />
      }
    >
      <ErpCardSection title="Revision Reason" collapsible defaultOpen>
        <div className="flex items-start gap-2 rounded-md border border-erp-warning-border bg-erp-warning-soft p-3 text-[12px] text-erp-warning-fg">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This order is <strong>{PURCHASE_ORDER_DOMAIN_STATUS_LABELS[po.status]}</strong>. Saving creates
            revision <strong>{po.revisionNo + 1}</strong> and is recorded in change history.
          </p>
        </div>
        <ErpFieldRow label="Reason for Revision" required className="mt-3 sm:col-span-2 lg:col-span-3">
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why this order is being revised" />
        </ErpFieldRow>
      </ErpCardSection>

      <ErpCardSection title="Item Lines" collapsible defaultOpen>
        <p className="mb-2 text-[12px] text-erp-muted">
          {lineChangeCount} of {lines.length} line(s) changed · New order value {formatCurrency(newValue)}
        </p>
        <div className="overflow-x-auto rounded-md border border-erp-border">
          <table className="erp-table text-[12px]">
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Item</th>
                <th>UOM</th>
                <th className="num">Received</th>
                <th className="num">Original Qty</th>
                <th className="num">New Qty</th>
                <th className="num">Original Rate</th>
                <th className="num">New Rate</th>
                <th className="num">New Line Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const qtyChanged = l.quantity !== l.originalQuantity
                const rateChanged = l.rate !== l.originalRate
                return (
                  <tr key={l.id} className={cn((qtyChanged || rateChanged) && 'bg-amber-50/50')}>
                    <td className="font-mono">{l.itemCode}</td>
                    <td>{l.itemName}</td>
                    <td>{l.uom}</td>
                    <td className="num">{l.receivedQty}</td>
                    <td className="num tabular-nums text-erp-muted">{l.originalQuantity}</td>
                    <td className="num">
                      <input
                        type="number"
                        min={l.receivedQty}
                        step="any"
                        className={cn('erp-input h-8 w-24 text-right text-[12px]', qtyChanged && 'border-erp-warning-border')}
                        value={l.quantity}
                        onChange={(e) => patchLine(l.id, { quantity: Number(e.target.value) })}
                      />
                    </td>
                    <td className="num tabular-nums text-erp-muted">{formatCurrency(l.originalRate)}</td>
                    <td className="num">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className={cn('erp-input h-8 w-24 text-right text-[12px]', rateChanged && 'border-erp-warning-border')}
                        value={l.rate}
                        onChange={(e) => patchLine(l.id, { rate: Number(e.target.value) })}
                      />
                    </td>
                    <td className="num font-medium">{formatCurrency(l.quantity * l.rate)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </ErpCardSection>

      <ErpCardSection
        title="Commercial Terms"
        collapsedSummary={commercialPeek || undefined}
        collapsible
        defaultOpen={false}
      >
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <ErpFieldRow label="Expected Delivery Date">
            <Input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} />
            <ChangedHint changed={expectedDeliveryDate !== po.expectedDeliveryDate} original={po.expectedDeliveryDate} />
          </ErpFieldRow>
          <ErpFieldRow label="Payment Terms">
            <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
            <ChangedHint changed={paymentTerms !== po.paymentTerms} original={po.paymentTerms} />
          </ErpFieldRow>
          <ErpFieldRow label="Delivery Terms">
            <Input value={deliveryTerms} onChange={(e) => setDeliveryTerms(e.target.value)} />
            <ChangedHint changed={deliveryTerms !== po.deliveryTerms} original={po.deliveryTerms} />
          </ErpFieldRow>
          <ErpFieldRow label="Freight Terms">
            <Input value={freightTerms} onChange={(e) => setFreightTerms(e.target.value)} />
            <ChangedHint changed={freightTerms !== po.freightTerms} original={po.freightTerms} />
          </ErpFieldRow>
          <ErpFieldRow label="Packing Terms">
            <Input value={packingTerms} onChange={(e) => setPackingTerms(e.target.value)} />
            <ChangedHint changed={packingTerms !== po.packingTerms} original={po.packingTerms} />
          </ErpFieldRow>
          <ErpFieldRow label="Insurance Terms">
            <Input value={insuranceTerms} onChange={(e) => setInsuranceTerms(e.target.value)} />
            <ChangedHint changed={insuranceTerms !== po.insuranceTerms} original={po.insuranceTerms} />
          </ErpFieldRow>
          <ErpFieldRow label="Warranty">
            <Input value={warranty} onChange={(e) => setWarranty(e.target.value)} />
            <ChangedHint changed={warranty !== po.warranty} original={po.warranty} />
          </ErpFieldRow>
          <ErpFieldRow label="Inspection Requirement" className="sm:col-span-2">
            <Input value={inspectionRequirement} onChange={(e) => setInspectionRequirement(e.target.value)} />
            <ChangedHint changed={inspectionRequirement !== po.inspectionRequirement} original={po.inspectionRequirement} />
          </ErpFieldRow>
          <ErpFieldRow label="Freight Amount">
            <Input type="number" value={freight} onChange={(e) => setFreight(Number(e.target.value))} />
            <ChangedHint changed={freight !== po.freight} original={formatCurrency(po.freight)} />
          </ErpFieldRow>
          <ErpFieldRow label="Packing Charges">
            <Input type="number" value={packingCharges} onChange={(e) => setPackingCharges(Number(e.target.value))} />
            <ChangedHint changed={packingCharges !== po.packingCharges} original={formatCurrency(po.packingCharges)} />
          </ErpFieldRow>
          <ErpFieldRow label="Insurance Charges">
            <Input type="number" value={insuranceCharges} onChange={(e) => setInsuranceCharges(Number(e.target.value))} />
            <ChangedHint changed={insuranceCharges !== po.insuranceCharges} original={formatCurrency(po.insuranceCharges)} />
          </ErpFieldRow>
          <ErpFieldRow label="Other Charges">
            <Input type="number" value={otherCharges} onChange={(e) => setOtherCharges(Number(e.target.value))} />
            <ChangedHint changed={otherCharges !== po.otherCharges} original={formatCurrency(po.otherCharges)} />
          </ErpFieldRow>
          <ErpFieldRow label="Trade Discount">
            <Input type="number" value={tradeDiscount} onChange={(e) => setTradeDiscount(Number(e.target.value))} />
            <ChangedHint changed={tradeDiscount !== po.tradeDiscount} original={formatCurrency(po.tradeDiscount)} />
          </ErpFieldRow>
        </div>

        {commercialHints.length > 0 ? (
          <div className="mt-4 rounded-md border border-erp-border bg-erp-surface-alt p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-erp-text">
              <RotateCw className="h-3.5 w-3.5" /> Changes summary
            </p>
            <ul className="space-y-1 text-[12px] text-erp-muted">
              {commercialHints.map((h) => (
                <li key={h.label}>
                  <strong className="text-erp-text">{h.label}:</strong> {h.original} → {h.next}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </ErpCardSection>

      <ErpCardSection
        title="Terms & Notes"
        collapsedSummary={notesPeek || undefined}
        collapsible
        defaultOpen={false}
        dense
      >
        <PurchaseTermsNotesTabs
          values={{ termsAndConditions, internalNotes, remarks }}
          onChange={(patch) => {
            if (patch.termsAndConditions != null) setTermsAndConditions(patch.termsAndConditions)
            if (patch.internalNotes != null) setInternalNotes(patch.internalNotes)
            if (patch.remarks != null) setRemarks(patch.remarks)
          }}
        />
      </ErpCardSection>
    </PurchaseCardFormShell>
  )
}
