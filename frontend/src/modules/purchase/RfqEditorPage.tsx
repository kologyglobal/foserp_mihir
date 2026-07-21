import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ClipboardList,
  FileText,
  Package,
  Plus,
  Star,
  Trash2,
  Truck,
  Users,
} from 'lucide-react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import { purchaseStatusTone } from '@/components/purchase/purchaseCardFormShared'
import { PurchaseTermSelect } from '@/components/purchase/PurchaseTermSelect'
import {
  PurchaseEnterpriseFactBox,
  purchaseSectionId,
} from '@/components/purchase/PurchaseEnterpriseFormKit'
import {
  ErpCardSection,
  ErpFieldRow,
} from '@/components/erp/card-form'
import { ErpButton } from '@/components/erp/ErpButton'
import { FormActionBar } from '@/components/erp/FormActionBar'
import { Checkbox, Input, Select, Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Badge } from '@/components/ui/Badge'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import {
  createRFQ,
  getPurchaseItems,
  getPurchaseRequisitions,
  getPurchaseWarehouses,
  getRecommendedVendorsForItems,
  getRFQById,
  getVendors,
  previewNextRfqNumber,
  PurchaseServiceError,
  updateRFQ,
} from '@/services/purchase'
import type {
  PurchaseItem,
  PurchaseRequisition,
  RfqLine,
  Vendor,
} from '@/types/purchaseDomain'
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
import { useOptionalAuth } from '@/context/AuthProvider'
import { PURCHASE_FORM_ROUTES } from './purchaseFormRoutes'

type LocationOption = { id: string; code: string; name: string; state: string; city: string }

const EMPTY_LOCATION: LocationOption = { id: '', code: '', name: '', state: '', city: '' }

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
  const auth = useOptionalAuth()
  const sessionUser = auth?.session?.user
  const ACTOR = useMemo(() => {
    const name = sessionUser
      ? `${sessionUser.firstName ?? ''} ${sessionUser.lastName ?? ''}`.trim() ||
        sessionUser.email ||
        sessionUser.id
      : ''
    return {
      id: sessionUser?.id ?? '',
      code: sessionUser?.email?.split('@')[0] ?? '',
      name,
    }
  }, [sessionUser])

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
  const [purchaseLocationId, setPurchaseLocationId] = useState('')
  const [deliveryLocationId, setDeliveryLocationId] = useState('')
  const [currency] = useState('INR')
  const [paymentTerms, setPaymentTerms] = useState('Net 30')
  const [deliveryTerms, setDeliveryTerms] = useState('Ex-Works')
  const [freightTerms, setFreightTerms] = useState('Vendor')
  const [inspectionRequirement, setInspectionRequirement] = useState('')
  const [technicalContact, setTechnicalContact] = useState('')
  const [commercialContact, setCommercialContact] = useState('')
  const [remarks, setRemarks] = useState('')
  const [lines, setLines] = useState<RfqLine[]>([emptyLine()])
  const [vendorPicks, setVendorPicks] = useState<VendorPick[]>([])

  const [approvedPrs, setApprovedPrs] = useState<PurchaseRequisition[]>([])
  const [catalogItems, setCatalogItems] = useState<PurchaseItem[]>([])
  const [allVendors, setAllVendors] = useState<Vendor[]>([])
  const [locations, setLocations] = useState<LocationOption[]>([])

  const { dirty, markDirty, resetDirty } = useUnsavedChangesGuard(true)

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
    if (ACTOR.name) setCommercialContact((prev) => prev || ACTOR.name)
  }, [ACTOR.name])

  useEffect(() => {
    if (!isNew) return
    let cancelled = false
    void previewNextRfqNumber()
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
    void Promise.all([
      getPurchaseRequisitions(),
      getPurchaseItems(),
      getVendors(),
      getPurchaseWarehouses(),
    ]).then(([prs, items, vendors, warehouses]) => {
      setApprovedPrs(prs.filter((p) => p.status === 'approved' || p.status === 'converted_to_rfq'))
      setCatalogItems(items)
      setAllVendors(vendors.filter((v) => v.isActive))
      const locs = warehouses.map((w) => ({
        id: w.id,
        code: w.code,
        name: w.name,
        state: w.state,
        city: w.city,
      }))
      setLocations(locs)
      if (locs[0]) {
        setPurchaseLocationId((prev) => prev || locs[0].id)
        setDeliveryLocationId((prev) => prev || locs[0].id)
      }
    })
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
      locations.find((l) => l.id === purchaseLocationId) ?? locations[0] ?? EMPTY_LOCATION
    const deliveryLocation =
      locations.find((l) => l.id === deliveryLocationId) ?? locations[0] ?? EMPTY_LOCATION
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
    if (saving) return null
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
        notify.success(`Saved · ${updated.documentNumber}`)
        resetDirty()
        navigate(PURCHASE_FORM_ROUTES.rfq.list, { replace: true })
        return updated.id
      }
      const created = await createRFQ(input)
      setRecordId(created.id)
      setDocumentNumber(created.documentNumber)
      notify.success(`Saved · ${created.documentNumber}`)
      resetDirty()
      navigate(PURCHASE_FORM_ROUTES.rfq.list, { replace: true })
      return created.id
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Save failed')
      return null
    } finally {
      setSaving(false)
    }
  }

  const selectedVendorCount = vendorPicks.filter((p) => p.selected).length

  const documentTitle = isNew ? 'New Request for Quotation' : (documentNumber ?? 'RFQ')

  const recordHeaderFacts = useMemo(
    () => [
      ...(isNew
        ? [{ label: 'RFQ No', value: documentNumber ?? 'Loading…' }]
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
      { label: 'Buyer', value: ACTOR.name || '—' },
      {
        label: 'Date',
        value: formatFastTabDate(documentDate) ?? formatDate(documentDate),
      },
      {
        label: 'Bid due',
        value: formatFastTabDate(bidDueDate) ?? bidDueDate,
      },
    ],
    [isNew, documentNumber, sourceMode, selectedPrIds.length, documentDate, bidDueDate, ACTOR.name],
  )

  const commercialPeek = commercialTermsSummary({
    expectedDelivery: expectedDeliveryDate,
    paymentTerms,
    freightTerms,
    deliveryTerms,
    dueDate: bidDueDate,
  })

  const notesPeek = notesSummary(remarks, inspectionRequirement)

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
      commandBar={null}
      factBox={
        <PurchaseEnterpriseFactBox
          title="RFQ insight"
          summary={[
            { label: 'RFQ No.', value: documentNumber ?? (isNew ? 'Loading…' : '—') },
            { label: 'Status', value: 'Draft' },
            { label: 'Source', value: SOURCE_MODE_LABELS[sourceMode] },
            {
              label: 'Vendors',
              value: `${selectedVendorCount} selected`,
              highlight: selectedVendorCount > 0,
            },
            {
              label: 'Bid due',
              value: formatFastTabDate(bidDueDate) ?? bidDueDate,
            },
            ...(dirty
              ? [{ label: 'Changes', value: 'Unsaved', highlight: true as const }]
              : []),
          ]}
        >
          <ul className="mt-3 list-disc space-y-1 pl-4 text-[11px] text-erp-muted">
            <li>RFQ Number is reserved from the series and confirmed on save.</li>
            <li>Select vendors in Vendor Selection before sending the RFQ.</li>
          </ul>
          {dirty ? (
            <div className="mt-2">
              <Badge color="orange">Unsaved changes</Badge>
            </div>
          ) : null}
        </PurchaseEnterpriseFactBox>
      }
      stickyFooter
      footer={
        <FormActionBar
          sticky
          cancelFirst
          busy={saving}
          dirty={dirty}
          onCancel={() => {
            resetDirty()
            navigate(PURCHASE_FORM_ROUTES.rfq.list)
          }}
          onSave={saveDraft}
        />
      }
      onSaveShortcut={() => void saveDraft()}
    >
      <div className="space-y-3">
      <ErpCardSection
        id={purchaseSectionId('source')}
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
        id={purchaseSectionId('general')}
        title="RFQ Header"
        subtitle="RFQ identity, buyer, dates, and locations"
        icon={FileText}
        accent="blue"
        collapsible
        defaultOpen
        dense
        columns={3}
        collapsedSummary={joinFastTabSummary([
          documentNumber ?? 'New RFQ',
          formatFastTabDate(documentDate),
          formatFastTabDate(bidDueDate),
        ])}
      >
        <ErpFieldRow
          label="RFQ Number"
          readOnly
          horizontal={false}
          hint={isNew ? 'Preview from number series — assigned when you save' : undefined}
        >
          <Input
            value={documentNumber ?? ''}
            placeholder="Loading number…"
            readOnly
            className="bg-erp-surface-alt"
          />
        </ErpFieldRow>
        <ErpFieldRow label="RFQ Date" required horizontal={false}>
          <Input
            type="date"
            value={documentDate}
            onChange={(e) => {
              setDocumentDate(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Enquiry Due Date" required horizontal={false}>
          <Input
            type="date"
            value={bidDueDate}
            onChange={(e) => {
              setBidDueDate(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Buyer" readOnly horizontal={false}>
          <Input value={ACTOR.name} readOnly className="bg-erp-surface-alt" />
        </ErpFieldRow>
        <ErpFieldRow label="Currency" readOnly horizontal={false}>
          <Input value={currency} readOnly className="bg-erp-surface-alt" />
        </ErpFieldRow>
        <ErpFieldRow label="Expected Delivery Date" horizontal={false}>
          <Input
            type="date"
            value={expectedDeliveryDate}
            onChange={(e) => {
              setExpectedDeliveryDate(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Purchase Location" required horizontal={false}>
          <Select
            value={purchaseLocationId}
            onChange={(e) => {
              setPurchaseLocationId(e.target.value)
              markDirty()
            }}
          >
            <option value="">Select location</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow label="Delivery Location" horizontal={false}>
          <Select
            value={deliveryLocationId}
            onChange={(e) => {
              setDeliveryLocationId(e.target.value)
              markDirty()
            }}
          >
            <option value="">Select location</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow label="Technical Contact" horizontal={false}>
          <Input
            value={technicalContact}
            onChange={(e) => {
              setTechnicalContact(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Commercial Contact" horizontal={false} className="sm:col-span-2">
          <Input
            value={commercialContact}
            onChange={(e) => {
              setCommercialContact(e.target.value)
              markDirty()
            }}
          />
        </ErpFieldRow>
      </ErpCardSection>

      <ErpCardSection
        id={purchaseSectionId('commercial')}
        title="Commercial Terms"
        subtitle="Payment, delivery, and freight"
        icon={Truck}
        accent="amber"
        collapsible
        defaultOpen={false}
        dense
        columns={3}
        collapsedSummary={commercialPeek || undefined}
      >
        <ErpFieldRow label="Payment Terms" horizontal={false}>
          <PurchaseTermSelect
            value={paymentTerms}
            onChange={(v) => {
              setPaymentTerms(v)
              markDirty()
            }}
            options={PURCHASE_PAYMENT_TERMS}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Delivery Terms" horizontal={false}>
          <PurchaseTermSelect
            value={deliveryTerms}
            onChange={(v) => {
              setDeliveryTerms(v)
              markDirty()
            }}
            options={PURCHASE_DELIVERY_TERMS}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Freight Terms" horizontal={false}>
          <PurchaseTermSelect
            value={freightTerms}
            onChange={(v) => {
              setFreightTerms(v)
              markDirty()
            }}
            options={PURCHASE_FREIGHT_TERMS}
          />
        </ErpFieldRow>
        <ErpFieldRow
          label="Inspection Requirement"
          horizontal={false}
          className="sm:col-span-2 lg:col-span-3"
        >
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
        id={purchaseSectionId('lines')}
        title="Item Details"
        subtitle="Demand lines for vendor quotation"
        icon={Package}
        accent="teal"
        collapsible
        defaultOpen
        dense
        columns={1}
        badge={`${lines.length} line${lines.length === 1 ? '' : 's'}`}
        collapsedSummary={
          lines.length
            ? `${lines.length} line${lines.length === 1 ? '' : 's'} · ${formatCurrency(estimatedValue)}`
            : 'No lines'
        }
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
        id={purchaseSectionId('vendors')}
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
        id={purchaseSectionId('remarks')}
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
        <ErpFieldRow label="Remarks" horizontal={false}>
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
      </div>
    </PurchaseCardFormShell>
  )
}
