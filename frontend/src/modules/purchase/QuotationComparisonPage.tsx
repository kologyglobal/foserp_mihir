import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CheckCircle2,
  Download,
  GitCompare,
  Printer,
  RefreshCw,
  ShoppingCart,
  ThumbsUp,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { Checkbox, Select, Textarea } from '@/components/forms/Inputs'
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
import { cn } from '@/utils/cn'

const ALL_CRITERIA = Object.keys(
  QUOTATION_COMPARISON_CRITERION_LABELS,
) as QuotationComparisonCriterion[]

function cellHighlightClass(q: QuotationComparisonQuoteCell | undefined): string {
  if (!q) return 'bg-stripes-missing bg-erp-surface-alt text-erp-muted'
  const parts: string[] = []
  if (q.hasMissingValues) parts.push('bg-stripes-missing bg-erp-surface-alt')
  if (q.isLowestBasic) parts.push('bg-emerald-50')
  if (q.isLowestLanded) parts.push('bg-blue-50')
  if (q.isBestDelivery) parts.push('bg-amber-50')
  if (q.isNonCompliant) parts.push('bg-rose-50')
  if (q.isPreferred) parts.push('ring-2 ring-inset ring-violet-400')
  return parts.join(' ') || ''
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
    const lowest = row.quotes.filter((q) => q.isLowestLanded)
    lowest.forEach((q) => ids.add(q.vendorId))
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
        setComparison(existing)
        setSelectedVendorIds(existing.selectedVendorIds)
        setMethod(existing.method)
        setCriteria(existing.criteria)
        setSelectionMode(existing.selectionMode)
        setSelectionReason(existing.selectionReason)
        if (existing.selectionMode === 'all_lines' && existing.selectedVendorIds[0]) {
          setAllLinesVendorId(existing.recommendedVendorId ?? existing.selectedVendorIds[0] ?? '')
        }
        const perLine: Record<string, string> = {}
        for (const row of existing.rows) {
          if (row.selectedVendorId) perLine[row.itemId] = row.selectedVendorId
        }
        setLineSelections(perLine)
      } else {
        setSelectedVendorIds(quotes.map((q) => q.vendor.id))
      }
    } finally {
      setLoading(false)
    }
  }, [rfqId, navigate])

  useEffect(() => {
    void load()
  }, [load])

  const vendorColumns = useMemo(() => {
    if (!comparison) return selectedVendorIds
    return selectedVendorIds.filter((id) =>
      comparison.rows.some((r) => r.quotes.some((q) => q.vendorId === id)),
    )
  }, [comparison, selectedVendorIds])

  const needsReason = useMemo(() => {
    if (!comparison) return false
    return selectionNeedsReason(comparison, selectionMode, allLinesVendorId, lineSelections)
  }, [comparison, selectionMode, allLinesVendorId, lineSelections])

  const reasonMissing = needsReason && !selectionReason.trim()

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
      setComparison(built)
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
      setComparison(updated)
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
      setComparison(updated)
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
      const updated = await approveQuotationRecommendation(comparison.id)
      setComparison(updated)
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

  if (loading) {
    return (
      <OperationalPageShell
        title="Quotation Comparison"
        variant="dynamics"
        breadcrumbs={purchaseBreadcrumbs('Comparison')}
      >
        <LoadingState variant="table" rows={8} />
      </OperationalPageShell>
    )
  }

  if (!rfq) {
    return (
      <OperationalPageShell
        title="Quotation Comparison"
        variant="dynamics"
        breadcrumbs={purchaseBreadcrumbs('Not Found')}
      >
        <EmptyState icon={GitCompare} title="RFQ not found" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title={`Compare · ${rfq.documentNumber}`}
      description="Side-by-side vendor quotation matrix"
      badge="Purchase"
      variant="dynamics"
      breadcrumbs={purchaseBreadcrumbs(rfq.documentNumber, {
        label: 'Comparison',
        to: '/purchase/comparison',
      })}
      favoritePath={`/purchase/comparison/${rfq.id}`}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'build',
            label: building ? 'Building…' : 'Build / Refresh',
            icon: RefreshCw,
            onClick: () => void runBuild(),
            disabled: building || busy,
          }}
          secondaryActions={[
            {
              id: 'recommend',
              label: 'Recommend Vendor',
              icon: ThumbsUp,
              onClick: () => void onRecommend(),
              hidden: !perms.canCompareQuotation,
              disabled: !comparison || busy || reasonMissing,
            },
            {
              id: 'approve',
              label: 'Approve Recommendation',
              icon: CheckCircle2,
              onClick: () => void onApprove(),
              hidden: !perms.canCompareQuotation,
              disabled: !comparison || busy || reasonMissing,
            },
            {
              id: 'po',
              label: 'Create Purchase Order',
              icon: ShoppingCart,
              onClick: () => void onCreatePo(),
              hidden: !perms.canCreateOrder,
              disabled: !comparison || busy || reasonMissing,
            },
            {
              id: 'export',
              label: 'Export Comparison',
              icon: Download,
              onClick: () => {
                if (comparison) exportComparisonCsv(comparison, vendorColumns)
              },
              disabled: !comparison,
            },
            {
              id: 'print',
              label: 'Print Comparison',
              icon: Printer,
              onClick: () => window.print(),
              disabled: !comparison,
            },
          ]}
        />
      }
    >
      <div className="mb-4 rounded-md border border-erp-border bg-white p-4 print:hidden">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-erp-muted">RFQ:</span>
          <Link to={`/purchase/rfqs/${rfq.id}`} className="font-mono font-medium text-erp-primary">
            {rfq.documentNumber}
          </Link>
          <span className="text-erp-muted">· {quotations.length} quotation(s) on file</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-[12px] font-semibold uppercase text-erp-muted">Responding vendors</p>
            <div className="flex flex-wrap gap-2">
              {quotations.map((q) => (
                <label
                  key={q.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-erp-border px-2 py-1 text-[12px]"
                >
                  <Checkbox
                    checked={selectedVendorIds.includes(q.vendor.id)}
                    onChange={() => toggleVendor(q.vendor.id)}
                  />
                  <span>{q.vendor.name}</span>
                  <span className="font-mono text-erp-muted">{q.documentNumber}</span>
                </label>
              ))}
              {quotations.length === 0 ? (
                <p className="text-[13px] text-erp-muted">No vendor quotations recorded yet.</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[12px] font-semibold uppercase text-erp-muted">
                Comparison method
              </label>
              <Select
                value={method}
                onChange={(e) => setMethod(e.target.value as QuotationComparisonMethod)}
              >
                {Object.entries(QUOTATION_COMPARISON_METHOD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold uppercase text-erp-muted">
                Selection mode
              </label>
              <Select
                value={selectionMode}
                onChange={(e) => setSelectionMode(e.target.value as QuotationSelectionMode)}
              >
                <option value="all_lines">One vendor for all lines</option>
                <option value="per_line">Per-line vendor</option>
              </Select>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <p className="mb-2 text-[12px] font-semibold uppercase text-erp-muted">Criteria toggles</p>
          <div className="flex flex-wrap gap-2">
            {ALL_CRITERIA.map((c) => (
              <label
                key={c}
                className={cn(
                  'cursor-pointer rounded-full border px-2 py-0.5 text-[11px]',
                  criteria.includes(c)
                    ? 'border-erp-primary bg-erp-primary/10 text-erp-primary'
                    : 'border-erp-border text-erp-muted',
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={criteria.includes(c)}
                  onChange={() => toggleCriterion(c)}
                />
                {QUOTATION_COMPARISON_CRITERION_LABELS[c]}
              </label>
            ))}
          </div>
        </div>
      </div>

      {comparison ? (
        <>
          <div className="mb-3 flex flex-wrap gap-3 text-[11px] print:hidden">
            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1">
              <span className="h-2 w-2 rounded bg-emerald-400" /> Lowest basic
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1">
              <span className="h-2 w-2 rounded bg-blue-400" /> Lowest landed
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1">
              <span className="h-2 w-2 rounded bg-amber-400" /> Best delivery
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-1">
              <span className="h-2 w-2 rounded bg-rose-400" /> Non-compliant
            </span>
            <span className="inline-flex items-center gap-1 rounded px-2 py-1 ring-2 ring-violet-400">
              Preferred vendor
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-erp-surface-alt px-2 py-1 bg-stripes-missing">
              Missing values
            </span>
          </div>

          <div className="overflow-x-auto rounded-md border border-erp-border bg-white">
            <table className="erp-table text-[11px]">
              <thead>
                <tr>
                  <th rowSpan={2}>Item</th>
                  <th rowSpan={2} className="num">
                    Qty
                  </th>
                  {vendorColumns.map((vid) => {
                    const label =
                      comparison.rows[0]?.quotes.find((q) => q.vendorId === vid)?.vendorName ?? vid
                    return (
                      <th key={vid} colSpan={4} className="text-center">
                        {label}
                      </th>
                    )
                  })}
                  {selectionMode === 'per_line' ? <th rowSpan={2}>Select</th> : null}
                </tr>
                <tr>
                  {vendorColumns.flatMap((vid) => [
                    <th key={`${vid}-rate`} className="num">
                      Basic
                    </th>,
                    <th key={`${vid}-landed`} className="num">
                      Landed
                    </th>,
                    <th key={`${vid}-lead`} className="num">
                      Lead
                    </th>,
                    <th key={`${vid}-comp`}>Compliance</th>,
                  ])}
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row) => (
                  <tr key={row.itemId}>
                    <td>
                      <div className="font-mono">{row.itemCode}</div>
                      <div className="text-erp-muted">{row.itemName}</div>
                    </td>
                    <td className="num">
                      {row.quantity} {row.uom}
                    </td>
                    {vendorColumns.map((vid) => {
                      const q = row.quotes.find((x) => x.vendorId === vid)
                      return (
                        <Fragment key={`${row.itemId}-${vid}`}>
                          <td className={cn('num', cellHighlightClass(q))}>
                            {q ? formatCurrency(q.rate) : '—'}
                          </td>
                          <td className={cn('num font-medium', cellHighlightClass(q))}>
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
                      <td>
                        <Select
                          value={lineSelections[row.itemId] ?? ''}
                          onChange={(e) =>
                            setLineSelections((prev) => ({
                              ...prev,
                              [row.itemId]: e.target.value,
                            }))
                          }
                        >
                          <option value="">—</option>
                          {vendorColumns.map((vid) => {
                            const name =
                              row.quotes.find((q) => q.vendorId === vid)?.vendorName ?? vid
                            return (
                              <option key={vid} value={vid}>
                                {name}
                              </option>
                            )
                          })}
                        </Select>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2 print:hidden">
            {selectionMode === 'all_lines' ? (
              <div>
                <label className="mb-1 block text-[12px] font-semibold uppercase text-erp-muted">
                  Selected vendor (all lines)
                </label>
                <Select
                  value={allLinesVendorId}
                  onChange={(e) => setAllLinesVendorId(e.target.value)}
                >
                  <option value="">—</option>
                  {vendorColumns.map((vid) => {
                    const name =
                      comparison.rows[0]?.quotes.find((q) => q.vendorId === vid)?.vendorName ?? vid
                    const isLowest = lowestLandedVendorIds(comparison).has(vid)
                    return (
                      <option key={vid} value={vid}>
                        {name}
                        {isLowest ? ' (lowest landed)' : ''}
                      </option>
                    )
                  })}
                </Select>
              </div>
            ) : null}

            <div className={selectionMode === 'all_lines' ? '' : 'lg:col-span-2'}>
              <label className="mb-1 block text-[12px] font-semibold uppercase text-erp-muted">
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

          {comparison.recommendationStatus !== 'none' ? (
            <div className="mt-4 rounded-md border border-erp-border bg-erp-surface-alt p-3 text-[13px]">
              <strong>Recommendation:</strong>{' '}
              {comparison.recommendedVendorName ?? comparison.recommendedVendorId ?? '—'} ·{' '}
              {comparison.recommendationStatus}
              {comparison.approvedBy ? ` · Approved by ${comparison.approvedBy}` : ''}
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon={GitCompare}
          title="No comparison built yet"
          description="Select vendors and criteria, then click Build / Refresh."
          action={
            <ErpButton onClick={() => void runBuild()} disabled={building}>
              Build Comparison
            </ErpButton>
          }
        />
      )}

      <style>{`
        .bg-stripes-missing {
          background-image: repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 4px,
            rgba(148, 163, 184, 0.15) 4px,
            rgba(148, 163, 184, 0.15) 8px
          );
        }
      `}</style>
    </OperationalPageShell>
  )
}
