import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Banknote, BookOpen, Download, FileText, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableLink } from '@/components/ui/AppLink'
import {
  PayableInvoiceStatusBadge,
  PayableMatchStatusBadge,
  ThreeWayMatchDrawer,
} from '@/components/accounting/payables'
import type { ThreeWayMatchResult as DrawerMatchResult } from '@/components/accounting/payables'
import {
  exportPayables,
  getPayableInvoiceById,
  getThreeWayMatch,
  getVendorPayments,
} from '@/services/accounting/payablesService'
import type { PayableInvoice, VendorPayment } from '@/types/payables'
import { usePayablesPermissions } from '@/utils/permissions/payables'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { mapMatchStatusForBadge, mapThreeWayMatchForDrawer } from './payablesUi'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase text-erp-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px]">{value ?? '—'}</dd>
    </div>
  )
}

export function PayableInvoiceDetailPage() {
  const { invoiceId = '' } = useParams()
  const navigate = useNavigate()
  const perms = usePayablesPermissions()
  const [invoice, setInvoice] = useState<PayableInvoice | null>(null)
  const [relatedPayments, setRelatedPayments] = useState<VendorPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [matchOpen, setMatchOpen] = useState(false)
  const [matchResult, setMatchResult] = useState<DrawerMatchResult | null>(null)
  const [matchLoading, setMatchLoading] = useState(false)

  const load = useCallback(async () => {
    if (!invoiceId) return
    setLoading(true)
    try {
      const inv = await getPayableInvoiceById(invoiceId)
      setInvoice(inv)
      const payments = await getVendorPayments({ vendorId: inv.vendorId })
      setRelatedPayments(
        payments.filter((p) => p.allocationLines.some((l) => l.invoiceId === invoiceId)),
      )
    } catch {
      setInvoice(null)
    } finally {
      setLoading(false)
    }
  }, [invoiceId])

  useEffect(() => {
    void load()
  }, [load])

  const openThreeWayMatch = async () => {
    if (!invoiceId) return
    setMatchLoading(true)
    setMatchOpen(true)
    setMatchResult(null)
    try {
      const result = await getThreeWayMatch(invoiceId)
      setMatchResult(mapThreeWayMatchForDrawer(result))
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Match data could not be loaded.')
      setMatchOpen(false)
    } finally {
      setMatchLoading(false)
    }
  }

  const breadcrumbs = [
    { label: 'Accounting', to: '/accounting' },
    { label: 'Payables', to: '/accounting/payables' },
    { label: 'Invoices', to: '/accounting/payables/invoices' },
    { label: invoice?.invoiceNumber ?? 'Detail' },
  ]

  const secondary = useMemo(() => {
    if (!invoice) return []
    return [
      {
        id: 'match',
        label: 'View Three-Way Match',
        icon: FileText,
        onClick: () => void openThreeWayMatch(),
      },
      ...(perms.canCreatePayment && invoice.outstandingBalance > 0
        ? [{
            id: 'payment',
            label: 'Create Payment',
            icon: Banknote,
            onClick: () => navigate(`/accounting/payables/payments/new?vendorId=${invoice.vendorId}&invoiceId=${invoice.id}`),
          }]
        : []),
      {
        id: 'ledger',
        label: 'View Ledger Entries',
        icon: BookOpen,
        onClick: () => navigate(`/accounting/ledger-entries?vendorId=${invoice.vendorId}`),
      },
      ...(invoice.sourcePurchaseInvoiceId
        ? [{
            id: 'source',
            label: 'View Source Purchase Invoice',
            icon: FileText,
            onClick: () => navigate(`/purchase/invoices/${invoice.sourcePurchaseInvoiceId}`),
          }]
        : []),
      ...(perms.canExport
        ? [{
            id: 'export',
            label: 'Export',
            icon: Download,
            onClick: async () => {
              const file = await exportPayables({ scope: 'open_invoices', format: 'csv', filter: { vendorId: invoice.vendorId } })
              notify.info(file.disclaimer)
            },
          }]
        : []),
    ]
  }, [invoice, navigate, perms])

  if (!perms.canViewInvoice) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Invoice" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" />
      </OperationalPageShell>
    )
  }

  if (loading) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Invoice" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <LoadingState variant="form" rows={8} />
      </OperationalPageShell>
    )
  }

  if (!invoice) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Not found" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <EmptyState icon={FileText} title="Invoice not found" action={<Link to="/accounting/payables/invoices" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]">Back</Link>} />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={invoice.invoiceNumber}
      description={`${invoice.vendorName} · Due ${formatDate(invoice.dueDate)}`}
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath={`/accounting/payables/invoice/${invoiceId}`}
      kpiStrip={[
        { id: 'orig', label: 'Original', value: formatCurrency(invoice.originalAmount), accent: 'blue' },
        { id: 'bal', label: 'Outstanding', value: formatCurrency(invoice.outstandingBalance), accent: 'red' },
        { id: 'od', label: 'Overdue days', value: invoice.overdueDays, accent: invoice.overdueDays > 0 ? 'amber' : 'green' },
        { id: 'paid', label: 'Paid', value: formatCurrency(invoice.paidAmount), accent: 'slate' },
      ]}
      commandBar={<ErpCommandBar inline sticky secondaryActions={secondary} />}
    >
      <p className="mb-4 rounded-md bg-sky-50 px-3 py-2 text-[12px] text-sky-900 ring-1 ring-sky-200">
        Read-only payable invoice view. Posted invoice values cannot be edited here.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        <PayableInvoiceStatusBadge status={invoice.status} />
        <PayableMatchStatusBadge status={mapMatchStatusForBadge(invoice.matchStatus)} />
        {invoice.paymentHold?.status === 'Active' ? (
          <span className="text-[11px] font-semibold text-rose-800">Payment hold</span>
        ) : null}
        {invoice.hasDispute ? <span className="text-[11px] font-semibold text-orange-800">Disputed</span> : null}
        {invoice.duplicateWarning ? (
          <span className="text-[11px] font-semibold text-amber-800">Duplicate warning</span>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-erp-border p-4">
          <h3 className="mb-3 text-[13px] font-semibold">Invoice details</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Vendor" value={<TableLink to={`/accounting/payables/vendor/${invoice.vendorId}`}>{invoice.vendorName}</TableLink>} />
            <Field label="Vendor invoice no." value={invoice.vendorInvoiceNumber} />
            <Field label="Invoice date" value={formatDate(invoice.invoiceDate)} />
            <Field label="Posting date" value={formatDate(invoice.postingDate)} />
            <Field label="Due date" value={formatDate(invoice.dueDate)} />
            <Field label="PO number" value={invoice.poNumber} />
            <Field label="GRN number" value={invoice.grnNumber} />
            <Field label="Reference" value={invoice.reference} />
            <Field label="Plant" value={invoice.plant} />
            <Field label="Cost centre" value={invoice.costCentre} />
            <Field label="Buyer" value={invoice.buyer} />
            <Field label="Ageing bucket" value={invoice.ageingBucket} />
            <Field label="Approval" value={invoice.approvalStatus} />
          </dl>
        </section>

        <section className="rounded-lg border border-erp-border p-4">
          <h3 className="mb-3 text-[13px] font-semibold">Amounts & tax</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Original amount" value={formatCurrency(invoice.originalAmount)} />
            <Field label="Taxable" value={formatCurrency(invoice.taxableAmount)} />
            <Field label="CGST" value={formatCurrency(invoice.cgst)} />
            <Field label="SGST" value={formatCurrency(invoice.sgst)} />
            <Field label="IGST" value={formatCurrency(invoice.igst)} />
            <Field label="Paid" value={formatCurrency(invoice.paidAmount)} />
            <Field label="Debit notes" value={formatCurrency(invoice.debitNoteAmount)} />
            <Field label="Outstanding" value={formatCurrency(invoice.outstandingBalance)} />
            <Field label="TDS" value={invoice.tdsAmount > 0 ? `${formatCurrency(invoice.tdsAmount)} (${invoice.tdsSection ?? '—'})` : '—'} />
            <Field label="GST registration" value={invoice.gstRegistrationType} />
          </dl>
        </section>

        {relatedPayments.length > 0 ? (
          <section className="rounded-lg border border-erp-border p-4 lg:col-span-2">
            <h3 className="mb-3 text-[13px] font-semibold">Related payments</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-[12px]">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase text-erp-muted">
                    <th className="px-2 py-1">Payment</th>
                    <th className="px-2 py-1">Date</th>
                    <th className="px-2 py-1">Mode</th>
                    <th className="px-2 py-1 text-right">Allocated</th>
                    <th className="px-2 py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {relatedPayments.map((p) => {
                    const line = p.allocationLines.find((l) => l.invoiceId === invoiceId)
                    return (
                      <tr key={p.id} className="border-t border-erp-border">
                        <td className="px-2 py-1.5">
                          <TableLink to={`/accounting/payables/payments/${p.id}`}>{p.paymentNumber}</TableLink>
                        </td>
                        <td className="px-2 py-1.5">{formatDate(p.paymentDate)}</td>
                        <td className="px-2 py-1.5">{p.paymentMode}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(line?.allocationAmount ?? 0)}</td>
                        <td className="px-2 py-1.5">{p.status}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>

      <ThreeWayMatchDrawer
        open={matchOpen}
        onClose={() => {
          setMatchOpen(false)
          setMatchResult(null)
        }}
        result={matchLoading ? null : matchResult}
      />
    </OperationalPageShell>
  )
}
