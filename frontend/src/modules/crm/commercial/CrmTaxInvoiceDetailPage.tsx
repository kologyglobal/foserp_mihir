import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftRight,
  Banknote,
  ClipboardList,
  Download,
  FileText,
  Pencil,
  Printer,
  Send,
  XCircle,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip, type ErpStatusChipTone } from '@/components/erp/ErpStatusChip'
import { TableLink } from '@/components/ui/AppLink'
import { Toast } from '@/components/ui/Toast'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { CrmTaxInvoiceDocument } from '@/components/sales/CrmTaxInvoiceDocument'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import { salesCustomer360Path } from '@/config/entity360Routes'
import {
  apiCancelDraftInvoice,
  apiGetInvoice,
  apiPostInvoice,
} from '@/services/bridges/crmCommercialApiBridge'
import { useCrmCommercialStore } from '@/store/crmCommercialStore'
import { notify } from '@/store/toastStore'
import {
  CRM_INVOICE_PAYMENT_STATUS_LABELS,
  CRM_TAX_INVOICE_ACCOUNTING_STATUS_LABELS,
  CRM_TAX_INVOICE_STATUS_LABELS,
  type CrmTaxInvoice,
  type CrmTaxInvoiceStatus,
} from '@/types/crmCommercial'
import { downloadCrmTaxInvoicePdf, printCrmTaxInvoiceDocument } from '@/utils/crmTaxInvoiceExport'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { canCrmPermission } from '@/utils/permissions/crm'
import { cn } from '@/utils/cn'

function statusTone(status: CrmTaxInvoiceStatus): ErpStatusChipTone {
  if (status === 'paid') return 'success'
  if (status === 'cancelled') return 'critical'
  if (status === 'draft') return 'neutral'
  if (status === 'partially_paid') return 'warning'
  return 'info'
}

function SideMeta({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="ti-zoho-meta">
      <dt className="ti-zoho-meta__label">{label}</dt>
      <dd className="ti-zoho-meta__value">{children}</dd>
    </div>
  )
}

function SideCard({
  title,
  children,
  className,
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('ti-zoho-side-card', className)}>
      {title ? <h3 className="ti-zoho-side-card__title">{title}</h3> : null}
      {children}
    </section>
  )
}

/**
 * Zoho Books–style tax invoice view: document preview canvas + compact facts rail.
 */
export function CrmInvoiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const invoice = useCrmCommercialStore((s) => (id ? s.invoices.find((i) => i.id === id) : undefined))
  const postInvoice = useCrmCommercialStore((s) => s.postInvoice)
  const cancelDraftInvoice = useCrmCommercialStore((s) => s.cancelDraftInvoice)
  const allAllocations = useCrmCommercialStore((s) => s.allocations)
  const allocations = useMemo(
    () => (id ? allAllocations.filter((a) => a.invoiceId === id && !a.reversedAt) : []),
    [allAllocations, id],
  )
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => Boolean(isApiMode() && id && !invoice))
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !isApiMode()) {
      setLoading(false)
      return
    }
    if (invoice) {
      setLoading(false)
      setLoadError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void apiGetInvoice(id).then((r) => {
      if (cancelled) return
      if (!r.ok) setLoadError(r.error ?? 'Invoice not found')
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id, invoice])

  if (loading) return <LoadingState variant="form" rows={6} />

  if (!invoice) {
    return (
      <OperationalPageShell
        title="Invoice not found"
        breadcrumbs={[{ label: 'Sales', to: '/sales' }, { label: 'Not found' }]}
      >
        <p className="mb-3 text-[13px] text-erp-muted">{loadError ?? 'This invoice is not available.'}</p>
        <Link to="/sales/invoices" className="text-sm font-semibold text-erp-primary">
          Back to invoices
        </Link>
      </OperationalPageShell>
    )
  }

  function act(label: string, fn: () => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>) {
    void Promise.resolve(fn()).then((r) => {
      setToast(r.ok ? label : (r.error ?? 'Action failed'))
    })
  }

  async function handlePdf() {
    const result = await downloadCrmTaxInvoicePdf(invoice as CrmTaxInvoice)
    if (!result.ok) notify.error(result.error ?? 'PDF download failed')
  }

  const showAccounting =
    Boolean(invoice.accountingStatus && invoice.accountingStatus !== 'none') || Boolean(invoice.salesInvoiceId)

  return (
    <>
      <Toast message={toast} />
      <div className="ti-zoho-page erp-page">
        <PageBackLink to="/sales/invoices" label="Back to Tax Invoices" className="no-print" />

        <header className="ti-zoho-toolbar no-print">
          <div className="ti-zoho-toolbar__identity">
            <div className="ti-zoho-toolbar__title-row">
              <h1 className="ti-zoho-toolbar__title">{invoice.invoiceNo}</h1>
              <ErpStatusChip tone={statusTone(invoice.status)} label={CRM_TAX_INVOICE_STATUS_LABELS[invoice.status]} />
              <ErpStatusChip
                tone={invoice.paymentStatus === 'paid' ? 'success' : invoice.paymentStatus === 'partially_paid' ? 'warning' : 'neutral'}
                label={CRM_INVOICE_PAYMENT_STATUS_LABELS[invoice.paymentStatus]}
              />
            </div>
            <p className="ti-zoho-toolbar__subtitle">
              {invoice.customerName}
              <span aria-hidden> · </span>
              {formatDate(invoice.invoiceDate)}
              <span aria-hidden> · </span>
              Due {formatDate(invoice.dueDate)}
            </p>
          </div>

          <ErpCommandBar
            sticky={false}
            className="ti-zoho-toolbar__actions"
            primaryAction={
              invoice.status === 'draft' && canCrmPermission('crm.commercial.invoice.post')
                ? {
                    id: 'post',
                    label: 'Post Invoice',
                    icon: Send,
                    onClick: () =>
                      act('Invoice posted', () =>
                        isApiMode() ? apiPostInvoice(invoice.id) : postInvoice(invoice.id),
                      ),
                  }
                : invoice.balanceDue > 0 &&
                    invoice.status !== 'cancelled' &&
                    invoice.status !== 'draft' &&
                    !invoice.salesInvoiceId &&
                    invoice.accountingStatus !== 'pending_review' &&
                    invoice.accountingStatus !== 'converted'
                  ? {
                      id: 'alloc',
                      label: 'Allocate Payment',
                      icon: ArrowLeftRight,
                      onClick: () =>
                        navigate(
                          `/sales/payment-allocation?customerId=${invoice.customerId}&invoiceId=${invoice.id}`,
                        ),
                    }
                  : invoice.salesInvoiceId
                    ? {
                        id: 'money-in-pay',
                        label: 'Record Payment',
                        icon: Banknote,
                        onClick: () =>
                          navigate(
                            `/accounting/money-in/receipts/new?customerId=${invoice.customerId}&salesInvoiceId=${invoice.salesInvoiceId}`,
                          ),
                      }
                    : {
                        id: 'pdf',
                        label: 'PDF/Print',
                        icon: Printer,
                        onClick: () => navigate(`/sales/invoices/${invoice.id}/print`),
                      }
            }
            secondaryActions={[
              ...(invoice.status === 'draft' && canCrmPermission('crm.commercial.invoice.create')
                ? [
                    {
                      id: 'edit',
                      label: 'Edit',
                      icon: Pencil,
                      onClick: () => navigate(`/sales/invoices/${invoice.id}/edit`),
                    },
                  ]
                : []),
              {
                id: 'print',
                label: 'Print',
                icon: Printer,
                onClick: () => navigate(`/sales/invoices/${invoice.id}/print`),
              },
              { id: 'pdf', label: 'PDF', icon: Download, onClick: () => void handlePdf() },
              ...(invoice.status === 'draft' && canCrmPermission('crm.commercial.invoice.cancel')
                ? [
                    {
                      id: 'cancel',
                      label: 'Cancel',
                      icon: XCircle,
                      onClick: () =>
                        act('Draft cancelled', () =>
                          isApiMode() ? apiCancelDraftInvoice(invoice.id) : cancelDraftInvoice(invoice.id),
                        ),
                    },
                  ]
                : []),
              ...(invoice.salesInvoiceId
                ? [
                    {
                      id: 'open-si',
                      label: 'Money In',
                      icon: FileText,
                      onClick: () => navigate(`/accounting/money-in/invoices/${invoice.salesInvoiceId}`),
                    },
                  ]
                : invoice.accountingStatus === 'pending_review'
                  ? [
                      {
                        id: 'crm-pending',
                        label: 'Accounting Queue',
                        icon: ClipboardList,
                        onClick: () => navigate('/accounting/money-in/crm-pending'),
                      },
                    ]
                  : []),
            ]}
          />
        </header>

        <div className="ti-zoho-layout">
          <main className="ti-zoho-main">
            <div className="ti-preview-canvas">
              <div className="ti-preview-canvas__sheet">
                <CrmTaxInvoiceDocument invoice={invoice} />
              </div>
            </div>

            {allocations.length > 0 ? (
              <SideCard title="Payment history" className="ti-zoho-history no-print">
                <ul className="ti-zoho-history__list">
                  {allocations.map((a) => (
                    <li key={a.id} className="ti-zoho-history__row">
                      <div>
                        <span className="ti-zoho-history__receipt">{a.receiptNo}</span>
                        <span className="ti-zoho-history__date">{formatDate(a.allocationDate)}</span>
                      </div>
                      <span className="ti-zoho-history__amount">{formatCurrency(a.amount)}</span>
                    </li>
                  ))}
                </ul>
              </SideCard>
            ) : null}
          </main>

          <aside className="ti-zoho-rail no-print">
            <SideCard className="ti-zoho-due-card">
              <p className="ti-zoho-due-card__label">Amount Due</p>
              <p className="ti-zoho-due-card__amount">{formatCurrency(invoice.balanceDue)}</p>
              <p className="ti-zoho-due-card__meta">
                Total {formatCurrency(invoice.gst.grandTotal)} · Paid {formatCurrency(invoice.amountPaid)}
              </p>
            </SideCard>

            <SideCard title="Customer">
              <TableLink
                to={salesCustomer360Path(invoice.customerId)}
                className="ti-zoho-customer-link"
              >
                {invoice.customerName}
              </TableLink>
              {invoice.customerGstin ? (
                <p className="ti-zoho-muted">GSTIN {invoice.customerGstin}</p>
              ) : null}
            </SideCard>

            <SideCard title="Invoice details">
              <dl className="ti-zoho-meta-list">
                <SideMeta label="Invoice date">{formatDate(invoice.invoiceDate)}</SideMeta>
                <SideMeta label="Due date">{formatDate(invoice.dueDate)}</SideMeta>
                <SideMeta label="Payment terms">{invoice.paymentTerms || '-'}</SideMeta>
                <SideMeta label="Delivery">{invoice.deliveryTerms || '-'}</SideMeta>
                <SideMeta label="Customer PO">{invoice.customerPoNumber || '-'}</SideMeta>
              </dl>
            </SideCard>

            <SideCard title="Linked documents">
              <dl className="ti-zoho-meta-list">
                {invoice.salesOrderId ? (
                  <SideMeta label="Sales order">
                    <TableLink to={`/crm/sales-orders/${invoice.salesOrderId}`}>
                      {invoice.salesOrderNo || invoice.salesOrderId}
                    </TableLink>
                  </SideMeta>
                ) : null}
                {invoice.proformaInvoiceId ? (
                  <SideMeta label="Proforma">
                    <TableLink to={`/sales/proforma-invoices/${invoice.proformaInvoiceId}`}>
                      {invoice.proformaNo || invoice.proformaInvoiceId}
                    </TableLink>
                  </SideMeta>
                ) : null}
                {invoice.quotationId ? (
                  <SideMeta label="Quotation">
                    <TableLink to={`/crm/quotations/${invoice.quotationId}`}>
                      {invoice.quotationNo ?? invoice.quotationId}
                    </TableLink>
                  </SideMeta>
                ) : null}
                {!invoice.salesOrderId && !invoice.proformaInvoiceId && !invoice.quotationId ? (
                  <p className="ti-zoho-muted">No linked documents</p>
                ) : null}
              </dl>
            </SideCard>

            {showAccounting ? (
              <SideCard title="Accounting">
                <dl className="ti-zoho-meta-list">
                  <SideMeta label="Status">
                    {CRM_TAX_INVOICE_ACCOUNTING_STATUS_LABELS[invoice.accountingStatus ?? 'none']}
                  </SideMeta>
                  <SideMeta label="Money In invoice">
                    {invoice.salesInvoiceId ? (
                      <TableLink to={`/accounting/money-in/invoices/${invoice.salesInvoiceId}`}>
                        {invoice.salesInvoiceNumber || 'Open'}
                      </TableLink>
                    ) : (
                      '-'
                    )}
                  </SideMeta>
                  <SideMeta label="Last payment">
                    {invoice.lastPaymentDate ? formatDate(invoice.lastPaymentDate) : '-'}
                  </SideMeta>
                </dl>
              </SideCard>
            ) : null}

            <SideCard title="More actions">
              <div className="ti-zoho-actions">
                {invoice.status === 'draft' && canCrmPermission('crm.commercial.invoice.create') ? (
                  <ErpButton
                    variant="secondary"
                    icon={Pencil}
                    className="w-full justify-center"
                    onClick={() => navigate(`/sales/invoices/${invoice.id}/edit`)}
                  >
                    Edit Draft
                  </ErpButton>
                ) : null}
                <ErpButton
                  variant="secondary"
                  icon={Printer}
                  className="w-full justify-center"
                  onClick={() => navigate(`/sales/invoices/${invoice.id}/print`)}
                >
                  Print / Preview
                </ErpButton>
                <ErpButton
                  variant="secondary"
                  icon={Download}
                  className="w-full justify-center"
                  onClick={() => void handlePdf()}
                >
                  Download PDF
                </ErpButton>
                <ErpButton
                  variant="ghost"
                  icon={FileText}
                  className="w-full justify-center"
                  onClick={() => navigate(salesCustomer360Path(invoice.customerId))}
                >
                  Customer 360
                </ErpButton>
              </div>
            </SideCard>
          </aside>
        </div>
      </div>
    </>
  )
}

export function CrmInvoicePrintPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const invoice = useCrmCommercialStore((s) => (id ? s.invoices.find((i) => i.id === id) : undefined))
  const [loading, setLoading] = useState(() => Boolean(isApiMode() && id && !invoice))

  useEffect(() => {
    if (!id || !isApiMode() || invoice) {
      setLoading(false)
      return
    }
    let cancelled = false
    void apiGetInvoice(id).then(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id, invoice])

  if (loading || !invoice) return <LoadingState variant="form" rows={6} />

  return (
    <div className="pi-print-page erp-page">
      <PageBackLink to={`/sales/invoices/${invoice.id}`} label="Back to invoice" className="no-print" />
      <div className="pi-print-toolbar no-print">
        <div>
          <p className="pi-print-toolbar__title">{invoice.invoiceNo}</p>
          <p className="pi-print-toolbar__subtitle">Tax invoice — professional preview &amp; print</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ErpButton
            type="button"
            variant="primary"
            icon={Printer}
            onClick={() => printCrmTaxInvoiceDocument({ fileName: invoice.invoiceNo })}
          >
            Print
          </ErpButton>
          <ErpButton
            type="button"
            variant="secondary"
            icon={Download}
            onClick={() =>
              void downloadCrmTaxInvoicePdf(invoice).then((r) => {
                if (!r.ok) notify.error(r.error ?? 'PDF download failed')
              })
            }
          >
            Download PDF
          </ErpButton>
          <ErpButton type="button" variant="ghost" onClick={() => navigate(`/sales/invoices/${invoice.id}`)}>
            Close
          </ErpButton>
        </div>
      </div>
      <CrmTaxInvoiceDocument invoice={invoice} />
    </div>
  )
}
