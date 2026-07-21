import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  ChevronDown,
  ClipboardList,
  FileText,
  GitCompare,
  Package,
  Pencil,
  Printer,
  Send,
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
import { ErpCardSection, ErpViewField } from '@/components/erp/card-form'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Badge } from '@/components/ui/Badge'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getVendorQuotationById,
  PurchaseServiceError,
  submitVendorQuotation,
} from '@/services/purchase'
import {
  QUOTATION_COMPLIANCE_STATUS_LABELS,
  VENDOR_QUOTATION_DOMAIN_STATUS_LABELS,
  type QuotationComplianceStatus,
  type VendorQuotation,
  type VendorQuotationLine,
} from '@/types/purchaseDomain'
import {
  commercialTermsSummary,
  taxTotalsSummary,
} from '@/modules/purchase/purchaseFastTabSummaries'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

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

function LineExpandRow({ line }: { line: VendorQuotationLine }) {
  const [open, setOpen] = useState(false)
  const amount =
    Math.abs(line.landedCost - line.lineTotal) < 0.01 ? line.lineTotal : line.landedCost
  return (
    <>
      <tr className={cn(open && 'bg-erp-primary-soft/20')}>
        <td className="sticky left-0 z-[1] bg-inherit font-mono text-erp-muted">{line.lineNo}</td>
        <td className="font-mono">{line.itemCode}</td>
        <td className="max-w-[14rem]">
          <p className="truncate font-medium text-erp-text" title={line.itemName}>
            {line.itemName}
          </p>
          {line.description ? (
            <p className="truncate text-[11px] text-erp-muted" title={line.description}>
              {line.description}
            </p>
          ) : null}
        </td>
        <td className="num tabular-nums">{line.quantity}</td>
        <td>{line.uom}</td>
        <td className="num tabular-nums">{formatCurrency(line.rate)}</td>
        <td className="num tabular-nums">{line.discountPct}%</td>
        <td className="num tabular-nums">{line.gstRatePct}%</td>
        <td className="num tabular-nums font-medium text-erp-primary">
          {formatCurrency(amount)}
        </td>
        <td>{complianceBadge(line.technicalCompliance)}</td>
        <td>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-erp-primary hover:underline"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            Details
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="bg-erp-surface-alt/80">
          <td colSpan={11} className="px-3 py-2.5">
            <div className="grid gap-x-4 gap-y-2 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">HSN</p>
                <p className="font-mono">{line.hsnCode || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Line total
                </p>
                <p className="tabular-nums">{formatCurrency(line.lineTotal)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Landed cost
                </p>
                <p className="tabular-nums">{formatCurrency(line.landedCost)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Disc amt
                </p>
                <p className="tabular-nums">{formatCurrency(line.discountAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Tax amt</p>
                <p className="tabular-nums">{formatCurrency(line.taxAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Taxable
                </p>
                <p className="tabular-nums">{formatCurrency(line.taxableAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Freight alloc
                </p>
                <p className="tabular-nums">{formatCurrency(line.freightAllocation)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Other</p>
                <p className="tabular-nums">{formatCurrency(line.otherCharges)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Lead time
                </p>
                <p>{line.leadTimeDays} days</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Promised
                </p>
                <p>
                  {line.promisedDeliveryDate ? formatDate(line.promisedDeliveryDate) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Commercial
                </p>
                <div className="mt-0.5">{complianceBadge(line.commercialCompliance)}</div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Make / brand
                </p>
                <p>{line.makeBrand || '—'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  Remarks
                </p>
                <p>{line.remarks || '—'}</p>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

export function VendorQuotationDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [quote, setQuote] = useState<VendorQuotation | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const row = await getVendorQuotationById(id)
      if (!row) {
        notify.error('Vendor quotation not found')
        navigate('/purchase/vendor-quotations')
        return
      }
      setQuote(row)
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (searchParams.get('print') === '1') {
      window.print()
      searchParams.delete('print')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const isInterstate = quote?.vendor.isInterstate ?? quote?.gstScheme === 'igst'
  const showIgst = Boolean(isInterstate || (quote && quote.igst > 0 && quote.cgst === 0))
  const commercialPeek = quote
    ? commercialTermsSummary({
        expectedDelivery: quote.expectedDeliveryDate,
        paymentTerms: quote.paymentTerms,
        freightTerms: quote.freightTerms,
        deliveryTerms: quote.deliveryTerms,
        validityDate: quote.validTill,
      })
    : ''
  const taxPeek = quote
    ? taxTotalsSummary({
        subtotal: quote.subtotal,
        tax: quote.cgst + quote.sgst + quote.igst,
        total: quote.totalAmount,
      })
    : ''

  const submit = async () => {
    if (!quote || submitting) return
    setSubmitting(true)
    try {
      const submitted = await submitVendorQuotation(quote.id)
      setQuote(submitted)
      notify.success(`${submitted.documentNumber} submitted`)
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  const headerFacts = useMemo(() => {
    if (!quote) return []
    return [
      { label: 'Vendor', value: quote.vendor.name },
      { label: 'RFQ', value: quote.rfqNumber },
      { label: 'Valid until', value: formatDate(quote.validTill) },
      { label: 'Total', value: formatCurrency(quote.totalAmount) },
    ]
  }, [quote])

  if (loading || !quote) {
    return (
      <PurchaseCardFormShell
        title="Vendor Quotation"
        description="Loading…"
        status="…"
        favoritePath="/purchase/vendor-quotations"
        breadcrumbs={[
          { label: 'Purchase', to: '/purchase' },
          { label: 'Vendor Quotations', to: '/purchase/vendor-quotations' },
          { label: 'Loading' },
        ]}
        footer={null}
        detailMode
      >
        <LoadingState variant="form" rows={8} />
      </PurchaseCardFormShell>
    )
  }

  const isDraft = quote.status === 'draft'
  const statusLabel = VENDOR_QUOTATION_DOMAIN_STATUS_LABELS[quote.status]

  const documentFactBox = (
    <PurchaseDocumentFactBox
      vendor={{
        id: quote.vendor.id,
        code: quote.vendor.code,
        name: quote.vendor.name,
        paymentTerms: quote.paymentTerms,
      }}
      purchaseHistory={{
        lastPurchasePrice: quote.lines[0]?.rate ?? null,
        lastVendorName: quote.vendor.name,
        averageLeadTimeDays: quote.lines[0]?.leadTimeDays ?? null,
      }}
      documentStatus={{
        statusLabel,
        ...purchaseDocumentApprovalFact(quote.status),
        createdBy: quote.createdBy,
        modifiedBy: quote.updatedBy,
        modifiedDate: quote.updatedAt ? formatDate(quote.updatedAt.slice(0, 10)) : null,
      }}
      related={buildPurchaseRelatedLinks({
        rfqId: quote.rfqId,
        rfqNumber: quote.rfqNumber,
      })}
    />
  )

  return (
    <PurchaseCardFormShell
      title={quote.documentNumber}
      description="Vendor quotation"
      recordNo={quote.documentNumber}
      status={statusLabel}
      statusTone={purchaseStatusTone(quote.status)}
      company={quote.vendor.name}
      favoritePath={`/purchase/vendor-quotations/${quote.id}`}
      breadcrumbs={[
        { label: 'Purchase', to: '/purchase' },
        { label: 'Vendor Quotations', to: '/purchase/vendor-quotations' },
        { label: quote.documentNumber },
      ]}
      createdBy={quote.createdBy}
      createdDate={formatDate(quote.createdAt.slice(0, 10))}
      modifiedBy={quote.updatedBy || undefined}
      modifiedDate={quote.updatedAt ? formatDate(quote.updatedAt.slice(0, 10)) : undefined}
      recordHeaderFacts={headerFacts}
      factBox={documentFactBox}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            isDraft
              ? {
                  id: 'submit',
                  label: submitting ? 'Submitting…' : 'Submit',
                  icon: Send,
                  onClick: () => void submit(),
                  disabled: submitting,
                }
              : undefined
          }
          secondaryActions={[
            {
              id: 'compare',
              label: 'Open Comparison',
              icon: GitCompare,
              onClick: () => navigate(`/purchase/comparison/${quote.rfqId}`),
            },
            {
              id: 'print',
              label: 'Print',
              icon: Printer,
              onClick: () => window.print(),
            },
            ...(isDraft
              ? [
                  {
                    id: 'edit',
                    label: 'Edit',
                    icon: Pencil,
                    onClick: () => navigate(`/purchase/vendor-quotations/${quote.id}/edit`),
                  },
                ]
              : []),
          ]}
        />
      }
      footer={null}
      detailMode
    >
      <ErpCardSection
        title="Document"
        subtitle="Dates, RFQ link, and vendor identifiers"
        icon={ClipboardList}
        accent="blue"
        collapsible
        defaultOpen
        dense
      >
        <ErpViewField label="Quotation Date" value={formatDate(quote.documentDate)} />
        <ErpViewField label="Valid Until" value={formatDate(quote.validTill)} />
        <ErpViewField label="RFQ">
          <Link to={`/purchase/rfqs/${quote.rfqId}`} className="font-mono text-erp-primary">
            {quote.rfqNumber}
          </Link>
        </ErpViewField>
        <ErpViewField label="Vendor Code" value={quote.vendor.code} />
        <ErpViewField label="Vendor GSTIN" value={quote.vendor.gstin || '—'} />
        <ErpViewField label="Vendor Reference" value={quote.vendorReferenceNumber || '—'} />
        <ErpViewField label="Currency" value={quote.currency} />
        <ErpViewField
          label="GST Scheme"
          value={quote.gstScheme === 'igst' ? 'IGST (interstate)' : 'CGST + SGST'}
        />
      </ErpCardSection>

      <ErpCardSection
        title="Commercial Terms"
        subtitle="Payment, delivery, and warranty"
        icon={Truck}
        accent="amber"
        collapsible
        defaultOpen={false}
        dense
        collapsedSummary={commercialPeek || undefined}
      >
        <ErpViewField label="Payment Terms" value={quote.paymentTerms} />
        <ErpViewField label="Delivery Terms" value={quote.deliveryTerms} />
        <ErpViewField label="Freight Terms" value={quote.freightTerms || '—'} />
        <ErpViewField label="Warranty" value={quote.warranty || '—'} />
        <ErpViewField
          label="Expected Delivery"
          value={
            quote.expectedDeliveryDate ? formatDate(quote.expectedDeliveryDate) : '—'
          }
        />
        {quote.remarks ? (
          <ErpViewField label="Remarks" value={quote.remarks} colSpan={3} />
        ) : null}
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
            {quote.lines.length} line{quote.lines.length === 1 ? '' : 's'}
          </span>
        }
      >
        {quote.lines.length === 0 ? (
          <p className="rounded border border-dashed border-erp-border bg-erp-surface-alt/50 px-3 py-3 text-[12px] text-erp-muted">
            No line items on this quotation.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-erp-border">
            <table className="erp-table text-[12px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-[1] bg-erp-surface-alt">#</th>
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
                {quote.lines.map((line) => (
                  <LineExpandRow key={line.id} line={line} />
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-erp-surface-alt font-medium">
                  <td colSpan={3} className="sticky left-0 z-[1] bg-erp-surface-alt text-erp-muted">
                    Totals
                  </td>
                  <td className="num tabular-nums">
                    {quote.lines.reduce((s, l) => s + l.quantity, 0)}
                  </td>
                  <td colSpan={4} />
                  <td className="num tabular-nums text-erp-primary">
                    {formatCurrency(quote.totalAmount)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </ErpCardSection>

      <ErpCardSection
        title="Tax & Totals"
        subtitle="Charges and quotation total"
        icon={Banknote}
        accent="amber"
        collapsible
        defaultOpen
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
              value: formatCurrency(quote.subtotal),
            },
            {
              id: 'discount',
              label: 'Discount',
              kind: 'value',
              value: formatCurrency(quote.discount),
            },
            {
              id: 'freight',
              label: 'Freight',
              kind: 'value',
              value: formatCurrency(quote.freight),
            },
            {
              id: 'packing',
              label: 'Packing Charges',
              kind: 'value',
              value: formatCurrency(quote.packingCharges ?? 0),
            },
            {
              id: 'other',
              label: 'Other Charges',
              kind: 'value',
              value: formatCurrency(quote.otherCharges),
            },
          ]}
          calcRows={[
            {
              id: 'taxable',
              label: 'Taxable Amount',
              value: formatCurrency(quote.taxableAmount),
            },
            {
              id: 'cgst',
              label: 'CGST',
              value: formatCurrency(quote.cgst),
              hidden: showIgst,
            },
            {
              id: 'sgst',
              label: 'SGST',
              value: formatCurrency(quote.sgst),
              hidden: showIgst,
            },
            {
              id: 'igst',
              label: 'IGST',
              value: formatCurrency(quote.igst),
              hidden: !showIgst,
            },
            {
              id: 'round',
              label: 'Round Off',
              value: formatCurrency(quote.roundOff),
            },
          ]}
          grandTotalLabel="Quotation Total"
          grandTotalValue={formatCurrency(quote.totalAmount)}
        />
      </ErpCardSection>

      {quote.remarks ? (
        <ErpCardSection
          title="Remarks"
          icon={FileText}
          accent="slate"
          collapsible
          defaultOpen={false}
          dense
          columns={1}
          collapsedSummary={
            quote.remarks.length > 72 ? `${quote.remarks.slice(0, 72)}…` : quote.remarks
          }
        >
          <p className="text-[13px] text-erp-text whitespace-pre-wrap">{quote.remarks}</p>
        </ErpCardSection>
      ) : null}
    </PurchaseCardFormShell>
  )
}
