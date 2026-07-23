import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CheckCircle2,
  Download,
  FileText,
  GitCompare,
  Printer,
  RefreshCw,
  ShoppingCart,
  ThumbsUp,
} from 'lucide-react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import {
  PurchaseDocumentFactBox,
  buildPurchaseRelatedLinks,
} from '@/components/purchase/PurchaseDocumentFactBox'
import { purchaseStatusTone } from '@/components/purchase/purchaseCardFormShared'
import { ErpCardSection, ErpFormSpan } from '@/components/erp/card-form'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { Checkbox, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import {
  approveQuotationRecommendation,
  buildQuotationComparison,
  createPurchaseOrderFromComparison,
  getQuotationComparison,
  getRFQById,
  getVendorQuotations,
  PurchaseServiceError,
  recommendQuotationVendor,
  updateQuotationComparisonSelection,
} from '@/services/purchase'
import {
  QUOTATION_COMPARISON_CRITERION_LABELS,
  QUOTATION_COMPARISON_METHOD_LABELS,
  QUOTATION_COMPLIANCE_STATUS_LABELS,
  type QuotationComparison,
  type QuotationComparisonCriterion,
  type QuotationComparisonMethod,
  type QuotationComparisonQuoteCell,
  type QuotationSelectionMode,
  type RequestForQuotation,
  type VendorQuotation,
} from '@/types/purchaseDomain'
import { formatCurrency } from '@/utils/formatters/currency'
import { purchaseBreadcrumbs } from '@/utils/purchaseNavigation'
import { usePurchasePermissions } from '@/utils/permissions'
import { notify } from '@/store/toastStore'
import { useAdminStore } from '@/store/adminStore'
import { cn } from '@/utils/cn'

const ALL_CRITERIA = Object.keys(
  QUOTATION_COMPARISON_CRITERION_LABELS,
) as QuotationComparisonCriterion[]

const REC_STATUS_LABEL: Record<QuotationComparison['recommendationStatus'], string> = {
  none: 'Open',
  recommended: 'Recommended',
  approved: 'Awarded',
}

type VendorColumnMeta = {
  vendorId: string
  vendorName: string
  quotationId: string
  quotationNumber: string
  basicTotal: number
  landedTotal: number
  bestLeadDays: number | null
  lowestLandedWins: number
  lowestBasicWins: number
}

function enrichComparison(
  cmp: QuotationComparison,
  quotations: VendorQuotation[],
  rfq?: RequestForQuotation | null,
): QuotationComparison {
  const nameByVendor = new Map(
    quotations.map((q) => [q.vendor.id, q.vendor.name] as const),
  )
  const quoteNoByVendor = new Map(
    quotations.map((q) => [q.vendor.id, q.documentNumber] as const),
  )
  const rfqLineById = new Map((rfq?.lines ?? []).map((l) => [l.id, l] as const))
  const rfqLineByItem = new Map((rfq?.lines ?? []).map((l) => [l.itemId, l] as const))

  const rows = cmp.rows.map((row) => {
    const rfqLine =
      (row.rfqLineId ? rfqLineById.get(row.rfqLineId) : undefined) ??
      rfqLineByItem.get(row.itemId)
    const quotes = row.quotes.map((q) => ({
      ...q,
      vendorName: q.vendorName || nameByVendor.get(q.vendorId) || 'Vendor',
      vendorQuotationNumber:
        q.vendorQuotationNumber || quoteNoByVendor.get(q.vendorId) || q.vendorQuotationNumber,
    }))

    const withRates = quotes.filter((q) => !q.hasMissingValues)
    const minBasic = Math.min(...withRates.map((q) => q.rate), Number.POSITIVE_INFINITY)
    const minLanded = Math.min(...withRates.map((q) => q.landedRate), Number.POSITIVE_INFINITY)
    const minLead = Math.min(...withRates.map((q) => q.leadTimeDays), Number.POSITIVE_INFINITY)

    return {
      ...row,
      itemCode: row.itemCode || rfqLine?.itemCode || '',
      itemName: row.itemName || rfqLine?.itemName || '',
      uom: row.uom || rfqLine?.uom || '',
      quotes: quotes.map((q) => ({
        ...q,
        isLowestBasic: withRates.length > 0 && q.rate === minBasic,
        isLowestLanded: withRates.length > 0 && q.landedRate === minLanded,
        isBestDelivery: withRates.length > 0 && q.leadTimeDays === minLead,
      })),
    }
  })

  const recommendedVendorName =
    cmp.recommendedVendorName ||
    (cmp.recommendedVendorId
      ? nameByVendor.get(cmp.recommendedVendorId) ?? null
      : null)

  return { ...cmp, rows, recommendedVendorName }
}

function buildVendorColumns(
  cmp: QuotationComparison,
  vendorIds: string[],
  quotations: VendorQuotation[],
): VendorColumnMeta[] {
  return vendorIds.map((vendorId) => {
    const sample = cmp.rows
      .map((r) => r.quotes.find((q) => q.vendorId === vendorId))
      .find(Boolean)
    const quotation = quotations.find((q) => q.vendor.id === vendorId)
    let basicTotal = 0
    let landedTotal = 0
    let bestLeadDays: number | null = null
    let lowestLandedWins = 0
    let lowestBasicWins = 0
    for (const row of cmp.rows) {
      const q = row.quotes.find((x) => x.vendorId === vendorId)
      if (!q) continue
      basicTotal += q.rate * row.quantity
      landedTotal += q.landedRate * row.quantity
      if (bestLeadDays === null || q.leadTimeDays < bestLeadDays) bestLeadDays = q.leadTimeDays
      if (q.isLowestLanded) lowestLandedWins += 1
      if (q.isLowestBasic) lowestBasicWins += 1
    }
    return {
      vendorId,
      vendorName:
        sample?.vendorName ||
        quotation?.vendor.name ||
        'Vendor',
      quotationId: sample?.vendorQuotationId || quotation?.id || '',
      quotationNumber:
        sample?.vendorQuotationNumber || quotation?.documentNumber || '—',
      basicTotal,
      landedTotal,
      bestLeadDays,
      lowestLandedWins,
      lowestBasicWins,
    }
  })
}

function cellHighlightClass(q: QuotationComparisonQuoteCell | undefined): string {
  if (!q) return 'bg-erp-surface-alt text-erp-muted'
  const parts: string[] = ['align-top']
  if (q.hasMissingValues) parts.push('bg-erp-surface-alt text-erp-muted')
  if (q.isLowestBasic) parts.push('bg-emerald-50')
  if (q.isLowestLanded) parts.push('bg-sky-50 font-semibold text-erp-ink')
  if (q.isBestDelivery) parts.push('bg-amber-50')
  if (q.isNonCompliant) parts.push('bg-rose-50')
  if (q.isPreferred) parts.push('ring-2 ring-inset ring-erp-primary')
  return parts.join(' ')
}

function complianceChip(q: QuotationComparisonQuoteCell) {
  const worst =
    q.technicalCompliance === 'non_compliant' || q.commercialCompliance === 'non_compliant'
      ? 'non_compliant'
      : q.technicalCompliance === 'partial' || q.commercialCompliance === 'partial'
        ? 'partial'
        : q.technicalCompliance === 'compliant' && q.commercialCompliance === 'compliant'
          ? 'compliant'
          : 'not_assessed'
  const color =
    worst === 'compliant'
      ? 'green'
      : worst === 'partial'
        ? 'yellow'
        : worst === 'non_compliant'
          ? 'red'
          : 'gray'
  return (
    <Badge color={color} className="text-[10px]">
      {QUOTATION_COMPLIANCE_STATUS_LABELS[worst]}
    </Badge>
  )
}

function exportComparisonCsv(cmp: QuotationComparison, vendorIds: string[]) {
  const vendors = vendorIds
    .map((id) => cmp.rows[0]?.quotes.find((q) => q.vendorId === id))
    .filter(Boolean) as QuotationComparisonQuoteCell[]
  const header = [
    'Item Code',
    'Item Name',
    'Qty',
    'UOM',
    ...vendors.flatMap((v) => [
      `${v.vendorName} Rate`,
      `${v.vendorName} Landed`,
      `${v.vendorName} Lead Days`,
    ]),
  ]
  const body = cmp.rows.map((row) => {
    const cells = vendors.flatMap((v) => {
      const q = row.quotes.find((x) => x.vendorId === v.vendorId)
      return q
        ? [String(q.rate), String(q.landedRate), String(q.leadTimeDays)]
        : ['', '', '']
    })
    return [row.itemCode, row.itemName, String(row.quantity), row.uom, ...cells]
  })
  const tsv = [header, ...body].map((r) => r.join('\t')).join('\n')
  const blob = new Blob([tsv], { type: 'text/tab-separated-values' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${cmp.documentNumber || cmp.rfqNumber}-comparison.tsv`
  a.click()
  URL.revokeObjectURL(url)
}

function lowestLandedVendorIds(cmp: QuotationComparison): Set<string> {
  const ids = new Set<string>()
  for (const row of cmp.rows) {
    row.quotes.filter((q) => q.isLowestLanded).forEach((q) => ids.add(q.vendorId))
  }
  return ids
}

function selectionNeedsReason(
  cmp: QuotationComparison,
  selectionMode: QuotationSelectionMode,
  allLinesVendorId: string,
  lineSelections: Record<string, string>,
): boolean {
  if (selectionMode === 'all_lines') {
    if (!allLinesVendorId) return false
    return !cmp.rows.every((row) => {
      const lowest = row.quotes.find((q) => q.isLowestLanded)
      return !lowest || lowest.vendorId === allLinesVendorId
    })
  }
  return cmp.rows.some((row) => {
    const selected = lineSelections[row.itemId]
    if (!selected) return false
    const lowest = row.quotes.find((q) => q.isLowestLanded)
    return lowest && lowest.vendorId !== selected
  })
}

export function QuotationComparisonPage() {
  const { rfqId } = useParams()
  const navigate = useNavigate()
  const perms = usePurchasePermissions()
  const adminUsers = useAdminStore((s) => s.users)

  const [rfq, setRfq] = useState<RequestForQuotation | null>(null)
  const [quotations, setQuotations] = useState<VendorQuotation[]>([])
  const [comparison, setComparison] = useState<QuotationComparison | null>(null)
  const [loading, setLoading] = useState(true)
  const [building, setBuilding] = useState(false)
  const [busy, setBusy] = useState(false)

  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([])
  const [method, setMethod] = useState<QuotationComparisonMethod>('landed_cost')
  const [criteria, setCriteria] = useState<QuotationComparisonCriterion[]>([
    'basic_price',
    'landed_cost',
    'delivery_time',
    'technical_compliance',
    'commercial_compliance',
  ])
  const [selectionMode, setSelectionMode] = useState<QuotationSelectionMode>('all_lines')
  const [allLinesVendorId, setAllLinesVendorId] = useState('')
  const [lineSelections, setLineSelections] = useState<Record<string, string>>({})
  const [selectionReason, setSelectionReason] = useState('')

  const approvedByLabel = useMemo(() => {
    const raw = comparison?.approvedBy?.trim()
    if (!raw) return null
    const looksLikeId =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)
    if (!looksLikeId) return raw
    const user = adminUsers.find((u) => u.id === raw)
    if (!user) return raw
    const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
    return name || user.email || raw
  }, [comparison?.approvedBy, adminUsers])

  const applyComparison = useCallback(
    (raw: QuotationComparison, quotes: VendorQuotation[], rfqRow?: RequestForQuotation | null) => {
      const enriched = enrichComparison(raw, quotes, rfqRow)
      setComparison(enriched)
      setSelectedVendorIds(enriched.selectedVendorIds)
      setMethod(enriched.method)
      setCriteria(enriched.criteria)
      setSelectionMode(enriched.selectionMode)
      setSelectionReason(enriched.selectionReason)
      if (enriched.selectionMode === 'all_lines' && enriched.selectedVendorIds[0]) {
        setAllLinesVendorId(enriched.recommendedVendorId ?? enriched.selectedVendorIds[0] ?? '')
      }
      const perLine: Record<string, string> = {}
      for (const row of enriched.rows) {
        if (row.selectedVendorId) perLine[row.itemId] = row.selectedVendorId
      }
      setLineSelections(perLine)
    },
    [],
  )

  const load = useCallback(async () => {
    if (!rfqId) return
    setLoading(true)
    try {
      const [rfqRow, quotes, existing] = await Promise.all([
        getRFQById(rfqId),
        getVendorQuotations(rfqId),
        getQuotationComparison(rfqId),
      ])
      if (!rfqRow) {
        notify.error('RFQ not found')
        navigate('/purchase/comparison')
        return
      }
      setRfq(rfqRow)
      setQuotations(quotes)
      if (existing) {
        applyComparison(existing, quotes, rfqRow)
      } else {
        setSelectedVendorIds(quotes.map((q) => q.vendor.id))
      }
    } finally {
      setLoading(false)
    }
  }, [rfqId, navigate, applyComparison])

  useEffect(() => {
    void load()
  }, [load])

  const vendorColumns = useMemo(() => {
    if (!comparison) return selectedVendorIds
    return selectedVendorIds.filter((id) =>
      comparison.rows.some((r) => r.quotes.some((q) => q.vendorId === id)),
    )
  }, [comparison, selectedVendorIds])

  const vendorMetas = useMemo(() => {
    if (!comparison) return []
    return buildVendorColumns(comparison, vendorColumns, quotations)
  }, [comparison, vendorColumns, quotations])

  const lowestLandedVendorId = useMemo(() => {
    if (!vendorMetas.length) return null
    return vendorMetas.reduce((best, cur) =>
      cur.landedTotal < best.landedTotal ? cur : best,
    ).vendorId
  }, [vendorMetas])

  const needsReason = useMemo(() => {
    if (!comparison) return false
    return selectionNeedsReason(comparison, selectionMode, allLinesVendorId, lineSelections)
  }, [comparison, selectionMode, allLinesVendorId, lineSelections])

  const reasonMissing = needsReason && !selectionReason.trim()

  const statusLabel = comparison
    ? REC_STATUS_LABEL[comparison.recommendationStatus]
    : 'Setup'
  const statusKey =
    comparison?.recommendationStatus === 'approved'
      ? 'approved'
      : comparison?.recommendationStatus === 'recommended'
        ? 'pending_approval'
        : 'draft'

  const toggleVendor = (vendorId: string) => {
    setSelectedVendorIds((prev) =>
      prev.includes(vendorId) ? prev.filter((id) => id !== vendorId) : [...prev, vendorId],
    )
  }

  const toggleCriterion = (c: QuotationComparisonCriterion) => {
    setCriteria((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  const runBuild = async () => {
    if (!rfqId || selectedVendorIds.length < 1) {
      notify.error('Select at least one vendor')
      return
    }
    setBuilding(true)
    try {
      const built = await buildQuotationComparison({
        rfqId,
        vendorIds: selectedVendorIds,
        method,
        criteria,
        selectionMode,
        selectionReason,
        lineSelections: Object.entries(lineSelections).map(([itemId, vendorId]) => ({
          itemId,
          vendorId,
        })),
        recommendedVendorId: selectionMode === 'all_lines' ? allLinesVendorId || null : null,
      })
      applyComparison(built, quotations, rfq)
      notify.success('Comparison refreshed')
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Build failed')
    } finally {
      setBuilding(false)
    }
  }

  const persistSelection = async () => {
    if (!comparison) return false
    if (reasonMissing) {
      notify.error('Selection reason is required when not choosing lowest landed cost')
      return false
    }
    setBusy(true)
    try {
      const updated = await updateQuotationComparisonSelection(comparison.id, {
        selectionMode,
        recommendedVendorId: selectionMode === 'all_lines' ? allLinesVendorId || undefined : undefined,
        lineSelections: Object.entries(lineSelections).map(([itemId, vendorId]) => ({
          itemId,
          vendorId,
        })),
        selectionReason,
      })
      applyComparison(updated, quotations, rfq)
      return true
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Update failed')
      return false
    } finally {
      setBusy(false)
    }
  }

  const onRecommend = async () => {
    if (!comparison) return
    if (reasonMissing) {
      notify.error('Selection reason is required when not choosing lowest landed cost')
      return
    }
    if (!(await persistSelection())) return
    setBusy(true)
    try {
      const vendorId =
        selectionMode === 'all_lines'
          ? allLinesVendorId
          : Object.values(lineSelections)[0]
      const updated = await recommendQuotationVendor(comparison.id, {
        vendorId: vendorId || undefined,
        selectionReason,
      })
      applyComparison(updated, quotations, rfq)
      notify.success('Vendor recommended')
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Recommend failed')
    } finally {
      setBusy(false)
    }
  }

  const onApprove = async () => {
    if (!comparison) return
    if (reasonMissing) {
      notify.error('Selection reason is required when not choosing lowest landed cost')
      return
    }
    setBusy(true)
    try {
      const vendorId =
        selectionMode === 'all_lines'
          ? allLinesVendorId || comparison.recommendedVendorId || undefined
          : comparison.recommendedVendorId || Object.values(lineSelections)[0] || undefined
      const updated = await approveQuotationRecommendation(comparison.id, {
        vendorId,
        selectionReason: selectionReason.trim() || comparison.selectionReason,
      })
      applyComparison(updated, quotations, rfq)
      notify.success('Recommendation approved')
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Approve failed')
    } finally {
      setBusy(false)
    }
  }

  const onCreatePo = async () => {
    if (!comparison) return
    if (reasonMissing) {
      notify.error('Selection reason is required when not choosing lowest landed cost')
      return
    }
    if (!(await persistSelection())) return
    setBusy(true)
    try {
      const po = await createPurchaseOrderFromComparison(comparison.id)
      notify.success(`PO ${po.documentNumber} created`)
      navigate(`/purchase/orders/${po.id}`)
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Create PO failed')
    } finally {
      setBusy(false)
    }
  }

  const primaryAction = (() => {
    if (!comparison) {
      return {
        id: 'build',
        label: building ? 'Building…' : 'Build Comparison',
        icon: RefreshCw,
        onClick: () => void runBuild(),
        disabled: building || busy,
      }
    }
    if (comparison.recommendationStatus === 'approved') {
      return {
        id: 'po',
        label: 'Create Purchase Order',
        icon: ShoppingCart,
        onClick: () => void onCreatePo(),
        hidden: !(perms.canConvertRfqToPo || perms.canCreateOrder),
        disabled: busy || reasonMissing,
      }
    }
    if (comparison.recommendationStatus === 'recommended') {
      return {
        id: 'approve',
        label: 'Approve Recommendation',
        icon: CheckCircle2,
        onClick: () => void onApprove(),
        hidden: !perms.canAwardRfq,
        disabled: busy || reasonMissing,
      }
    }
    return {
      id: 'recommend',
      label: 'Recommend Vendor',
      icon: ThumbsUp,
      onClick: () => void onRecommend(),
      hidden: !perms.canCompareQuotation,
      disabled: busy || reasonMissing,
    }
  })()

  if (loading) {
    return (
      <PurchaseCardFormShell
        title="Quotation Comparison"
        description="Loading…"
        status="—"
        favoritePath="/purchase/comparison"
        breadcrumbs={purchaseBreadcrumbs('Loading', {
          label: 'Comparison',
          to: '/purchase/comparison',
        })}
        backLink={{ to: '/purchase/comparison', label: 'Back to Comparison' }}
        footer={null}
        detailMode
      >
        <LoadingState variant="table" rows={8} cols={8} />
      </PurchaseCardFormShell>
    )
  }

  if (!rfq) {
    return (
      <PurchaseCardFormShell
        title="Quotation Comparison"
        description="RFQ not found"
        status="—"
        favoritePath="/purchase/comparison"
        breadcrumbs={purchaseBreadcrumbs('Not Found', {
          label: 'Comparison',
          to: '/purchase/comparison',
        })}
        backLink={{ to: '/purchase/comparison', label: 'Back to Comparison' }}
        footer={null}
        detailMode
      >
        <EmptyState icon={GitCompare} title="RFQ not found" />
      </PurchaseCardFormShell>
    )
  }

  const docNo = comparison?.documentNumber || rfq.documentNumber

  return (
    <PurchaseCardFormShell
      title={docNo}
      description="Side-by-side vendor quotation matrix"
      recordNo={docNo}
      status={statusLabel}
      statusTone={purchaseStatusTone(statusKey)}
      statusKey={statusKey}
      favoritePath={`/purchase/comparison/${rfq.id}`}
      breadcrumbs={purchaseBreadcrumbs(rfq.documentNumber, {
        label: 'Comparison',
        to: '/purchase/comparison',
      })}
      backLink={{ to: '/purchase/comparison', label: 'Back to Comparison' }}
      detailMode
      footer={null}
      documentStrip={[
        { label: 'RFQ', value: rfq.documentNumber, highlight: true },
        {
          label: 'Quotations',
          value: String(quotations.length),
        },
        {
          label: 'Vendors',
          value: String(vendorColumns.length || selectedVendorIds.length),
        },
        {
          label: 'Method',
          value: QUOTATION_COMPARISON_METHOD_LABELS[method],
        },
        {
          label: 'Lines',
          value: comparison ? String(comparison.rows.length) : '—',
        },
      ]}
      recordHeaderFacts={[
        { label: 'RFQ', value: rfq.documentNumber },
        { label: 'Quotes', value: String(quotations.length) },
        { label: 'Method', value: QUOTATION_COMPARISON_METHOD_LABELS[method] },
      ]}
      factBox={
        <PurchaseDocumentFactBox
          title="Smart context"
          vendor={
            comparison?.recommendedVendorId
              ? {
                  id: comparison.recommendedVendorId,
                  name:
                    comparison.recommendedVendorName ??
                    vendorMetas.find((v) => v.vendorId === comparison.recommendedVendorId)
                      ?.vendorName,
                  paymentTerms: rfq.paymentTerms,
                }
              : null
          }
          documentStatus={{
            statusLabel,
            createdBy: comparison?.createdBy || null,
            modifiedBy: comparison?.updatedBy ?? null,
          }}
          related={buildPurchaseRelatedLinks({
            rfqId: rfq.id,
            rfqNumber: rfq.documentNumber,
            comparisonId: comparison?.id,
            comparisonNumber: comparison?.documentNumber,
            vendorQuotationId: vendorMetas.find(
              (v) => v.vendorId === comparison?.recommendedVendorId,
            )?.quotationId,
            vendorQuotationNumber: vendorMetas.find(
              (v) => v.vendorId === comparison?.recommendedVendorId,
            )?.quotationNumber,
          })}
        />
      }
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={primaryAction}
          secondaryActions={[
            {
              id: 'build',
              label: building ? 'Building…' : 'Build / Refresh',
              icon: RefreshCw,
              onClick: () => void runBuild(),
              disabled: building || busy,
              hidden: !comparison,
            },
            {
              id: 'recommend',
              label: 'Recommend Vendor',
              icon: ThumbsUp,
              onClick: () => void onRecommend(),
              hidden:
                !perms.canCompareQuotation ||
                !comparison ||
                primaryAction.id === 'recommend',
              disabled: busy || reasonMissing,
            },
            {
              id: 'approve',
              label: 'Approve Recommendation',
              icon: CheckCircle2,
              onClick: () => void onApprove(),
              hidden:
                !perms.canAwardRfq ||
                !comparison ||
                primaryAction.id === 'approve' ||
                comparison.recommendationStatus === 'none',
              disabled: busy || reasonMissing,
            },
            {
              id: 'po',
              label: 'Create Purchase Order',
              icon: ShoppingCart,
              onClick: () => void onCreatePo(),
              hidden:
                !(perms.canConvertRfqToPo || perms.canCreateOrder) ||
                !comparison ||
                primaryAction.id === 'po',
              disabled: busy || reasonMissing,
            },
            {
              id: 'export',
              label: 'Export',
              icon: Download,
              onClick: () => {
                if (comparison) exportComparisonCsv(comparison, vendorColumns)
              },
              disabled: !comparison,
            },
            {
              id: 'print',
              label: 'Print',
              icon: Printer,
              onClick: () => window.print(),
              disabled: !comparison,
            },
          ]}
        />
      }
    >
      <div className="space-y-3">
        <ErpCardSection
          title="Comparison Setup"
          subtitle="Vendors, method, and criteria"
          icon={GitCompare}
          accent="blue"
          collapsible
          defaultOpen={!comparison}
          dense
          columns={1}
        >
          <ErpFormSpan span={3}>
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-erp-border pb-2 text-[13px]">
              <span className="text-erp-muted">RFQ</span>
              <Link
                to={`/purchase/rfqs/${rfq.id}`}
                className="font-mono font-semibold text-erp-primary hover:underline"
              >
                {rfq.documentNumber}
              </Link>
              <span className="text-erp-border">|</span>
              <span className="text-erp-muted">
                {quotations.length} quotation{quotations.length === 1 ? '' : 's'} on file
              </span>
            </div>
          </ErpFormSpan>

          <ErpFormSpan span={3}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                  Responding vendors
                </p>
                <div className="divide-y divide-erp-border rounded-md border border-erp-border bg-white">
                  {quotations.map((q) => {
                    const checked = selectedVendorIds.includes(q.vendor.id)
                    return (
                      <label
                        key={q.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-2.5 px-2.5 py-2 text-[12px] transition-colors',
                          checked ? 'bg-sky-50/60' : 'hover:bg-erp-surface-alt',
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onChange={() => toggleVendor(q.vendor.id)}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium text-erp-ink">
                          {q.vendor.name}
                        </span>
                        <Link
                          to={`/purchase/vendor-quotations/${q.id}`}
                          className="shrink-0 font-mono text-[11px] text-erp-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {q.documentNumber}
                        </Link>
                      </label>
                    )
                  })}
                  {quotations.length === 0 ? (
                    <p className="px-2.5 py-3 text-[13px] text-erp-muted">
                      No vendor quotations recorded yet.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                    Comparison method
                  </label>
                  <Select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as QuotationComparisonMethod)}
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {Object.entries(QUOTATION_COMPARISON_METHOD_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                    Selection mode
                  </label>
                  <Select
                    value={selectionMode}
                    onChange={(e) => setSelectionMode(e.target.value as QuotationSelectionMode)}
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    <option value="all_lines">One vendor for all lines</option>
                    <option value="per_line">Per-line vendor</option>
                  </Select>
                </div>
              </div>
            </div>
          </ErpFormSpan>

          <ErpFormSpan span={3}>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
              Criteria
            </p>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
              {ALL_CRITERIA.map((c) => {
                const on = criteria.includes(c)
                return (
                  <label
                    key={c}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded border px-2 py-1 text-[11px]',
                      on
                        ? 'border-erp-primary/40 bg-sky-50 text-erp-ink'
                        : 'border-erp-border text-erp-muted',
                    )}
                  >
                    <Checkbox checked={on} onChange={() => toggleCriterion(c)} />
                    <span className="truncate">{QUOTATION_COMPARISON_CRITERION_LABELS[c]}</span>
                  </label>
                )
              })}
            </div>
          </ErpFormSpan>
        </ErpCardSection>

        {comparison ? (
          <>
            <ErpCardSection
              title="Comparison Matrix"
              subtitle="Vendor quotes by item line"
              icon={GitCompare}
              accent="teal"
              collapsible
              defaultOpen
              dense
              columns={1}
            >
              {/* Vendor summary strip */}
              <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3 print:hidden">
                {vendorMetas.map((v) => {
                  const isBest = v.vendorId === lowestLandedVendorId
                  return (
                    <div
                      key={v.vendorId}
                      className={cn(
                        'rounded-md border bg-white px-3 py-2',
                        isBest
                          ? 'border-sky-300 ring-1 ring-sky-200'
                          : 'border-erp-border',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-erp-ink">
                            {v.vendorName}
                          </p>
                          {v.quotationId ? (
                            <Link
                              to={`/purchase/vendor-quotations/${v.quotationId}`}
                              className="font-mono text-[11px] text-erp-primary hover:underline"
                            >
                              {v.quotationNumber}
                            </Link>
                          ) : (
                            <span className="font-mono text-[11px] text-erp-muted">
                              {v.quotationNumber}
                            </span>
                          )}
                        </div>
                        {isBest ? (
                          <Badge color="blue" className="shrink-0 text-[10px]">
                            Lowest landed
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 border-t border-erp-border pt-2 text-[11px]">
                        <div>
                          <p className="text-erp-muted">Landed</p>
                          <p className="font-semibold tabular-nums text-erp-ink">
                            {formatCurrency(v.landedTotal)}
                          </p>
                        </div>
                        <div>
                          <p className="text-erp-muted">Basic</p>
                          <p className="tabular-nums text-erp-ink">
                            {formatCurrency(v.basicTotal)}
                          </p>
                        </div>
                        <div>
                          <p className="text-erp-muted">Lead</p>
                          <p className="tabular-nums text-erp-ink">
                            {v.bestLeadDays != null ? `${v.bestLeadDays}d` : '—'}
                          </p>
                        </div>
                      </div>
                      <p className="mt-1.5 text-[10px] text-erp-muted">
                        Wins: {v.lowestLandedWins} landed · {v.lowestBasicWins} basic
                      </p>
                    </div>
                  )
                })}
              </div>

              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-erp-muted print:hidden">
                <span className="font-semibold uppercase tracking-wide text-erp-muted">
                  Legend
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-200 ring-1 ring-emerald-300" />
                  Lowest basic
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-sky-200 ring-1 ring-sky-300" />
                  Lowest landed
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-200 ring-1 ring-amber-300" />
                  Best delivery
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-rose-200 ring-1 ring-rose-300" />
                  Non-compliant
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm ring-2 ring-erp-primary" />
                  Preferred
                </span>
              </div>

              <div className="overflow-x-auto rounded-md border border-erp-border bg-white">
                <table className="erp-table w-full min-w-[720px] text-[11px]">
                  <thead>
                    <tr className="bg-erp-surface-alt">
                      <th
                        rowSpan={2}
                        className="sticky left-0 z-20 min-w-[160px] border-r border-erp-border bg-erp-surface-alt"
                      >
                        Item
                      </th>
                      <th
                        rowSpan={2}
                        className="sticky left-[160px] z-20 border-r border-erp-border bg-erp-surface-alt num"
                      >
                        Qty
                      </th>
                      {vendorMetas.map((v) => (
                        <th
                          key={v.vendorId}
                          colSpan={4}
                          className={cn(
                            'border-l border-erp-border px-2 py-1.5 text-center',
                            v.vendorId === lowestLandedVendorId && 'bg-sky-50',
                          )}
                        >
                          <div className="truncate font-semibold text-erp-ink">
                            {v.vendorName}
                          </div>
                          <div className="font-mono text-[10px] font-normal text-erp-muted">
                            {v.quotationNumber} · {formatCurrency(v.landedTotal)}
                          </div>
                        </th>
                      ))}
                      {selectionMode === 'per_line' ? (
                        <th rowSpan={2} className="border-l border-erp-border">
                          Select
                        </th>
                      ) : null}
                    </tr>
                    <tr className="bg-erp-surface-alt">
                      {vendorMetas.flatMap((v) => [
                        <th
                          key={`${v.vendorId}-rate`}
                          className="border-l border-erp-border num font-medium text-erp-muted"
                        >
                          Basic
                        </th>,
                        <th
                          key={`${v.vendorId}-landed`}
                          className="num font-medium text-erp-muted"
                        >
                          Landed
                        </th>,
                        <th
                          key={`${v.vendorId}-lead`}
                          className="num font-medium text-erp-muted"
                        >
                          Lead
                        </th>,
                        <th
                          key={`${v.vendorId}-comp`}
                          className="font-medium text-erp-muted"
                        >
                          Compliance
                        </th>,
                      ])}
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.rows.map((row) => (
                      <tr key={row.itemId} className="hover:bg-erp-surface-alt/40">
                        <td className="sticky left-0 z-10 border-r border-erp-border bg-white">
                          <div className="font-mono text-[11px] font-medium">
                            {row.itemCode || '—'}
                          </div>
                          <div className="max-w-[200px] truncate text-erp-muted">
                            {row.itemName || 'Line item'}
                          </div>
                        </td>
                        <td className="sticky left-[160px] z-10 border-r border-erp-border bg-white num whitespace-nowrap">
                          {row.quantity} {row.uom}
                        </td>
                        {vendorMetas.map((v) => {
                          const q = row.quotes.find((x) => x.vendorId === v.vendorId)
                          return (
                            <Fragment key={`${row.itemId}-${v.vendorId}`}>
                              <td
                                className={cn(
                                  'border-l border-erp-border num',
                                  cellHighlightClass(q),
                                )}
                              >
                                {q ? formatCurrency(q.rate) : '—'}
                              </td>
                              <td className={cn('num', cellHighlightClass(q))}>
                                {q ? formatCurrency(q.landedRate) : '—'}
                              </td>
                              <td className={cn('num', cellHighlightClass(q))}>
                                {q ? `${q.leadTimeDays}d` : '—'}
                              </td>
                              <td className={cellHighlightClass(q)}>
                                {q ? complianceChip(q) : '—'}
                              </td>
                            </Fragment>
                          )
                        })}
                        {selectionMode === 'per_line' ? (
                          <td className="border-l border-erp-border">
                            <Select
                              value={lineSelections[row.itemId] ?? ''}
                              onChange={(e) =>
                                setLineSelections((prev) => ({
                                  ...prev,
                                  [row.itemId]: e.target.value,
                                }))
                              }
                            >
                              <option value="">{SELECT_PLACEHOLDER}</option>
                              {vendorMetas.map((v) => (
                                <option key={v.vendorId} value={v.vendorId}>
                                  {v.vendorName}
                                </option>
                              ))}
                            </Select>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ErpCardSection>

            <ErpCardSection
              title="Award Selection"
              subtitle="Vendor choice and audit reason"
              icon={ThumbsUp}
              accent="amber"
              collapsible
              defaultOpen
              dense
              columns={1}
            >
              {comparison.recommendationStatus !== 'none' ? (
                <div
                  className={cn(
                    'mb-3 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-[13px]',
                    comparison.recommendationStatus === 'approved'
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-amber-200 bg-amber-50',
                  )}
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-erp-ink" />
                  <span>
                    <strong>
                      {comparison.recommendationStatus === 'approved'
                        ? 'Awarded'
                        : 'Recommended'}
                      :
                    </strong>{' '}
                    {comparison.recommendedVendorName ??
                      vendorMetas.find((v) => v.vendorId === comparison.recommendedVendorId)
                        ?.vendorName ??
                      '—'}
                    {approvedByLabel ? ` · Approved by ${approvedByLabel}` : ''}
                  </span>
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] print:hidden">
                {selectionMode === 'all_lines' ? (
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                      Selected vendor (all lines)
                    </label>
                    <Select
                      value={allLinesVendorId}
                      onChange={(e) => setAllLinesVendorId(e.target.value)}
                    >
                      <option value="">{SELECT_PLACEHOLDER}</option>
                      {vendorMetas.map((v) => {
                        const isLowest = lowestLandedVendorIds(comparison).has(v.vendorId)
                        return (
                          <option key={v.vendorId} value={v.vendorId}>
                            {v.vendorName}
                            {isLowest ? ' (lowest landed)' : ''}
                          </option>
                        )
                      })}
                    </Select>
                  </div>
                ) : (
                  <div className="rounded-md border border-erp-border bg-erp-surface-alt px-3 py-2 text-[12px] text-erp-muted">
                    <FileText className="mb-1 inline h-3.5 w-3.5" /> Per-line vendor is chosen in
                    the matrix Select column.
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                    Selection reason
                    {needsReason ? ' (required)' : ' (optional)'}
                  </label>
                  <Textarea
                    rows={3}
                    value={selectionReason}
                    onChange={(e) => setSelectionReason(e.target.value)}
                    placeholder={
                      needsReason
                        ? 'Explain why the selected vendor is not the lowest landed cost…'
                        : 'Optional notes for audit trail'
                    }
                    className={reasonMissing ? 'border-rose-400' : undefined}
                  />
                  {reasonMissing ? (
                    <p className="mt-1 text-[12px] text-rose-600">
                      Required when selected vendor(s) are not the lowest landed-cost option.
                    </p>
                  ) : null}
                </div>
              </div>
            </ErpCardSection>
          </>
        ) : (
          <EmptyState
            icon={GitCompare}
            title="No comparison built yet"
            description="Select vendors and criteria, then build the matrix."
            action={
              <ErpButton onClick={() => void runBuild()} disabled={building}>
                Build Comparison
              </ErpButton>
            }
          />
        )}
      </div>
    </PurchaseCardFormShell>
  )
}
