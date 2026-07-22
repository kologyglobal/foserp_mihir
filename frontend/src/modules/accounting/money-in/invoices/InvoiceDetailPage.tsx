import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  cancelSalesInvoice,
  getSalesInvoice,
  markSalesInvoiceReady,
  postSalesInvoice,
  reverseSalesInvoice,
  validateSalesInvoice,
} from '@/services/bridges/receivablesApiBridge'
import type { SalesInvoiceDto, SalesInvoiceValidationPreview } from '@/types/moneyIn'
import { formatCurrency } from '@/utils/formatters/currency'
import { mergeAllowedAction, useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import {
  MasterRefreshModal,
  PartyMasterCard,
  SourceDocumentCard,
  sourceTypeLabel,
} from '@/modules/accounting/shared/invoices'
import { invoiceDisplayNumber, moneyInStatusTone, MONEY_IN_STATUS_LABELS, parseDecimal, resolveSettlementStatus, SETTLEMENT_STATUS_LABELS, settlementStatusTone } from '../moneyInUi'
import { PostConfirmModal } from '../components/PostConfirmModal'
import { TotalsPanel } from '../components/TotalsPanel'
import { ValidationDrawer } from '../components/ValidationDrawer'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

/** Bordered card with a titled header band — document view chrome. */
function DetailSection({
  title,
  subtitle,
  children,
  className,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-md border border-erp-border bg-white ${className ?? ''}`}>
      <header className="border-b border-erp-border bg-erp-surface-alt/60 px-4 py-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-erp-text">{title}</h3>
        {subtitle && <p className="text-[11px] text-erp-muted">{subtitle}</p>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

function InfoField({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-erp-muted">{label}</dt>
      <dd className={`mt-0.5 text-[13px] text-erp-text ${mono ? 'tabular-nums' : ''}`}>{value ?? '—'}</dd>
    </div>
  )
}

/** Best-effort renderer for the persisted address snapshot JSON. */
function snapshotAddressLines(snapshot: Record<string, unknown> | null): string[] {
  if (!snapshot) return []
  const pick = (...keys: string[]) =>
    keys
      .map((k) => snapshot[k])
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  const line1 = pick('addressLine1', 'address1', 'line1', 'address')
  const line2 = pick('addressLine2', 'address2', 'line2')
  const cityState = pick('city', 'state')
  const pinCountry = pick('pincode', 'postalCode', 'country')
  return [line1.join(', '), line2.join(', '), [...cityState, ...pinCountry].join(', ')].filter(Boolean)
}

function lineTaxAmount(l: { cgstAmount: string; sgstAmount: string; igstAmount: string; cessAmount: string }) {
  return (
    parseDecimal(l.cgstAmount) + parseDecimal(l.sgstAmount) + parseDecimal(l.igstAmount) + parseDecimal(l.cessAmount)
  )
}

export function InvoiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useMoneyInPermissions()
  const [invoice, setInvoice] = useState<SalesInvoiceDto | null>(null)
  const [report, setReport] = useState<SalesInvoiceValidationPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [showValidate, setShowValidate] = useState(false)
  const [showPost, setShowPost] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showReverse, setShowReverse] = useState(false)
  const [reverseReason, setReverseReason] = useState('')
  const [showMasterRefresh, setShowMasterRefresh] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      setInvoice(await getSalesInvoice(id))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load invoice')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (perms.canViewInvoice) void load()
  }, [load, perms.canViewInvoice])

  const runValidate = async () => {
    if (!id) return
    try {
      const r = await validateSalesInvoice(id)
      setReport(r)
      setShowValidate(true)
      if (r.valid) notify.success('Validation passed')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Validation failed')
    }
  }

  const runMarkReady = async () => {
    if (!id) return
    setActing(true)
    try {
      const updated = await markSalesInvoiceReady(id)
      setInvoice(updated)
      notify.success('Marked ready to post')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Mark ready failed')
    } finally {
      setActing(false)
    }
  }

  const runPost = async () => {
    if (!id) return
    setActing(true)
    try {
      const result = await postSalesInvoice(id)
      setInvoice(result.invoice)
      setShowPost(false)
      notify.success(result.idempotentReplay ? 'Post replayed (idempotent)' : 'Invoice posted')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Post failed')
    } finally {
      setActing(false)
    }
  }

  const runCancel = async () => {
    if (!id || !cancelReason.trim()) {
      notify.error('Cancellation reason is required')
      return
    }
    setActing(true)
    try {
      const updated = await cancelSalesInvoice(id, cancelReason.trim())
      setInvoice(updated)
      setShowCancel(false)
      notify.success('Invoice cancelled')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Cancel failed')
    } finally {
      setActing(false)
    }
  }

  const runReverse = async () => {
    if (!id || !reverseReason.trim()) {
      notify.error('Reversal reason is required')
      return
    }
    setActing(true)
    try {
      const result = await reverseSalesInvoice(id, reverseReason.trim(), crypto.randomUUID())
      setInvoice(result.invoice)
      setShowReverse(false)
      setReverseReason('')
      notify.success(result.idempotentReplay ? 'Reversal replayed (idempotent)' : 'Sales invoice reversed')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Reverse failed')
    } finally {
      setActing(false)
    }
  }

  if (!perms.canViewInvoice) {
    return (
      <MoneyInWorkspaceShell title="Invoice">
        <p className="text-[13px] text-erp-muted">You do not have permission to view invoices.</p>
      </MoneyInWorkspaceShell>
    )
  }

  const settlement = invoice ? resolveSettlementStatus(invoice) : null

  if (loading || !invoice) {
    return (
      <MoneyInWorkspaceShell title="Invoice">
        <LoadingState variant="card" />
      </MoneyInWorkspaceShell>
    )
  }

  const actions = invoice.allowedActions
  const statusBanner =
    invoice.status === 'POSTED'
      ? actions?.reverse === false && perms.canReverseInvoice
        ? 'Posted to GL — reverse posted receipt/credit-note allocations first, then use Reverse Document.'
        : 'Posted to GL — read-only. View accounting voucher from actions.'
      : invoice.status === 'READY_TO_POST'
        ? 'Ready to post — validate then post when period is open.'
        : invoice.status === 'REVERSED'
          ? 'Reversed — a reversing voucher was posted and the invoice debit was closed. Read-only.'
          : invoice.status === 'CANCELLED'
            ? 'Cancelled — read-only.'
            : null

  return (
    <MoneyInWorkspaceShell
      title={invoiceDisplayNumber(invoice)}
      actions={
        <div className="flex flex-wrap gap-2">
          {mergeAllowedAction(perms.canEditInvoice, actions?.edit) && (
            <ErpButton variant="secondary" icon={Pencil} onClick={() => navigate(`/accounting/money-in/invoices/${id}/edit`)}>
              Edit
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canViewInvoice, actions?.validate) && (
            <ErpButton variant="secondary" onClick={() => void runValidate()}>
              Validate
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canEditInvoice, actions?.markReady) && (
            <ErpButton variant="secondary" onClick={() => void runMarkReady()} disabled={acting}>
              Mark Ready
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canPostInvoice, actions?.post) && (
            <ErpButton variant="primary" onClick={() => setShowPost(true)} disabled={acting}>
              Post
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canCancelInvoice, actions?.cancel) && (
            <ErpButton variant="ghost" onClick={() => setShowCancel(true)}>
              Cancel
            </ErpButton>
          )}
          {mergeAllowedAction(perms.canReverseInvoice, actions?.reverse) && (
            <ErpButton variant="ghost" onClick={() => setShowReverse(true)} disabled={acting}>
              Reverse Document
            </ErpButton>
          )}
          {(invoice.status === 'POSTED' || invoice.status === 'REVERSED') && invoice.accountingVoucherId && (
            <Link to={`/accounting/ledger-entries/voucher/${invoice.accountingVoucherId}`}>
              <ErpButton variant="secondary">View Accounting</ErpButton>
            </Link>
          )}
        </div>
      }
    >
      {statusBanner && (
        <div className="mb-3 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-900">{statusBanner}</div>
      )}

      {/* ── Document masthead ────────────────────────────────────────────── */}
      <div className="mb-3 rounded-md border border-erp-border bg-white px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[18px] font-semibold tracking-tight text-erp-text">
                {invoice.invoiceNumber ?? invoice.draftReference ?? 'Invoice'}
              </h2>
              <ErpStatusChip label={MONEY_IN_STATUS_LABELS[invoice.status]} tone={moneyInStatusTone(invoice.status)} />
              {settlement && (
                <ErpStatusChip label={SETTLEMENT_STATUS_LABELS[settlement]} tone={settlementStatusTone(settlement)} />
              )}
            </div>
            <p className="mt-0.5 text-[13px] text-erp-muted">
              {invoice.customerNameSnapshot}
              {invoice.customerCodeSnapshot ? ` · ${invoice.customerCodeSnapshot}` : ''} ·{' '}
              {sourceTypeLabel(invoice.sourceType)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-erp-muted">Invoice total</p>
            <p className="text-[20px] font-semibold tabular-nums text-erp-text">
              {formatCurrency(parseDecimal(invoice.totalAmount))}
            </p>
            {(invoice.status === 'POSTED' || invoice.status === 'REVERSED') && (
              <p className="text-[11px] tabular-nums text-erp-muted">
                Outstanding {formatCurrency(parseDecimal(invoice.outstandingAmount))} · Paid{' '}
                {formatCurrency(parseDecimal(invoice.amountPaid))}
              </p>
            )}
          </div>
        </div>
        <dl className="mt-3 grid gap-x-6 gap-y-3 border-t border-erp-border pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoField label="Invoice date" value={invoice.invoiceDate} mono />
          <InfoField label="Posting date" value={invoice.postingDate ?? '—'} mono />
          <InfoField label="Due date" value={invoice.dueDate ?? '—'} mono />
          <InfoField
            label="Payment terms"
            value={invoice.paymentTermsDays != null ? `${invoice.paymentTermsDays} days` : '—'}
          />
          <InfoField label="Customer PO" value={invoice.customerPoNumber ?? '—'} />
          <InfoField label="Project ref" value={invoice.projectRef ?? '—'} />
          <InfoField label="Project name" value={invoice.projectNameSnapshot ?? '—'} />
          <InfoField label="Supply type" value={invoice.supplyType.replace(/_/g, ' ')} />
          <InfoField label="Tax treatment" value={invoice.taxTreatment.replace(/_/g, ' ')} />
          <InfoField
            label="Place of supply"
            value={invoice.placeOfSupply ? `State code ${invoice.placeOfSupply}` : '—'}
          />
          <InfoField label="Currency" value={`${invoice.currencyCode} @ ${invoice.exchangeRate}`} mono />
          <InfoField label="Reference no." value={invoice.referenceNumber ?? '—'} />
          <InfoField label="Source document" value={sourceTypeLabel(invoice.sourceType)} />
          <InfoField
            label="Posted at"
            value={invoice.postedAt ? new Date(invoice.postedAt).toLocaleString() : 'Not posted'}
          />
        </dl>
      </div>

      {/* ── Bill To + Source / Accounting ────────────────────────────────── */}
      <div className="mb-3 grid gap-3 lg:grid-cols-2">
        <DetailSection title="Bill To" subtitle="Customer snapshot captured on the document.">
          <p className="text-[14px] font-semibold text-erp-text">{invoice.customerNameSnapshot}</p>
          {snapshotAddressLines(invoice.customerBillingAddressSnapshot).map((line) => (
            <p key={line} className="text-[12px] text-erp-muted">
              {line}
            </p>
          ))}
          <dl className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
            <InfoField label="Customer code" value={invoice.customerCodeSnapshot ?? '—'} />
            <InfoField label="State code" value={invoice.customerStateCodeSnapshot ?? '—'} mono />
            <InfoField label="GSTIN" value={invoice.customerGstinSnapshot ?? '—'} mono />
            <InfoField label="PAN" value={invoice.customerPanSnapshot ?? '—'} mono />
          </dl>
          <PartyMasterCard
            variant="crm"
            partyId={invoice.customerId}
            snapshot={{
              name: invoice.customerNameSnapshot,
              code: invoice.customerCodeSnapshot,
              gstin: invoice.customerGstinSnapshot,
              pan: invoice.customerPanSnapshot,
            }}
            onRefreshFromMaster={
              invoice.status === 'DRAFT' && mergeAllowedAction(perms.canEditInvoice, actions?.edit)
                ? () => setShowMasterRefresh(true)
                : undefined
            }
          />
        </DetailSection>

        <DetailSection title="Source & Accounting" subtitle="Origin document, GL voucher, and receivable status.">
          <SourceDocumentCard
            sources={[
              {
                sourceType: invoice.sourceType,
                sourceDocumentId: invoice.sourceDocumentId,
                documentNumber:
                  (invoice.sourceDocumentSnapshot as { salesOrderNo?: string; documentNumber?: string } | null)
                    ?.salesOrderNo ??
                  (invoice.sourceDocumentSnapshot as { documentNumber?: string } | null)?.documentNumber ??
                  null,
              },
            ]}
            emptyText="Direct invoice — no sales order reference."
          />
          {invoice.status === 'POSTED' || invoice.status === 'REVERSED' ? (
            <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
              <InfoField
                label="Accounting voucher"
                value={
                  invoice.accountingVoucherId ? (
                    <Link
                      to={`/accounting/ledger-entries/voucher/${invoice.accountingVoucherId}`}
                      className="text-erp-accent hover:underline"
                    >
                      View accounting voucher
                    </Link>
                  ) : (
                    '—'
                  )
                }
              />
              <InfoField label="Posted at" value={invoice.postedAt ? new Date(invoice.postedAt).toLocaleString() : '—'} />
              <InfoField label="Outstanding" value={formatCurrency(parseDecimal(invoice.outstandingAmount))} mono />
              <InfoField label="Amount paid" value={formatCurrency(parseDecimal(invoice.amountPaid))} mono />
              <InfoField label="Amount adjusted" value={formatCurrency(parseDecimal(invoice.amountAdjusted))} mono />
              <InfoField label="Open item" value={invoice.receivableOpenItemId ? 'Linked' : '—'} />
            </dl>
          ) : (
            <p className="mt-3 text-[12px] text-erp-muted">
              Revenue and receivable accounts resolve from default posting mappings on the server. Post the invoice to
              create the voucher and open item.
            </p>
          )}
          {invoice.status === 'REVERSED' && invoice.reversalReason && (
            <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[12px] text-amber-900">
              Reversal reason: {invoice.reversalReason}
              {invoice.reversalVoucherId ? ' · Reversal voucher linked' : ''}
            </p>
          )}
        </DetailSection>
      </div>

      {/* ── Lines ────────────────────────────────────────────────────────── */}
      <DetailSection
        title="Invoice Lines"
        subtitle="Posted invoices always render the snapshot captured at posting time."
        className="mb-3"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Item</th>
                <th className="px-2 py-2">Description</th>
                <th className="px-2 py-2">HSN</th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2 text-right">Rate</th>
                <th className="px-2 py-2 text-right">Taxable</th>
                <th className="px-2 py-2 text-right">Tax</th>
                <th className="px-2 py-2 text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.lines ?? []).map((l) => (
                <tr key={l.id} className="border-b border-erp-border/60 hover:bg-erp-surface-alt/40">
                  <td className="px-2 py-2 text-erp-muted">{l.lineNumber}</td>
                  <td className="px-2 py-2">{l.itemCodeSnapshot ?? '—'}</td>
                  <td className="px-2 py-2">{l.description ?? l.itemNameSnapshot}</td>
                  <td className="px-2 py-2 tabular-nums">{l.hsnCodeSnapshot ?? '—'}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {l.quantity}
                    {l.uomSnapshot ? ` ${l.uomSnapshot}` : ''}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(parseDecimal(l.unitRate))}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(parseDecimal(l.taxableAmount))}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(lineTaxAmount(l))}</td>
                  <td className="px-2 py-2 text-right font-medium tabular-nums">
                    {formatCurrency(parseDecimal(l.lineTotal))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DetailSection>

      {/* ── Narration + Totals ───────────────────────────────────────────── */}
      <div className="grid gap-3 lg:grid-cols-2">
        <DetailSection title="Narration">
          <p className="text-[13px] text-erp-text">{invoice.narration ?? '—'}</p>
        </DetailSection>
        <TotalsPanel
          subtotal={invoice.subtotalAmount}
          discount={invoice.discountAmount}
          taxable={invoice.taxableAmount}
          cgst={invoice.cgstAmount}
          sgst={invoice.sgstAmount}
          igst={invoice.igstAmount}
          freight={invoice.freightAmount}
          other={invoice.otherChargesAmount}
          roundOff={invoice.roundOffAmount}
          total={invoice.totalAmount}
        />
      </div>

      <MasterRefreshModal
        open={showMasterRefresh}
        onClose={() => setShowMasterRefresh(false)}
        variant="crm"
        documentId={invoice.id}
        partyId={invoice.customerId}
        snapshot={{
          name: invoice.customerNameSnapshot,
          code: invoice.customerCodeSnapshot,
          gstin: invoice.customerGstinSnapshot,
          pan: invoice.customerPanSnapshot,
        }}
        onApplied={() => void load()}
      />

      <ValidationDrawer open={showValidate} onClose={() => setShowValidate(false)} report={report} />
      <PostConfirmModal
        open={showPost}
        invoiceLabel={invoiceDisplayNumber(invoice)}
        totalAmount={invoice.totalAmount}
        posting={acting}
        onConfirm={() => void runPost()}
        onCancel={() => setShowPost(false)}
      />

      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded border border-erp-border bg-white p-4">
            <h3 className="text-[14px] font-semibold">Cancel invoice</h3>
            <Textarea className="mt-2" rows={3} placeholder="Reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            <div className="mt-3 flex justify-end gap-2">
              <ErpButton variant="secondary" onClick={() => setShowCancel(false)}>
                Close
              </ErpButton>
              <ErpButton variant="primary" onClick={() => void runCancel()} disabled={acting}>
                Confirm cancel
              </ErpButton>
            </div>
          </div>
        </div>
      )}

      {showReverse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded border border-erp-border bg-white p-4">
            <h3 className="text-[14px] font-semibold">Reverse sales invoice</h3>
            <p className="mt-1 text-[12px] text-erp-muted">
              Posts a reversing voucher and closes the debit open item. Reverse all posted receipt and credit-note
              allocations first.
            </p>
            <Textarea
              className="mt-2"
              rows={3}
              placeholder="Reason"
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
            />
            <div className="mt-3 flex justify-end gap-2">
              <ErpButton variant="secondary" onClick={() => setShowReverse(false)}>
                Close
              </ErpButton>
              <ErpButton variant="primary" onClick={() => void runReverse()} disabled={acting}>
                Confirm reverse
              </ErpButton>
            </div>
          </div>
        </div>
      )}
    </MoneyInWorkspaceShell>
  )
}
