import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ClipboardList,
  FileText,
  Package,
  Plus,
  Save,
  Send,
  Star,
  Trash2,
  Truck,
  Users,
} from 'lucide-react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import { purchaseStatusTone } from '@/components/purchase/purchaseCardFormShared'
import { PurchaseTermSelect } from '@/components/purchase/PurchaseTermSelect'
import {
  PurchaseDocumentFactBox,
  buildPurchaseRelatedLinks,
  purchaseDocumentApprovalFact,
} from '@/components/purchase/PurchaseDocumentFactBox'
import {
  ErpCardSection,
  ErpFieldRow,
  ErpFormSpan,
  ErpStickySaveBar,
} from '@/components/erp/card-form'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Checkbox, Input, Select, Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseFormMetrics } from '@/design-system/workspace'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import {
  createRFQ,
  getPurchaseItems,
  getPurchaseRequisitions,
  getRecommendedVendorsForItems,
  getRFQById,
  getVendors,
  PurchaseServiceError,
  updateRFQ,
} from '@/services/purchase'
import type {
  PurchaseItem,
  PurchaseRequisition,
  RfqLine,
  Vendor,
} from '@/types/purchaseDomain'
import { PURCHASE_DEMO_LOCATION, PURCHASE_DEMO_LOCATION_FG } from '@/data/purchase/purchaseDomainSeed'
import {
  PURCHASE_DELIVERY_TERMS,
  PURCHASE_FREIGHT_TERMS,
  PURCHASE_PAYMENT_TERMS,
} from '@/data/purchase/purchaseCommercialTerms'
import {
  commercialTermsSummary,
  formatFastTabDate,
  joinFastTabSummary,
  notesSummary,
} from '@/modules/purchase/purchaseFastTabSummaries'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

const ACTOR = { id: 'user-buyer-01', code: 'BUY01', name: 'Rahul Patil' }

function today() {
  return new Date().toISOString().slice(0, 10)
}

function emptyLine(partial?: Partial<RfqLine>): RfqLine {
  return {
    id: crypto.randomUUID(),
    lineNo: 1,
    purchaseRequisitionId: null,
    purchaseRequisitionNumber: null,
    prLineId: null,
    itemId: '',
    itemCode: '',
    itemName: '',
    specification: '',
    hsnCode: '',
    sacCode: null,
    quantity: 1,
    uom: 'NOS',
    requiredDate: today(),
    targetPrice: 0,
    amount: 0,
    remarks: '',
    ...partial,
  }
}

type VendorPick = {
  vendorId: string
  selected: boolean
  vendor: Vendor
  lastPurchasePrice: number | null
}

type SourceMode = 'manual' | 'single_pr' | 'multi_pr'

const SOURCE_MODE_LABELS: Record<SourceMode, string> = {
  manual: 'Manual',
  single_pr: 'From approved PR',
  multi_pr: 'Combine multiple PRs',
}

export function RfqEditorPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isNew = !id
  const navigate = useNavigate()

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [recordId, setRecordId] = useState<string | null>(id ?? null)
  const [documentNumber, setDocumentNumber] = useState<string | null>(null)
  const [sourceMode, setSourceMode] = useState<SourceMode>(
    searchParams.get('prId') ? 'single_pr' : 'manual',
  )
  const [selectedPrIds, setSelectedPrIds] = useState<string[]>(
    searchParams.get('prId') ? [searchParams.get('prId')!] : [],
  )

  const [documentDate, setDocumentDate] = useState(today())
  const [bidDueDate, setBidDueDate] = useState(today())
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(today())
  const [purchaseLocationId, setPurchaseLocationId] = useState<string>(PURCHASE_DEMO_LOCATION.id)
  const [deliveryLocationId, setDeliveryLocationId] = useState<string>(PURCHASE_DEMO_LOCATION.id)
  const [currency] = useState('INR')
  const [paymentTerms, setPaymentTerms] = useState('Net 30')
  const [deliveryTerms, setDeliveryTerms] = useState('FOR Chakan')
  const [freightTerms, setFreightTerms] = useState('Vendor')
  const [inspectionRequirement, setInspectionRequirement] = useState('')
  const [technicalContact, setTechnicalContact] = useState('Amit Deshmukh · Stores')
  const [commercialContact, setCommercialContact] = useState(ACTOR.name)
  const [remarks, setRemarks] = useState('')
  const [lines, setLines] = useState<RfqLine[]>([emptyLine()])
  const [vendorPicks, setVendorPicks] = useState<VendorPick[]>([])

  const [approvedPrs, setApprovedPrs] = useState<PurchaseRequisition[]>([])
  const [catalogItems, setCatalogItems] = useState<PurchaseItem[]>([])
  const [allVendors, setAllVendors] = useState<Vendor[]>([])

  const { markDirty, resetDirty } = useUnsavedChangesGuard(true)

  const locations = [PURCHASE_DEMO_LOCATION, PURCHASE_DEMO_LOCATION_FG]

  const estimatedValue = useMemo(
    () => lines.reduce((s, l) => s + Number(l.amount || 0), 0),
    [lines],
  )

  const renumber = (next: RfqLine[]) =>
    next.map((l, i) => ({
      ...l,
      lineNo: i + 1,
      amount: Number(((Number(l.quantity) || 0) * (Number(l.targetPrice) || 0)).toFixed(2)),
    }))

  const setLinesDirty = (next: RfqLine[]) => {
    setLines(renumber(next))
    markDirty()
  }

  const patchLine = (lineId: string, patch: Partial<RfqLine>) => {
    setLinesDirty(lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)))
  }

  const applyPrs = useCallback(
    (prs: PurchaseRequisition[]) => {
      const nextLines: RfqLine[] = []
      for (const pr of prs) {
        for (const l of pr.lines) {
          nextLines.push(
            emptyLine({
              purchaseRequisitionId: pr.id,
              purchaseRequisitionNumber: pr.documentNumber,
              prLineId: l.id,
              itemId: l.itemId,
              itemCode: l.itemCode,
              itemName: l.itemName,
              specification: l.specification || '',
              hsnCode: l.hsnCode,
              sacCode: l.sacCode,
              quantity: l.quantity,
              uom: l.uom,
              requiredDate: l.requiredDate,
              targetPrice: l.estimatedRate,
              remarks: l.remarks,
            }),
          )
        }
      }
      setLinesDirty(nextLines.length ? nextLines : [emptyLine()])
      if (prs[0]) {
        setPaymentTerms(prs[0].paymentTerms)
        setDeliveryTerms(prs[0].deliveryTerms)
        setExpectedDeliveryDate(prs[0].expectedDeliveryDate ?? today())
        setPurchaseLocationId(prs[0].location.id)
        setDeliveryLocationId(prs[0].location.id)
        setRemarks(prs.map((p) => p.documentNumber).join(', '))
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    void Promise.all([getPurchaseRequisitions(), getPurchaseItems(), getVendors()]).then(
      ([prs, items, vendors]) => {
        setApprovedPrs(prs.filter((p) => p.status === 'approved' || p.status === 'converted_to_rfq'))
        setCatalogItems(items)
        setAllVendors(vendors.filter((v) => v.isActive))
      },
    )
  }, [])

  useEffect(() => {
    if (isNew && selectedPrIds.length && approvedPrs.length) {
      const prs = approvedPrs.filter((p) => selectedPrIds.includes(p.id))
      if (prs.length) applyPrs(prs)
    }
  }, [isNew, selectedPrIds, approvedPrs, applyPrs])

  useEffect(() => {
    if (isNew || !id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const rfq = await getRFQById(id)
      if (cancelled) return
      if (!rfq) {
        notify.error('RFQ not found')
        navigate('/purchase/rfqs')
        return
      }
      if (rfq.status !== 'draft') {
        notify.info('RFQ is not editable — opening detail')
        navigate(`/purchase/rfqs/${rfq.id}`, { replace: true })
        return
      }
      setRecordId(rfq.id)
      setDocumentNumber(rfq.documentNumber)
      setDocumentDate(rfq.documentDate)
      setBidDueDate(rfq.bidDueDate)
      setExpectedDeliveryDate(rfq.expectedDeliveryDate ?? today())
      setPurchaseLocationId(rfq.purchaseLocation.id)
      setDeliveryLocationId(rfq.deliveryLocation.id)
      setPaymentTerms(rfq.paymentTerms)
      setDeliveryTerms(rfq.deliveryTerms)
      setFreightTerms(rfq.freightTerms)
      setInspectionRequirement(rfq.inspectionRequirement)
      setTechnicalContact(rfq.technicalContact)
      setCommercialContact(rfq.commercialContact)
      setRemarks(rfq.remarks)
      setSelectedPrIds(rfq.purchaseRequisitionIds)
      setSourceMode(
        rfq.purchaseRequisitionIds.length > 1
          ? 'multi_pr'
          : rfq.purchaseRequisitionIds.length === 1
            ? 'single_pr'
            : 'manual',
      )
      setLines(
        rfq.lines.length
          ? rfq.lines.map((l) => ({ ...l, id: l.id || crypto.randomUUID() }))
          : [emptyLine()],
      )
      const vendorMap = new Map((await getVendors()).map((v) => [v.id, v]))
      setVendorPicks(
        rfq.vendors.map((v) => ({
          vendorId: v.vendorId,
          selected: v.selected,
          lastPurchasePrice: v.lastPurchasePrice,
          vendor: vendorMap.get(v.vendorId)!,
        })).filter((v) => v.vendor),
      )
      resetDirty()
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, isNew, navigate, resetDirty])

  const ensureVendorPick = (vendor: Vendor, selected = true) => {
    setVendorPicks((prev) => {
      if (prev.some((p) => p.vendorId === vendor.id)) {
        return prev.map((p) => (p.vendorId === vendor.id ? { ...p, selected } : p))
      }
      const itemId = lines.find((l) => l.itemId)?.itemId
      const last =
        itemId != null
          ? null
          : null
      return [
        ...prev,
        {
          vendorId: vendor.id,
          selected,
          vendor,
          lastPurchasePrice: last ?? vendor ? null : null,
        },
      ]
    })
    markDirty()
  }

  const addRecommendedVendors = async () => {
    const itemIds = lines.map((l) => l.itemId).filter(Boolean)
    const recommended = await getRecommendedVendorsForItems(itemIds)
    for (const v of recommended) ensureVendorPick(v, true)
    notify.success(`Added ${recommended.length} recommended vendor(s)`)
  }

  const copyFromPr = () => {
    const prs = approvedPrs.filter((p) => selectedPrIds.includes(p.id))
    if (!prs.length) {
      notify.error('Select one or more approved PRs first')
      return
    }
    applyPrs(prs)
    notify.success('Lines copied from PR(s)')
  }

  const toInput = () => {
    const purchaseLocation =
      locations.find((l) => l.id === purchaseLocationId) ?? PURCHASE_DEMO_LOCATION
    const deliveryLocation =
      locations.find((l) => l.id === deliveryLocationId) ?? PURCHASE_DEMO_LOCATION
    const vendorIds = vendorPicks.filter((v) => v.selected).map((v) => v.vendorId)
    return {
      documentDate,
      bidDueDate,
      expectedDeliveryDate,
      paymentTerms,
      deliveryTerms,
      freightTerms,
      inspectionRequirement,
      technicalContact,
      commercialContact,
      remarks,
      purchaseRequisitionIds: selectedPrIds,
      purchaseRequisitionId: selectedPrIds[0] ?? null,
      location: { ...purchaseLocation },
      purchaseLocation: { ...purchaseLocation },
      deliveryLocation: { ...deliveryLocation },
      buyer: ACTOR,
      requester: ACTOR,
      currency: 'INR' as const,
      vendorIds,
      lines: lines
        .filter((l) => l.itemName.trim() || l.itemCode.trim() || l.itemId)
        .map((l) => ({ ...l })),
    }
  }

  const saveDraft = async (): Promise<string | null> => {
    setSaving(true)
    try {
      const input = toInput()
      if (!input.vendorIds.length) {
        notify.error('Select at least one vendor')
        return null
      }
      if (!input.lines?.length) {
        notify.error('Add at least one item line')
        return null
      }
      if (recordId) {
        const updated = await updateRFQ(recordId, input)
        setDocumentNumber(updated.documentNumber)
        notify.success(`Draft saved · ${updated.documentNumber}`)
        resetDirty()
        return updated.id
      }
      const created = await createRFQ(input)
      setRecordId(created.id)
      setDocumentNumber(created.documentNumber)
      notify.success(`Draft created · ${created.documentNumber}`)
      resetDirty()
      navigate(`/purchase/rfqs/${created.id}/edit`, { replace: true })
      return created.id
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Save failed')
      return null
    } finally {
      setSaving(false)
    }
  }

  const saveAndSend = async () => {
    const savedId = await saveDraft()
    if (savedId) navigate(`/purchase/rfqs/${savedId}?send=1`)
  }

  const selectedVendorCount = vendorPicks.filter((p) => p.selected).length

  const formMetrics = useMemo(
    () => [
      {
        label: 'Lines',
        value: String(lines.length),
        accent: 'blue' as const,
        highlight: lines.length > 0,
      },
      {
        label: 'Est. Value',
        value: formatCurrency(estimatedValue),
        accent: 'amber' as const,
        highlight: estimatedValue > 0,
      },
    ],
    [lines.length, estimatedValue],
  )

  const documentTitle = isNew ? 'New Request for Quotation' : (documentNumber ?? 'RFQ')

  const recordHeaderFacts = useMemo(
    () => [
      ...(isNew
        ? [{ label: 'RFQ No', value: documentNumber ?? 'Auto-generated' }]
        : []),
      {
        label: 'Source',
        value:
          sourceMode === 'manual'
            ? 'Manual'
            : selectedPrIds.length
              ? `${selectedPrIds.length} PR${selectedPrIds.length === 1 ? '' : 's'}`
              : SOURCE_MODE_LABELS[sourceMode],
      },
      { label: 'Buyer', value: ACTOR.name },
      {
        label: 'Date',
        value: formatFastTabDate(documentDate) ?? formatDate(documentDate),
      },
      {
        label: 'Bid due',
        value: formatFastTabDate(bidDueDate) ?? bidDueDate,
      },
    ],
    [isNew, documentNumber, sourceMode, selectedPrIds.length, documentDate, bidDueDate],
  )

  const commercialPeek = commercialTermsSummary({
    expectedDelivery: expectedDeliveryDate,
    paymentTerms,
    freightTerms,
    deliveryTerms,
    dueDate: bidDueDate,
  })

  const notesPeek = notesSummary(remarks, inspectionRequirement)

  const primaryVendor = vendorPicks.find((p) => p.selected)?.vendor ?? vendorPicks[0]?.vendor
  const documentFactBox = useMemo(() => {
    const approval = purchaseDocumentApprovalFact('draft')
    const relatedPrs = approvedPrs.filter((p) => selectedPrIds.includes(p.id))
    const firstPr = relatedPrs[0]
    const firstLine = lines.find((l) => l.itemId || l.itemCode.trim())
    return (
      <PurchaseDocumentFactBox
        vendor={
          primaryVendor
            ? {
                id: primaryVendor.id,
                code: primaryVendor.vendorCode,
                name: primaryVendor.vendorName,
                rating: primaryVendor.rating,
                paymentTerms: paymentTerms || primaryVendor.paymentTerms,
                leadTimeDays: primaryVendor.leadTimeDays,
              }
            : null
        }
        purchaseHistory={{
          lastPurchasePrice:
            firstLine && Number(firstLine.targetPrice) > 0 ? Number(firstLine.targetPrice) : null,
          lastVendorName: primaryVendor?.vendorName ?? null,
          averageLeadTimeDays: primaryVendor?.leadTimeDays ?? null,
        }}
        documentStatus={{
          statusLabel: 'Draft',
          ...approval,
          createdBy: ACTOR.name,
          modifiedBy: null,
          modifiedDate: null,
        }}
        related={buildPurchaseRelatedLinks({
          purchaseRequisitionId: firstPr?.id ?? null,
          purchaseRequisitionNumber: firstPr?.documentNumber ?? null,
        })}
      />
    )
  }, [primaryVendor, approvedPrs, selectedPrIds, lines, paymentTerms])

  const sourcePeek = joinFastTabSummary([
    SOURCE_MODE_LABELS[sourceMode],
    sourceMode !== 'manual' && selectedPrIds.length
      ? `${selectedPrIds.length} PR selected`
      : false,
  ])

  if (loading) {
    return (
      <PurchaseCardFormShell
        title="RFQ"
        description="Loading…"
        status="Draft"
        favoritePath="/purchase/rfqs/new"
        breadcrumbs={[
          { label: 'RFQs', to: '/purchase/rfqs' },
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
      title={isNew ? 'New Request for Quotation' : `Edit ${documentNumber ?? 'RFQ'}`}
      description="Invite vendors — from approved PR(s) or manual demand"
      recordNo={documentNumber ?? (isNew ? 'New' : undefined)}
      recordTitle={documentTitle}
      status="Draft"
      statusTone={purchaseStatusTone('draft')}
      statusKey="draft"
      recordHeaderFacts={recordHeaderFacts}
      favoritePath={recordId ? `/purchase/rfqs/${recordId}/edit` : '/purchase/rfqs/new'}
      breadcrumbs={[
        { label: 'RFQs', to: '/purchase/rfqs' },
        { label: isNew ? 'New' : documentNumber ?? 'Edit' },
      ]}
      backLink={{ to: '/purchase/rfqs', label: 'Back to RFQs' }}
      factBox={documentFactBox}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          collapseSecondaryOnNarrow
          secondaryActions={[
            {
              id: 'draft',
              label: saving ? 'Saving…' : 'Save Draft',
              icon: Save,
              onClick: () => void saveDraft(),
              disabled: saving,
              pin: true,
            },
            {
              id: 'recommended',
              label: 'Add Recommended Vendors',
              icon: Users,
              onClick: () => void addRecommendedVendors(),
            },
          ]}
          primaryAction={{
            id: 'send',
            label: 'Save & Send RFQ',
            icon: Send,
            onClick: () => void saveAndSend(),
            disabled: saving,
          }}
        />
      }
      stickyFooter
      footer={
        <ErpStickySaveBar
          sticky
          onSaveDraft={() => void saveDraft()}
          saveDraftLabel={saving ? 'Saving…' : 'Save Draft'}
          onSave={() => void saveAndSend()}
          submitLabel="Save & Send RFQ"
          isSubmitting={saving}
          cancelLabel="Cancel"
          onCancel={() => navigate('/purchase/rfqs')}
        />
      }
      onSaveShortcut={() => void saveDraft()}
    >
      <EnterpriseFormMetrics metrics={formMetrics} />

      <ErpCardSection
        title="Source"
        subtitle="Manual demand or copy from approved requisition(s)"
        icon={ClipboardList}
        accent="slate"
        collapsible
        defaultOpen={isNew}
        dense
        columns={1}
        collapsedSummary={sourcePeek || undefined}
      >
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(SOURCE_MODE_LABELS) as [SourceMode, string][]).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={cn(
                'rounded border px-2.5 py-1 text-[12px] font-medium transition-colors',
                sourceMode === mode
                  ? 'border-erp-primary bg-erp-primary text-white'
                  : 'border-erp-border bg-erp-surface text-erp-text hover:border-erp-primary/40',
              )}
              onClick={() => {
                setSourceMode(mode)
                markDirty()
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {sourceMode === 'manual' ? (
          <p className="text-[12px] text-erp-muted">
            Source: Manual Entry — add item lines below.
          </p>
        ) : (
          <div className="space-y-2">
            {approvedPrs.length === 0 ? (
              <p className="text-[12px] text-erp-muted">No approved requisitions available.</p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-erp-border p-1.5">
                {approvedPrs.map((pr) => {
                  const checked = selectedPrIds.includes(pr.id)
                  return (
                    <label
                      key={pr.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[12px] hover:bg-erp-surface-alt"
                    >
                      <Checkbox
                        checked={checked}
                        onChange={() => {
                          setSelectedPrIds((prev) => {
                            if (sourceMode === 'single_pr') return checked ? [] : [pr.id]
                            return checked ? prev.filter((x) => x !== pr.id) : [...prev, pr.id]
                          })
                          markDirty()
                        }}
                      />
                      <span className="font-mono font-medium">{pr.documentNumber}</span>
                      <span className="truncate text-erp-muted">
                        {pr.department} · {formatCurrency(pr.totalAmount)}
                      </span>
                      <Link
                        to={`/purchase/requisitions/${pr.id}`}
                        className="ml-auto shrink-0 text-erp-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View
                      </Link>
                    </label>
                  )
                })}
              </div>
            )}
            <ErpButton type="button" size="sm" variant="outline" onClick={copyFromPr}>
              Copy from PR
            </ErpButton>
          </div>
        )}
      </ErpCardSection>

      <ErpCardSection
        title="General Information"
        subtitle="Dates, buyer, and locations"
        icon={FileText}
        accent="blue"
        collapsible
        defaultOpen
        dense
      >
        <ErpFormSpan span={3}>
          <p className="erp-field-group__label">Document</p>
        </ErpFormSpan>
        <ErpFieldRow label="RFQ Number" readOnly>
          <Input value={documentNumber ?? 'Auto-generated'} readOnly className="bg-erp-surface-alt" />
        </ErpFieldRow>
        <ErpFieldRow label="RFQ Date" required>
          <Input
            type="date"
            value={documentDate}
            onChange={(e) => {
              setDocumentDate(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Enquiry Due Date" required>
          <Input
            type="date"
            value={bidDueDate}
            onChange={(e) => {
              setBidDueDate(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Buyer" readOnly>
          <Input value={ACTOR.name} readOnly className="bg-erp-surface-alt" />
        </ErpFieldRow>
        <ErpFieldRow label="Currency" readOnly>
          <Input value={currency} readOnly className="bg-erp-surface-alt" />
        </ErpFieldRow>
        <ErpFieldRow label="Technical Contact">
          <Input
            value={technicalContact}
            onChange={(e) => {
              setTechnicalContact(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Commercial Contact">
          <Input
            value={commercialContact}
            onChange={(e) => {
              setCommercialContact(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>

        <ErpFormSpan span={3}>
          <p className="erp-field-group__label">Locations</p>
        </ErpFormSpan>
        <ErpFieldRow label="Purchase Location" required>
          <Select
            value={purchaseLocationId}
            onChange={(e) => {
              setPurchaseLocationId(e.target.value)
              markDirty()
            }}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow label="Delivery Location">
          <Select
            value={deliveryLocationId}
            onChange={(e) => {
              setDeliveryLocationId(e.target.value)
              markDirty()
            }}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow label="Expected Delivery Date">
          <Input
            type="date"
            value={expectedDeliveryDate}
            onChange={(e) => {
              setExpectedDeliveryDate(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
      </ErpCardSection>

      <ErpCardSection
        title="Commercial Terms"
        subtitle="Payment, delivery, and freight"
        icon={Truck}
        accent="amber"
        collapsible
        defaultOpen={false}
        dense
        collapsedSummary={commercialPeek || undefined}
      >
        <ErpFormSpan span={3}>
          <p className="erp-field-group__label">Commercial</p>
        </ErpFormSpan>
        <ErpFieldRow label="Payment Terms">
          <PurchaseTermSelect
            value={paymentTerms}
            onChange={(v) => {
              setPaymentTerms(v)
              markDirty()
            }}
            options={PURCHASE_PAYMENT_TERMS}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Delivery Terms">
          <PurchaseTermSelect
            value={deliveryTerms}
            onChange={(v) => {
              setDeliveryTerms(v)
              markDirty()
            }}
            options={PURCHASE_DELIVERY_TERMS}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Freight Terms">
          <PurchaseTermSelect
            value={freightTerms}
            onChange={(v) => {
              setFreightTerms(v)
              markDirty()
            }}
            options={PURCHASE_FREIGHT_TERMS}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Inspection Requirement" className="sm:col-span-2 lg:col-span-3">
          <Input
            value={inspectionRequirement}
            onChange={(e) => {
              setInspectionRequirement(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
      </ErpCardSection>

      <ErpCardSection
        title="Item Lines"
        subtitle="Demand lines for vendor quotation"
        icon={Package}
        accent="teal"
        collapsible
        defaultOpen
        dense
        columns={1}
        badge={`${lines.length} line${lines.length === 1 ? '' : 's'} · ${formatCurrency(estimatedValue)}`}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <ErpButton
            type="button"
            size="sm"
            variant="secondary"
            icon={Plus}
            onClick={() => setLinesDirty([...lines, emptyLine()])}
          >
            Add line
          </ErpButton>
        </div>
        <div className="overflow-x-auto rounded-md border border-erp-border">
          <table className="erp-table text-[12px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-[1] bg-erp-surface-alt">#</th>
                <th>Source PR</th>
                <th>Item</th>
                <th>Description</th>
                <th>Specification</th>
                <th className="num">Qty</th>
                <th>UOM</th>
                <th>Required</th>
                <th className="num">Target Price</th>
                <th className="num">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td className="sticky left-0 z-[1] bg-erp-surface font-mono text-erp-muted">
                    {line.lineNo}
                  </td>
                  <td className="font-mono text-[11px]">
                    {line.purchaseRequisitionNumber || '—'}
                  </td>
                  <td>
                    <select
                      className="erp-input h-8 min-w-[7.5rem] font-mono text-[12px]"
                      value={line.itemId}
                      onChange={(e) => {
                        const item = catalogItems.find((i) => i.id === e.target.value)
                        if (!item) {
                          patchLine(line.id, { itemId: '', itemCode: '', itemName: '' })
                          return
                        }
                        patchLine(line.id, {
                          itemId: item.id,
                          itemCode: item.itemCode,
                          itemName: item.itemName,
                          specification: item.description,
                          hsnCode: item.hsnCode,
                          sacCode: item.sacCode,
                          uom: item.uom,
                          targetPrice: item.standardRate,
                        })
                      }}
                    >
                      <option value="">Select…</option>
                      {catalogItems.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.itemCode}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="erp-input h-8 min-w-[9rem] text-[12px]"
                      value={line.itemName}
                      onChange={(e) => patchLine(line.id, { itemName: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="erp-input h-8 min-w-[7rem] text-[12px]"
                      value={line.specification}
                      onChange={(e) => patchLine(line.id, { specification: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="erp-input h-8 w-16 text-right text-[12px]"
                      value={line.quantity}
                      onChange={(e) => patchLine(line.id, { quantity: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      className="erp-input h-8 w-14 text-[12px]"
                      value={line.uom}
                      onChange={(e) => patchLine(line.id, { uom: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      className="erp-input h-8 text-[12px]"
                      value={line.requiredDate}
                      onChange={(e) => patchLine(line.id, { requiredDate: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="erp-input h-8 w-20 text-right text-[12px]"
                      value={line.targetPrice}
                      onChange={(e) =>
                        patchLine(line.id, { targetPrice: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="num font-medium tabular-nums">
                    {formatCurrency(line.amount)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="text-erp-danger-fg"
                      disabled={lines.length <= 1}
                      aria-label="Remove line"
                      onClick={() => setLinesDirty(lines.filter((l) => l.id !== line.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-erp-surface-alt font-medium">
                <td colSpan={5} className="sticky left-0 z-[1] bg-erp-surface-alt text-erp-muted">
                  Totals
                </td>
                <td className="num tabular-nums">
                  {lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0)}
                </td>
                <td colSpan={3} />
                <td className="num tabular-nums">{formatCurrency(estimatedValue)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </ErpCardSection>

      <ErpCardSection
        title="Vendor Selection"
        subtitle="Invitees for this RFQ"
        icon={Users}
        accent="violet"
        collapsible
        defaultOpen
        dense
        columns={1}
        badge={`${selectedVendorCount} selected`}
        collapsedSummary={
          selectedVendorCount
            ? `${selectedVendorCount} of ${vendorPicks.length} selected`
            : 'No vendors selected'
        }
      >
        <div className="mb-2 flex flex-wrap gap-2">
          <Select
            className="max-w-xs"
            value=""
            onChange={(e) => {
              const v = allVendors.find((x) => x.id === e.target.value)
              if (v) ensureVendorPick(v, true)
            }}
          >
            <option value="">Add vendor…</option>
            {allVendors
              .filter((v) => !vendorPicks.some((p) => p.vendorId === v.id))
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vendorCode} — {v.vendorName}
                </option>
              ))}
          </Select>
          <ErpButton
            type="button"
            size="sm"
            variant="outline"
            icon={Users}
            onClick={() => void addRecommendedVendors()}
          >
            Recommended
          </ErpButton>
        </div>
        {vendorPicks.length === 0 ? (
          <p className="rounded border border-dashed border-erp-border bg-erp-surface-alt/50 px-3 py-3 text-[12px] text-erp-muted">
            No vendors yet — add from the list or use Recommended based on item preference.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-erp-border">
            <table className="erp-table text-[12px]">
              <thead>
                <tr>
                  <th>Sel</th>
                  <th>Code</th>
                  <th>Name</th>
                  <th>GSTIN</th>
                  <th>State</th>
                  <th>Contact</th>
                  <th>Rating</th>
                  <th className="num">Last price</th>
                </tr>
              </thead>
              <tbody>
                {vendorPicks.map((p) => (
                  <tr key={p.vendorId}>
                    <td>
                      <Checkbox
                        checked={p.selected}
                        onChange={() => {
                          setVendorPicks((prev) =>
                            prev.map((x) =>
                              x.vendorId === p.vendorId ? { ...x, selected: !x.selected } : x,
                            ),
                          )
                          markDirty()
                        }}
                      />
                    </td>
                    <td className="font-mono">{p.vendor.vendorCode}</td>
                    <td>{p.vendor.vendorName}</td>
                    <td className="font-mono text-[11px]">{p.vendor.gstin}</td>
                    <td>{p.vendor.state}</td>
                    <td className="max-w-[10rem] truncate" title={p.vendor.contactEmail}>
                      {p.vendor.contactPerson}
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {p.vendor.rating.toFixed(1)}
                      </span>
                    </td>
                    <td className="num">
                      {p.lastPurchasePrice != null
                        ? formatCurrency(p.lastPurchasePrice)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ErpCardSection>

      <ErpCardSection
        title="Remarks"
        subtitle="Internal notes for this RFQ"
        icon={FileText}
        accent="slate"
        collapsible
        defaultOpen={false}
        dense
        columns={1}
        collapsedSummary={notesPeek || undefined}
      >
        <ErpFieldRow label="Remarks">
          <Textarea
            rows={3}
            className="min-h-[4.5rem] max-h-40"
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
