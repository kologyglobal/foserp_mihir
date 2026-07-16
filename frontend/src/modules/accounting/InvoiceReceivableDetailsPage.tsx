import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Download, FileText, HandCoins, Mail, Printer, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableLink } from '@/components/ui/AppLink'
import {
  CollectionActivityDrawer,
  CollectionStatusBadge,
  InvoiceStatusBadge,
  ReceiptStatusBadge,
} from '@/components/accounting/receivables'
import {
  exportReceivables,
  getCreditNotes,
  getCustomerReceipts,
  getCustomerDisputes,
  getReceivableInvoiceById,
  getPaymentReminders,
} from '@/services/accounting/receivablesService'
import type { CreditNote, CustomerDispute, CustomerReceipt, PaymentReminder, ReceivableInvoice } from '@/types/receivables'
import { useReceivablesPermissions } from '@/utils/permissions/receivables'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase text-erp-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px]">{value ?? '—'}</dd>
    </div>
  )
}

export function InvoiceReceivableDetailsPage() {
  const { invoiceId = '' } = useParams()
  const navigate = useNavigate()
  const perms = useReceivablesPermissions()
  const [invoice, setInvoice] = useState<ReceivableInvoice | null>(null)
  const [relatedReceipts, setRelatedReceipts] = useState<CustomerReceipt[]>([])
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  const [disputes, setDisputes] = useState<CustomerDispute[]>([])
  const [reminders, setReminders] = useState<PaymentReminder[]>([])
  const [loading, setLoading] = useState(true)
  const [collectionOpen, setCollectionOpen] = useState(false)

  const load = useCallback(async () => {
    if (!invoiceId) return
    setLoading(true)
    try {
      const inv = await getReceivableInvoiceById(invoiceId)
      setInvoice(inv)
      const [receipts, cns, dsps, rems] = await Promise.all([
        getCustomerReceipts({ customerId: inv.customerId }),
        getCreditNotes({ customerId: inv.customerId }),
        getCustomerDisputes({ customerId: inv.customerId }),
        getPaymentReminders({ customerId: inv.customerId }),
      ])
      setRelatedReceipts(
        receipts.filter((r) => r.allocationLines.some((l) => l.invoiceId === invoiceId)),
      )
      setCreditNotes(cns.filter((c) => c.referenceInvoiceId === invoiceId))
      setDisputes(dsps.filter((d) => d.invoiceId === invoiceId))
      setReminders(rems.filter((r) => r.invoiceId === invoiceId))
    } catch {
      setInvoice(null)
    } finally {
      setLoading(false)
    }
  }, [invoiceId])

  useEffect(() => {
    void load()
  }, [load])

  const breadcrumbs = [
    { label: 'Accounting', to: '/accounting' },
    { label: 'Receivables', to: '/accounting/receivables' },
    { label: 'Invoices', to: '/accounting/receivables/invoices' },
    { label: invoice?.invoiceNumber ?? 'Detail' },
  ]

  const secondary = useMemo(() => {
    if (!invoice) return []
    return [
      ...(perms.canCreateReceipt
        ? [{ id: 'receipt', label: 'Record Receipt', icon: HandCoins, onClick: () => navigate(`/accounting/receivables/receipts/new?customerId=${invoice.customerId}`) }]
        : []),
      ...(perms.canAllocate
        ? [{ id: 'allocate', label: 'Allocate', icon: HandCoins, onClick: () => navigate('/accounting/receivables/allocations') }]
        : []),
      ...(perms.canManageCollection
        ? [{ id: 'collection', label: 'Collection Activity', icon: Mail, onClick: () => setCollectionOpen(true) }]
        : []),
      ...(perms.canManageDispute
        ? [{ id: 'dispute', label: 'Mark Disputed', icon: FileText, onClick: () => navigate('/accounting/receivables/disputes') }]
        : []),
      ...(invoice.sourceSalesInvoiceId
        ? [{ id: 'source', label: 'View Source Sales Invoice', icon: FileText, onClick: () => navigate(`/invoices/${invoice.sourceSalesInvoiceId}`) }]
        : []),
      ...(perms.canPrint ? [{ id: 'print', label: 'Print', icon: Printer, onClick: () => notify.info('Print preview — demo only') }] : []),
      ...(perms.canExport
        ? [{
            id: 'export',
            label: 'Export',
            icon: Download,
            onClick: async () => {
              const file = await exportReceivables({ scope: 'open_invoices', format: 'csv', filter: { customerId: invoice.customerId } })
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
        <EmptyState icon={FileText} title="Invoice not found" action={<Link to="/accounting/receivables/invoices" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]">Back</Link>} />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={invoice.invoiceNumber}
      description={`${invoice.customerName} · Due ${invoice.dueDate}`}
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath={`/accounting/receivables/invoice/${invoiceId}`}
      kpiStrip={[
        { id: 'orig', label: 'Original', value: formatCurrency(invoice.originalAmount), accent: 'blue' },
        { id: 'bal', label: 'Outstanding', value: formatCurrency(invoice.outstandingBalance), accent: 'red' },
        { id: 'od', label: 'Overdue days', value: invoice.overdueDays, accent: invoice.overdueDays > 0 ? 'amber' : 'green' },
        { id: 'applied', label: 'Applied', value: formatCurrency(invoice.appliedAmount), accent: 'slate' },
      ]}
      commandBar={<ErpCommandBar inline sticky secondaryActions={secondary} />}
    >
      <p className="mb-4 rounded-md bg-sky-50 px-3 py-2 text-[12px] text-sky-900 ring-1 ring-sky-200">
        Read-only receivable invoice view. Posted invoice values cannot be edited here.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        <InvoiceStatusBadge status={invoice.invoiceStatus} />
        <CollectionStatusBadge status={invoice.collectionStatus} />
        {invoice.hasDispute ? <span className="text-[11px] font-semibold text-orange-800">Disputed</span> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-erp-border p-4">
          <h3 className="mb-3 text-[13px] font-semibold">Invoice details</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Customer" value={<TableLink to={`/accounting/receivables/customer/${invoice.customerId}`}>{invoice.customerName}</TableLink>} />
            <Field label="Invoice date" value={invoice.invoiceDate} />
            <Field label="Posting date" value={invoice.postingDate} />
            <Field label="Due date" value={invoice.dueDate} />
            <Field label="Payment terms" value={invoice.paymentTerms} />
            <Field label="Sales order" value={invoice.salesOrderNumber} />
            <Field label="Delivery" value={invoice.deliveryNumber} />
            <Field label="Reference" value={invoice.referenceNumber} />
            <Field label="Place of supply" value={invoice.placeOfSupply} />
            <Field label="Territory" value={invoice.territory} />
            <Field label="Salesperson" value={invoice.salesperson} />
            <Field label="Collection owner" value={invoice.collectionOwner} />
            <Field label="Ageing bucket" value={invoice.ageingBucket} />
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
            <Field label="Applied" value={formatCurrency(invoice.appliedAmount)} />
            <Field label="Credit notes" value={formatCurrency(invoice.creditNoteAmount)} />
            <Field label="Outstanding" value={formatCurrency(invoice.outstandingBalance)} />
            <Field label="GST status" value={invoice.gstStatus} />
            <Field label="e-Invoice" value={invoice.eInvoiceStatus} />
            <Field label="IRN" value={invoice.eInvoiceIrn} />
            <Field label="e-Way bill" value={invoice.eWayBillNumber} />
          </dl>
        </section>
      </div>

      <section className="mt-4 rounded-lg border border-erp-border p-4">
        <h3 className="mb-3 text-[13px] font-semibold">Related receipts</h3>
        {relatedReceipts.length === 0 ? (
          <p className="text-[13px] text-erp-muted">No receipts allocated to this invoice.</p>
        ) : (
          <table className="erp-table w-full text-[13px]">
            <thead>
              <tr className="border-b text-[11px] uppercase text-erp-muted">
                <th className="py-2 text-left">Receipt</th>
                <th className="py-2 text-left">Date</th>
                <th className="py-2 text-right">Allocated</th>
                <th className="py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {relatedReceipts.map((r) => {
                const line = r.allocationLines.find((l) => l.invoiceId === invoiceId)
                return (
                  <tr key={r.id} className="border-b border-erp-border/70">
                    <td className="py-2"><TableLink to={`/accounting/receivables/receipts/${r.id}`}>{r.receiptNumber}</TableLink></td>
                    <td className="py-2 tabular-nums">{r.receiptDate}</td>
                    <td className="py-2 text-right tabular-nums">{formatCurrency(line?.allocationAmount ?? 0)}</td>
                    <td className="py-2"><ReceiptStatusBadge status={r.voucherStatus} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      {(creditNotes.length > 0 || disputes.length > 0 || reminders.length > 0) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {creditNotes.length > 0 ? (
            <section className="rounded-lg border border-erp-border p-4">
              <h3 className="mb-2 text-[13px] font-semibold">Credit notes</h3>
              <ul className="text-[13px]">
                {creditNotes.map((c) => (
                  <li key={c.id}>{c.creditNoteNumber} — {formatCurrency(c.originalAmount)}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {disputes.length > 0 ? (
            <section className="rounded-lg border border-erp-border p-4">
              <h3 className="mb-2 text-[13px] font-semibold">Disputes</h3>
              <ul className="text-[13px]">
                {disputes.map((d) => (
                  <li key={d.id}>{d.disputeNumber} — {d.disputeType}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {reminders.length > 0 ? (
            <section className="rounded-lg border border-erp-border p-4">
              <h3 className="mb-2 text-[13px] font-semibold">Reminders</h3>
              <ul className="text-[13px]">
                {reminders.map((r) => (
                  <li key={r.id}>{r.reminderLevel}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      <CollectionActivityDrawer
        open={collectionOpen}
        onClose={() => setCollectionOpen(false)}
        customerSummary={{
          customerId: invoice.customerId,
          customerName: invoice.customerName,
          outstanding: invoice.outstandingBalance,
          overdue: invoice.overdueDays > 0 ? invoice.outstandingBalance : 0,
          creditLimit: 0,
          oldestDueDate: invoice.dueDate,
          collectionOwner: invoice.collectionOwner,
        }}
      />
    </OperationalPageShell>
  )
}
