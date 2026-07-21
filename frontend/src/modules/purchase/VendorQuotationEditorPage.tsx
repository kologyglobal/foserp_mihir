import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Banknote,
  Building2,
  ChevronDown,
  ClipboardList,
  FileText,
  Package,
  Plus,
  Trash2,
  Truck,
} from 'lucide-react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import { PurchaseTaxTotalsPanel } from '@/components/purchase/PurchaseTaxTotalsPanel'
import { purchaseStatusTone } from '@/components/purchase/purchaseCardFormShared'
import {
  PurchaseDocumentFactBox,
  buildPurchaseRelatedLinks,
  purchaseDocumentApprovalFact,
} from '@/components/purchase/PurchaseDocumentFactBox'
import {
  ErpCardSection,
  ErpFieldRow,
  ErpFormSpan,
} from '@/components/erp/card-form'
import { ErpButton } from '@/components/erp/ErpButton'
import { FormActionBar } from '@/components/erp/FormActionBar'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { Badge } from '@/components/ui/Badge'
import { LoadingState } from '@/design-system/components/LoadingState'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import {
  createVendorQuotation,
  getRFQs,
  getVendorQuotationById,
  getVendors,
  previewNextVendorQuotationNumber,
  PurchaseServiceError,
  updateVendorQuotation,
} from '@/services/purchase'
import {
  QUOTATION_COMPLIANCE_STATUS_LABELS,
  VENDOR_QUOTATION_DOMAIN_STATUS_LABELS,
  type QuotationComplianceStatus,
  type RequestForQuotation,
  type Vendor,
  type VendorQuotation,
  type VendorQuotationLine,
} from '@/types/purchaseDomain'
import {
  commercialTermsSummary,
  formatFastTabDate,
  hasMeaningfulTaxTotals,
  joinFastTabSummary,
  notesSummary,
  taxTotalsSummary,
} from '@/modules/purchase/purchaseFastTabSummaries'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import { PURCHASE_FORM_ROUTES } from './purchaseFormRoutes'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function emptyLine(partial?: Partial<VendorQuotationLine>): VendorQuotationLine {
  return {
    id: crypto.randomUUID(),
    lineNo: 1,
    rfqLineId: null,
    itemId: '',
    itemCode: '',
    itemName: '',
    description: '',
    uom: 'NOS',
    hsnCode: '',
    quantity: 1,
    rate: 0,
    discountPct: 0,
    discountAmount: 0,
    gstRatePct: 18,
    taxAmount: 0,
    taxableAmount: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    freightAllocation: 0,
    otherCharges: 0,
    landedCost: 0,
    lineTotal: 0,
    leadTimeDays: 0,
    promisedDeliveryDate: null,
    technicalCompliance: 'not_assessed',
    commercialCompliance: 'not_assessed',
    makeBrand: '',
    remarks: '',
    ...partial,
  }
}

function computeLine(
  line: VendorQuotationLine,
  isInterstate: boolean,
): VendorQuotationLine {
  const qty = Number(line.quantity) || 0
  const rate = Number(line.rate) || 0
  const basic = Number((qty * rate).toFixed(2))
  const discountAmount =
    line.discountAmount > 0
      ? line.discountAmount
      : Number(((basic * (Number(line.discountPct) || 0)) / 100).toFixed(2))
  const taxableAmount = Math.max(0, Number((basic - discountAmount).toFixed(2)))
  const gstRatePct = Number(line.gstRatePct) || 0
  const taxAmount = Number(((taxableAmount * gstRatePct) / 100).toFixed(2))
  const half = Number((taxAmount / 2).toFixed(2))
  const freightAllocation = Number(line.freightAllocation) || 0
  const otherCharges = Number(line.otherCharges) || 0
  const lineTotal = Number((taxableAmount + taxAmount + freightAllocation + otherCharges).toFixed(2))
  const landedCost = lineTotal
  return {
    ...line,
    discountAmount,
    taxableAmount,
    taxAmount,
    cgst: isInterstate ? 0 : half,
    sgst: isInterstate ? 0 : half,
    igst: isInterstate ? taxAmount : 0,
    lineTotal,
    landedCost,
  }
}

function renumberLines(lines: VendorQuotationLine[], isInterstate: boolean) {
  return lines.map((l, i) => computeLine({ ...l, lineNo: i + 1 }, isInterstate))
}

function aggregateTotals(
  lines: VendorQuotationLine[],
  packingCharges: number,
  headerFreight: number,
  headerOther: number,
  headerDiscount: number,
  _isInterstate: boolean,
) {
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.rate, 0)
  const lineDiscount = lines.reduce((s, l) => s + l.discountAmount, 0)
  const discount = headerDiscount + lineDiscount
  const taxableAmount = lines.reduce((s, l) => s + l.taxableAmount, 0)
  const cgst = lines.reduce((s, l) => s + l.cgst, 0)
  const sgst = lines.reduce((s, l) => s + l.sgst, 0)
  const igst = lines.reduce((s, l) => s + l.igst, 0)
  const lineFreight = lines.reduce((s, l) => s + l.freightAllocation, 0)
  const lineOther = lines.reduce((s, l) => s + l.otherCharges, 0)
  const freight = headerFreight + lineFreight
  const otherCharges = headerOther + lineOther + packingCharges
  const rawTotal = taxableAmount + cgst + sgst + igst + freight + otherCharges
  const totalAmount = Math.round(rawTotal)
  const roundOff = Number((totalAmount - rawTotal).toFixed(2))
  return {
    subtotal: Number(subtotal.toFixed(2)),
    discount: Number(discount.toFixed(2)),
    taxableAmount: Number(taxableAmount.toFixed(2)),
    cgst: Number(cgst.toFixed(2)),
    sgst: Number(sgst.toFixed(2)),
    igst: Number(igst.toFixed(2)),
    freight: Number(freight.toFixed(2)),
    otherCharges: Number(otherCharges.toFixed(2)),
    roundOff,
    totalAmount,
  }
}

function complianceBadge(status: QuotationComplianceStatus) {
  const color =
    status === 'compliant'
      ? 'green'
      : status === 'partial'
        ? 'yellow'
        : status === 'non_compliant'
          ? 'red'
          : 'gray'
  return <Badge color={color}>{QUOTATION_COMPLIANCE_STATUS_LABELS[status]}</Badge>
}

type LineEditRowProps = {
  line: VendorQuotationLine
  rfqLineLabel: string | number
  canRemove: boolean
  onPatch: (patch: Partial<VendorQuotationLine>) => void
  onRemove: () => void
}

function LineEditRow({ line, rfqLineLabel, canRemove, onPatch, onRemove }: LineEditRowProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <tr className={cn(open && 'bg-erp-primary-soft/20')}>
        <td className="sticky left-0 z-[1] bg-inherit font-mono text-erp-muted">{line.lineNo}</td>
        <td className="text-erp-muted">{line.rfqLineId ? `#${rfqLineLabel}` : '—'}</td>
        <td>
          <input
            className="erp-input h-8 min-w-[5.5rem] font-mono text-[11px]"
            value={line.itemCode}
            aria-label={`Item code line ${line.lineNo}`}
            onChange={(e) =>
              onPatch({ itemCode: e.target.value, itemId: line.itemId || e.target.value })
            }
          />
        </td>
        <td>
          <input
            className="erp-input h-8 min-w-[8rem] text-[11px]"
            value={line.itemName}
            aria-label={`Description line ${line.lineNo}`}
            onChange={(e) => onPatch({ itemName: e.target.value })}
          />
        </td>
        <td>
          <input
            type="number"
            className="erp-input h-8 w-16 text-right text-[11px]"
            value={line.quantity}
            aria-label={`Qty line ${line.lineNo}`}
            onChange={(e) => onPatch({ quantity: Number(e.target.value) })}
          />
        </td>
        <td>
          <input
            className="erp-input h-8 w-12 text-[11px]"
            value={line.uom}
            aria-label={`UOM line ${line.lineNo}`}
            onChange={(e) => onPatch({ uom: e.target.value })}
          />
        </td>
        <td>
          <input
            type="number"
            className="erp-input h-8 w-20 text-right text-[11px]"
            value={line.rate}
            aria-label={`Rate line ${line.lineNo}`}
            onChange={(e) => onPatch({ rate: Number(e.target.value) })}
          />
        </td>
        <td>
          <input
            type="number"
            className="erp-input h-8 w-14 text-right text-[11px]"
            value={line.discountPct}
            aria-label={`Discount % line ${line.lineNo}`}
            onChange={(e) => onPatch({ discountPct: Number(e.target.value) })}
          />
        </td>
        <td>
          <input
            type="number"
            className="erp-input h-8 w-12 text-right text-[11px]"
            value={line.gstRatePct}
            aria-label={`GST % line ${line.lineNo}`}
            onChange={(e) => onPatch({ gstRatePct: Number(e.target.value) })}
          />
        </td>
        <td className="num tabular-nums font-medium text-erp-primary">
          {formatCurrency(line.lineTotal)}
        </td>
        <td>{complianceBadge(line.technicalCompliance)}</td>
        <td>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-erp-primary hover:underline"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              Details
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
            </button>
            <button
              type="button"
              className="text-erp-danger-fg disabled:opacity-40"
              disabled={!canRemove}
              aria-label={`Remove line ${line.lineNo}`}
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
      {open ? (
        <tr className="bg-erp-surface-alt/80">
          <td colSpan={12} className="px-3 py-2.5">
            <div className="grid gap-x-4 gap-y-2.5 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  HSN
                </span>
                <input
                  className="erp-input h-8 w-full font-mono text-[11px]"
                  value={line.hsnCode}
                  onChange={(e) => onPatch({ hsnCode: e.target.value })}
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Disc amt
                </span>
                <input
                  type="number"
                  className="erp-input h-8 w-full text-right text-[11px]"
                  value={line.discountAmount}
                  onChange={(e) => onPatch({ discountAmount: Number(e.target.value) })}
                />
              </label>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Tax amt
                </p>
                <p className="mt-1 tabular-nums">{formatCurrency(line.taxAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Taxable
                </p>
                <p className="mt-1 tabular-nums">{formatCurrency(line.taxableAmount)}</p>
              </div>
              <label className="space-y-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Freight alloc
                </span>
                <input
                  type="number"
                  className="erp-input h-8 w-full text-right text-[11px]"
                  value={line.freightAllocation}
                  onChange={(e) => onPatch({ freightAllocation: Number(e.target.value) })}
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Other
                </span>
                <input
                  type="number"
                  className="erp-input h-8 w-full text-right text-[11px]"
                  value={line.otherCharges}
                  onChange={(e) => onPatch({ otherCharges: Number(e.target.value) })}
                />
              </label>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Landed
                </p>
                <p className="mt-1 tabular-nums font-medium">{formatCurrency(line.landedCost)}</p>
              </div>
              <label className="space-y-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Lead (days)
                </span>
                <input
                  type="number"
                  className="erp-input h-8 w-full text-right text-[11px]"
                  value={line.leadTimeDays}
                  onChange={(e) => onPatch({ leadTimeDays: Number(e.target.value) })}
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Promised
                </span>
                <input
                  type="date"
                  className="erp-input h-8 w-full text-[11px]"
                  value={line.promisedDeliveryDate ?? ''}
                  onChange={(e) =>
                    onPatch({ promisedDeliveryDate: e.target.value || null })
                  }
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Tech compliance
                </span>
                <select
                  className="erp-input h-8 w-full text-[11px]"
                  value={line.technicalCompliance}
                  onChange={(e) =>
                    onPatch({
                      technicalCompliance: e.target.value as QuotationComplianceStatus,
                    })
                  }
                >
                  {Object.entries(QUOTATION_COMPLIANCE_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Commercial
                </span>
                <select
                  className="erp-input h-8 w-full text-[11px]"
                  value={line.commercialCompliance}
                  onChange={(e) =>
                    onPatch({
                      commercialCompliance: e.target.value as QuotationComplianceStatus,
                    })
                  }
                >
                  {Object.entries(QUOTATION_COMPLIANCE_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Make / brand
                </span>
                <input
                  className="erp-input h-8 w-full text-[11px]"
                  value={line.makeBrand}
                  onChange={(e) => onPatch({ makeBrand: e.target.value })}
                />
              </label>
              <label className="space-y-0.5 sm:col-span-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Line remarks
                </span>
                <input
                  className="erp-input h-8 w-full text-[11px]"
                  value={line.remarks}
                  onChange={(e) => onPatch({ remarks: e.target.value })}
                />
              </label>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

export function VendorQuotationEditorPage() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [recordId, setRecordId] = useState<string | null>(id ?? null)
  const [documentNumber, setDocumentNumber] = useState<string | null>(null)
  const [status, setStatus] = useState<'draft' | string>('draft')

  const [rfqs, setRfqs] = useState<RequestForQuotation[]>([])
  const [allVendors, setAllVendors] = useState<Vendor[]>([])
  const [rfqId, setRfqId] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [vendorReferenceNumber, setVendorReferenceNumber] = useState('')
  const [documentDate, setDocumentDate] = useState(today())
  const [validTill, setValidTill] = useState(today())
  const [currency] = useState('INR')
  const [paymentTerms, setPaymentTerms] = useState('Net 30')
  const [deliveryTerms, setDeliveryTerms] = useState('FOR Chakan')
  const [freightTerms, setFreightTerms] = useState('Vendor')
  const [warranty, setWarranty] = useState('')
  const [remarks, setRemarks] = useState('')
  const [packingCharges, setPackingCharges] = useState(0)
  const [headerFreight, setHeaderFreight] = useState(0)
  const [headerOther, setHeaderOther] = useState(0)
  const [headerDiscount, setHeaderDiscount] = useState(0)
  const [lines, setLines] = useState<VendorQuotationLine[]>([emptyLine()])

  const { dirty, markDirty, resetDirty } = useUnsavedChangesGuard(true)

  const selectedRfq = useMemo(() => rfqs.find((r) => r.id === rfqId), [rfqs, rfqId])
  const selectedVendor = useMemo(
    () => allVendors.find((v) => v.id === vendorId),
    [allVendors, vendorId],
  )
  const isInterstate = selectedVendor?.isInterstate ?? false

  const vendorOptions = useMemo(() => {
    if (!selectedRfq) return allVendors.filter((v) => v.isActive)
    const invited = new Set(
      selectedRfq.vendors.filter((v) => v.selected).map((v) => v.vendorId),
    )
    const fromRfq = allVendors.filter((v) => invited.has(v.id))
    return fromRfq.length ? fromRfq : allVendors.filter((v) => v.isActive)
  }, [selectedRfq, allVendors])

  const computedLines = useMemo(
    () => renumberLines(lines, isInterstate),
    [lines, isInterstate],
  )

  const totals = useMemo(
    () =>
      aggregateTotals(
        computedLines,
        packingCharges,
        headerFreight,
        headerOther,
        headerDiscount,
        isInterstate,
      ),
    [computedLines, packingCharges, headerFreight, headerOther, headerDiscount, isInterstate],
  )

  const filledLineCount = useMemo(
    () => computedLines.filter((l) => l.itemId || l.itemCode.trim()).length,
    [computedLines],
  )

  const setLinesDirty = (next: VendorQuotationLine[]) => {
    setLines(next)
    markDirty()
  }

  const patchLine = (lineId: string, patch: Partial<VendorQuotationLine>) => {
    setLinesDirty(lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)))
  }

  const applyRfqLines = useCallback((rfq: RequestForQuotation) => {
    const next = rfq.lines.map((l) =>
      emptyLine({
        rfqLineId: l.id,
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        description: l.specification || l.itemName,
        uom: l.uom,
        hsnCode: l.hsnCode,
        quantity: l.quantity,
        rate: l.targetPrice,
      }),
    )
    setLinesDirty(next.length ? next : [emptyLine()])
    setPaymentTerms(rfq.paymentTerms)
    setDeliveryTerms(rfq.deliveryTerms)
    setFreightTerms(rfq.freightTerms)
  }, [])

  useEffect(() => {
    void Promise.all([getRFQs(), getVendors()]).then(([rfqRows, vendors]) => {
      setRfqs(rfqRows.filter((r) => r.status !== 'cancelled' && r.status !== 'draft'))
      setAllVendors(vendors.filter((v) => v.isActive))
    })
  }, [])

  useEffect(() => {
    if (!isNew) return
    let cancelled = false
    void previewNextVendorQuotationNumber()
      .then((next) => {
        if (!cancelled && next) setDocumentNumber(next)
      })
      .catch(() => {
        /* preview is optional — save still allocates server-side */
      })
    return () => {
      cancelled = true
    }
  }, [isNew])

  useEffect(() => {
    if (!rfqId || !selectedRfq) return
    if (isNew && lines.length === 1 && !lines[0]?.itemId) {
      applyRfqLines(selectedRfq)
    }
  }, [rfqId, selectedRfq, isNew, applyRfqLines, lines])

  useEffect(() => {
    if (isNew || !id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const vq: VendorQuotation | null = await getVendorQuotationById(id)
      if (cancelled) return
      if (!vq) {
        notify.error('Vendor quotation not found')
        navigate('/purchase/vendor-quotations')
        return
      }
      if (vq.status !== 'draft') {
        notify.info('Quotation is not editable — opening detail')
        navigate(`/purchase/vendor-quotations/${vq.id}`, { replace: true })
        return
      }
      setRecordId(vq.id)
      setDocumentNumber(vq.documentNumber)
      setStatus(vq.status)
      setRfqId(vq.rfqId)
      setVendorId(vq.vendor.id)
      setVendorReferenceNumber(vq.vendorReferenceNumber)
      setDocumentDate(vq.documentDate)
      setValidTill(vq.validTill)
      setPaymentTerms(vq.paymentTerms)
      setDeliveryTerms(vq.deliveryTerms)
      setFreightTerms(vq.freightTerms)
      setWarranty(vq.warranty)
      setRemarks(vq.remarks)
      setPackingCharges(vq.packingCharges ?? 0)
      setHeaderFreight(vq.freight ?? 0)
      setHeaderOther(vq.otherCharges ?? 0)
      setHeaderDiscount(vq.discount ?? 0)
      setLines(
        vq.lines.length
          ? vq.lines.map((l) => ({ ...l, id: l.id || crypto.randomUUID() }))
          : [emptyLine()],
      )
      resetDirty()
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, isNew, navigate, resetDirty])

  const toInput = () => ({
    rfqId,
    vendorId,
    documentDate,
    validTill,
    vendorReferenceNumber,
    paymentTerms,
    deliveryTerms,
    freightTerms,
    warranty,
    remarks,
    currency: 'INR' as const,
    packingCharges,
    freight: headerFreight,
    otherCharges: headerOther,
    discount: headerDiscount,
    lines: computedLines
      .filter((l) => l.itemId || l.itemCode.trim())
      .map(({ id: _id, ...l }) => ({ ...l })),
  })

  const saveDraft = async (): Promise<string | null> => {
    if (saving) return null
    if (!rfqId) {
      notify.error('Select an RFQ')
      return null
    }
    if (!vendorId) {
      notify.error('Select a vendor')
      return null
    }
    if (!toInput().lines.length) {
      notify.error('Add at least one line')
      return null
    }
    setSaving(true)
    try {
      const input = toInput()
      if (recordId) {
        const updated = await updateVendorQuotation(recordId, input)
        setDocumentNumber(updated.documentNumber)
        setStatus(updated.status)
        notify.success(`Saved · ${updated.documentNumber}`)
        resetDirty()
        navigate(PURCHASE_FORM_ROUTES.vendorQuotation.list, { replace: true })
        return updated.id
      }
      const created = await createVendorQuotation(input)
      setRecordId(created.id)
      setDocumentNumber(created.documentNumber)
      setStatus(created.status)
      notify.success(`Saved · ${created.documentNumber}`)
      resetDirty()
      navigate(PURCHASE_FORM_ROUTES.vendorQuotation.list, { replace: true })
      return created.id
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Save failed')
      return null
    } finally {
      setSaving(false)
    }
  }

  const statusLabel =
    VENDOR_QUOTATION_DOMAIN_STATUS_LABELS[status as keyof typeof VENDOR_QUOTATION_DOMAIN_STATUS_LABELS] ??
    status

  const documentTitle = isNew ? 'New Vendor Quotation' : (documentNumber ?? 'Vendor Quotation')
  const vendorFact = selectedVendor?.vendorName || 'Not selected'

  const recordHeaderFacts = useMemo(
    () => [
      ...(isNew
        ? [{ label: 'VQ No', value: documentNumber ?? 'Loading…' }]
        : []),
      { label: 'Vendor', value: vendorFact },
      {
        label: 'RFQ',
        value: selectedRfq?.documentNumber || 'Not selected',
      },
      {
        label: 'Date',
        value: formatFastTabDate(documentDate) ?? formatDate(documentDate),
      },
      {
        label: 'Valid until',
        value: formatFastTabDate(validTill) ?? formatDate(validTill),
      },
    ],
    [isNew, documentNumber, vendorFact, selectedRfq?.documentNumber, documentDate, validTill],
  )

  const quotationPeek = joinFastTabSummary([
    selectedRfq?.documentNumber ? `RFQ ${selectedRfq.documentNumber}` : false,
    formatFastTabDate(documentDate) ? `Date ${formatFastTabDate(documentDate)}` : false,
    formatFastTabDate(validTill) ? `Valid ${formatFastTabDate(validTill)}` : false,
  ])

  const vendorPeek = joinFastTabSummary([
    selectedVendor
      ? `${selectedVendor.vendorCode} · ${selectedVendor.vendorName}`
      : false,
    vendorReferenceNumber.trim() ? `Ref ${vendorReferenceNumber.trim()}` : false,
    isInterstate ? 'IGST' : selectedVendor ? 'CGST+SGST' : false,
  ])

  const commercialPeek = commercialTermsSummary({
    paymentTerms,
    freightTerms,
    deliveryTerms,
    validityDate: validTill,
  })

  const taxPeek = taxTotalsSummary({
    subtotal: totals.taxableAmount,
    tax: totals.cgst + totals.sgst + totals.igst,
    total: totals.totalAmount,
  })

  const notesPeek = notesSummary(remarks, warranty)
  const taxTotalsDefaultOpen = hasMeaningfulTaxTotals(
    totals.taxableAmount,
    totals.cgst + totals.sgst + totals.igst,
    totals.totalAmount,
  )

  const documentFactBox = useMemo(() => {
    const approval = purchaseDocumentApprovalFact(status)
    const firstLine = computedLines.find((l) => l.itemId || l.itemCode.trim())
    return (
      <PurchaseDocumentFactBox
        vendor={
          selectedVendor
            ? {
                id: selectedVendor.id,
                code: selectedVendor.vendorCode,
                name: selectedVendor.vendorName,
                rating: selectedVendor.rating,
                paymentTerms: paymentTerms || selectedVendor.paymentTerms,
                leadTimeDays: selectedVendor.leadTimeDays,
              }
            : null
        }
        purchaseHistory={{
          lastPurchasePrice: firstLine && Number(firstLine.rate) > 0 ? Number(firstLine.rate) : null,
          lastVendorName: selectedVendor?.vendorName ?? null,
          averageLeadTimeDays:
            firstLine && firstLine.leadTimeDays > 0
              ? firstLine.leadTimeDays
              : selectedVendor?.leadTimeDays ?? null,
        }}
        documentStatus={{
          statusLabel,
          ...approval,
          createdBy: null,
          modifiedBy: null,
          modifiedDate: null,
        }}
        related={buildPurchaseRelatedLinks({
          rfqId: rfqId || null,
          rfqNumber: selectedRfq?.documentNumber || null,
        })}
      />
    )
  }, [
    status,
    statusLabel,
    computedLines,
    selectedVendor,
    paymentTerms,
    rfqId,
    selectedRfq,
  ])

  if (loading) {
    return (
      <PurchaseCardFormShell
        title="Vendor Quotation"
        description="Loading…"
        status="Draft"
        favoritePath="/purchase/vendor-quotations/new"
        breadcrumbs={[
          { label: 'Vendor Quotations', to: '/purchase/vendor-quotations' },
          { label: 'Loading' },
        ]}
        footer={null}
      >
        <LoadingState variant="form" rows={8} />
      </PurchaseCardFormShell>
    )
  }

  return (
    <PurchaseCardFormShell
      title={isNew ? 'New Vendor Quotation' : `Edit ${documentNumber ?? 'VQ'}`}
      description="Enter vendor quote against an RFQ"
      recordNo={documentNumber ?? (isNew ? 'New' : undefined)}
      recordTitle={documentTitle}
      status={statusLabel}
      statusTone={purchaseStatusTone(status)}
      statusKey={status}
      company={selectedVendor?.vendorName}
      recordHeaderFacts={recordHeaderFacts}
      favoritePath={
        recordId ? `/purchase/vendor-quotations/${recordId}/edit` : '/purchase/vendor-quotations/new'
      }
      breadcrumbs={[
        { label: 'Vendor Quotations', to: '/purchase/vendor-quotations' },
        { label: isNew ? 'New' : documentNumber ?? 'Edit' },
      ]}
      factBox={documentFactBox}
      collapsibleFactBox
      commandBar={null}
      stickyFooter
      footer={
        <FormActionBar
          sticky
          cancelFirst
          busy={saving}
          dirty={dirty}
          disabled={status !== 'draft'}
          disabledReason={status !== 'draft' ? 'Document is read-only' : undefined}
          onCancel={() => {
            resetDirty()
            navigate(PURCHASE_FORM_ROUTES.vendorQuotation.list)
          }}
          onSave={saveDraft}
        />
      }
      onSaveShortcut={() => void saveDraft()}
    >
      <ErpCardSection
        title="Quotation"
        subtitle="RFQ link, dates, and document identity"
        icon={ClipboardList}
        accent="blue"
        collapsible
        defaultOpen
        dense
        collapsedSummary={quotationPeek || undefined}
      >
        <ErpFormSpan span={3}>
          <p className="erp-field-group__label">Document</p>
        </ErpFormSpan>
        <ErpFieldRow
          label="VQ Number"
          readOnly
          hint={isNew ? 'Preview from number series — assigned when you save' : undefined}
        >
          <Input
            value={documentNumber ?? ''}
            placeholder="Loading number…"
            readOnly
            className="bg-erp-surface-alt"
          />
        </ErpFieldRow>
        <ErpFieldRow label="Quotation Date" required>
          <Input
            type="date"
            value={documentDate}
            onChange={(e) => {
              setDocumentDate(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Valid Until" required>
          <Input
            type="date"
            value={validTill}
            onChange={(e) => {
              setValidTill(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Currency" readOnly>
          <Input value={currency} readOnly className="bg-erp-surface-alt" />
        </ErpFieldRow>
        <ErpFieldRow label="Status" readOnly>
          <Input value={statusLabel} readOnly className="bg-erp-surface-alt" />
        </ErpFieldRow>
        <ErpFieldRow label="RFQ Number" required>
          <Select
            value={rfqId}
            onChange={(e) => {
              setRfqId(e.target.value)
              setVendorId('')
              markDirty()
            }}
          >
            <option value="">Select RFQ…</option>
            {rfqs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.documentNumber}
              </option>
            ))}
          </Select>
        </ErpFieldRow>
        {selectedRfq ? (
          <ErpFieldRow label="RFQ link">
            <Link to={`/purchase/rfqs/${selectedRfq.id}`} className="text-[13px] text-erp-primary">
              View {selectedRfq.documentNumber}
            </Link>
          </ErpFieldRow>
        ) : null}
      </ErpCardSection>

      <ErpCardSection
        title="Vendor"
        subtitle="Vendor party and reference"
        icon={Building2}
        accent="slate"
        collapsible
        defaultOpen
        dense
        collapsedSummary={vendorPeek || undefined}
      >
        <ErpFieldRow label="Vendor" required>
          <Select
            value={vendorId}
            onChange={(e) => {
              setVendorId(e.target.value)
              markDirty()
            }}
          >
            <option value="">Select vendor…</option>
            {vendorOptions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vendorCode} — {v.vendorName}
              </option>
            ))}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow label="Vendor Reference">
          <Input
            value={vendorReferenceNumber}
            onChange={(e) => {
              setVendorReferenceNumber(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="GST scheme" readOnly>
          <Input
            value={
              !selectedVendor
                ? '—'
                : isInterstate
                  ? 'IGST (interstate)'
                  : 'CGST + SGST'
            }
            readOnly
            className="bg-erp-surface-alt"
          />
        </ErpFieldRow>
        {selectedVendor?.gstin ? (
          <ErpFieldRow label="Vendor GSTIN" readOnly>
            <Input
              value={selectedVendor.gstin}
              readOnly
              className="bg-erp-surface-alt font-mono"
            />
          </ErpFieldRow>
        ) : null}
      </ErpCardSection>

      <ErpCardSection
        title="Commercial Terms"
        subtitle="Payment, delivery, freight, and warranty"
        icon={Truck}
        accent="amber"
        collapsible
        defaultOpen={false}
        dense
        collapsedSummary={commercialPeek || undefined}
      >
        <ErpFieldRow label="Payment Terms">
          <Input
            value={paymentTerms}
            onChange={(e) => {
              setPaymentTerms(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Delivery Terms">
          <Input
            value={deliveryTerms}
            onChange={(e) => {
              setDeliveryTerms(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Freight Terms">
          <Select
            value={freightTerms}
            onChange={(e) => {
              setFreightTerms(e.target.value)
              markDirty()
            }}
          >
            <option value="Vendor">Vendor</option>
            <option value="Buyer">Buyer</option>
            <option value="Included">Included</option>
            <option value="Shared">Shared</option>
          </Select>
        </ErpFieldRow>
        <ErpFieldRow label="Warranty">
          <Input
            value={warranty}
            onChange={(e) => {
              setWarranty(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
      </ErpCardSection>

      <ErpCardSection
        title="Item Lines"
        subtitle="Quoted items — expand a row for compliance and allocations"
        icon={Package}
        accent="teal"
        collapsible
        defaultOpen
        dense
        columns={1}
        className="ring-1 ring-teal-200/60"
        badge={
          <span className="text-[11px] tabular-nums text-erp-muted">
            {filledLineCount || computedLines.length} line
            {(filledLineCount || computedLines.length) === 1 ? '' : 's'}
            {dirty ? ' · Unsaved' : ''}
          </span>
        }
      >
        <div className="mb-2 flex flex-wrap gap-2">
          <ErpButton
            type="button"
            size="sm"
            variant="secondary"
            icon={Plus}
            onClick={() => setLinesDirty([...lines, emptyLine()])}
          >
            Add line
          </ErpButton>
          {selectedRfq ? (
            <ErpButton
              type="button"
              size="sm"
              variant="outline"
              onClick={() => applyRfqLines(selectedRfq)}
            >
              Prefill from RFQ
            </ErpButton>
          ) : null}
        </div>
        <div className="overflow-x-auto rounded-md border border-erp-border">
          <table className="erp-table text-[12px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-[1] bg-erp-surface-alt">#</th>
                <th>RFQ</th>
                <th>Item</th>
                <th>Description</th>
                <th className="num">Qty</th>
                <th>UOM</th>
                <th className="num">Rate</th>
                <th className="num">Disc %</th>
                <th className="num">GST %</th>
                <th className="num">Amount</th>
                <th>Tech</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {computedLines.map((line) => {
                const rfqLineLabel =
                  selectedRfq?.lines.find((l) => l.id === line.rfqLineId)?.lineNo ??
                  line.lineNo
                return (
                  <LineEditRow
                    key={line.id}
                    line={line}
                    rfqLineLabel={rfqLineLabel}
                    canRemove={lines.length > 1}
                    onPatch={(patch) => patchLine(line.id, patch)}
                    onRemove={() => setLinesDirty(lines.filter((l) => l.id !== line.id))}
                  />
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-erp-surface-alt font-medium">
                <td colSpan={4} className="sticky left-0 z-[1] bg-erp-surface-alt text-erp-muted">
                  Totals
                </td>
                <td className="num tabular-nums">
                  {computedLines.reduce((s, l) => s + (Number(l.quantity) || 0), 0)}
                </td>
                <td colSpan={4} />
                <td className="num tabular-nums text-erp-primary">
                  {formatCurrency(totals.totalAmount)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </ErpCardSection>

      <ErpCardSection
        title="Tax & Totals"
        subtitle="Charges, GST breakdown, and quotation total"
        icon={Banknote}
        accent="amber"
        collapsible
        defaultOpen={taxTotalsDefaultOpen || isNew}
        dense
        columns={1}
        collapsedSummary={taxPeek || undefined}
      >
        <PurchaseTaxTotalsPanel
          charges={[
            {
              id: 'basic',
              label: 'Basic Amount',
              kind: 'value',
              value: formatCurrency(totals.subtotal),
            },
            {
              id: 'discount',
              label: 'Trade Discount',
              kind: 'input',
              value: headerDiscount,
              onChange: (v) => {
                setHeaderDiscount(v)
                markDirty()
              },
            },
            {
              id: 'freight',
              label: 'Freight',
              kind: 'input',
              value: headerFreight,
              onChange: (v) => {
                setHeaderFreight(v)
                markDirty()
              },
            },
            {
              id: 'packing',
              label: 'Packing Charges',
              kind: 'input',
              value: packingCharges,
              onChange: (v) => {
                setPackingCharges(v)
                markDirty()
              },
            },
            {
              id: 'other',
              label: 'Other Charges',
              kind: 'input',
              value: headerOther,
              onChange: (v) => {
                setHeaderOther(v)
                markDirty()
              },
            },
          ]}
          calcRows={[
            {
              id: 'taxable',
              label: 'Taxable Amount',
              value: formatCurrency(totals.taxableAmount),
            },
            {
              id: 'cgst',
              label: 'CGST',
              value: formatCurrency(totals.cgst),
              hidden: isInterstate,
            },
            {
              id: 'sgst',
              label: 'SGST',
              value: formatCurrency(totals.sgst),
              hidden: isInterstate,
            },
            {
              id: 'igst',
              label: 'IGST',
              value: formatCurrency(totals.igst),
              hidden: !isInterstate,
            },
            {
              id: 'roundOff',
              label: 'Round Off',
              value: formatCurrency(totals.roundOff),
            },
          ]}
          grandTotalLabel="Quotation Total"
          grandTotalValue={formatCurrency(totals.totalAmount)}
        />
      </ErpCardSection>

      <ErpCardSection
        title="Remarks"
        subtitle="Header notes for comparison and PO handover"
        icon={FileText}
        accent="slate"
        collapsible
        defaultOpen={false}
        dense
        columns={1}
        collapsedSummary={notesPeek || undefined}
      >
        <ErpFieldRow label="Remarks" colSpan={3} horizontal={false}>
          <Textarea
            rows={3}
            value={remarks}
            onChange={(e) => {
              setRemarks(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
      </ErpCardSection>
    </PurchaseCardFormShell>
  )
}
