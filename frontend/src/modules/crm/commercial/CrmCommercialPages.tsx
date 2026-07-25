import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import {
  Banknote,
  FileText,
  Plus,
  Send,
  XCircle,
  ArrowLeftRight,
  ShoppingCart,
} from 'lucide-react'
import { OperationalPageShell } from '../../../components/design-system/OperationalPageShell'
import { SmartFilterBar } from '../../../components/design-system/SmartFilterBar'
import { StatusDot } from '../../../components/design-system/StatusDot'
import { DataTable } from '../../../components/tables/DataTable'
import { ErpCommandBar } from '../../../components/erp/ErpCommandBar'
import { ErpButton } from '../../../components/erp/ErpButton'
import { ErpCardSection, ErpFieldRow } from '../../../components/erp/card-form'
import { SearchInput } from '../../../components/ui/SearchInput'
import { Select, Input, Textarea } from '../../../components/forms/Inputs'
import { TableLink } from '../../../components/ui/AppLink'
import { Toast } from '../../../components/ui/Toast'
import { SELECT_PLACEHOLDER } from '../../../components/forms/selectStandards'
import { salesCustomer360Path } from '../../../config/entity360Routes'
import { useCrmCommercialStore } from '../../../store/crmCommercialStore'
import { useMasterStore } from '../../../store/masterStore'
import { useMrpStore } from '../../../store/mrpStore'
import { useProformaInvoiceStore } from '../../../store/proformaInvoiceStore'
import { formatCurrency } from '../../../utils/formatters/currency'
import { formatDate } from '../../../utils/dates/format'
import { canCrmPermission } from '../../../utils/permissions/crm'
import { notify } from '../../../store/toastStore'
import { isApiMode } from '../../../config/apiConfig'
import {
  apiAllocatePayments,
  apiCancelDraftInvoice,
  apiCreateInvoice,
  apiPostInvoice,
  apiReceiveProformaPayment,
  apiReverseAllocation,
} from '../../../services/bridges/crmCommercialApiBridge'
import type { CrmPaymentMode, CrmTaxInvoice, CrmTaxInvoiceStatus } from '../../../types/crmCommercial'
import {
  CRM_PAYMENT_MODE_LABELS,
  CRM_TAX_INVOICE_STATUS_LABELS,
  CRM_INVOICE_PAYMENT_STATUS_LABELS,
} from '../../../types/crmCommercial'
import type { StatusDotTone } from '../../../components/design-system/StatusDot'
import { cn } from '../../../utils/cn'

function invoiceTone(status: CrmTaxInvoiceStatus): StatusDotTone {
  if (status === 'paid') return 'success'
  if (status === 'partially_paid' || status === 'posted') return 'warning'
  if (status === 'cancelled') return 'danger'
  return 'neutral'
}

export function CrmInvoiceListPage() {
  const navigate = useNavigate()
  const invoices = useCrmCommercialStore((s) => s.invoices)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<CrmTaxInvoiceStatus | ''>('')
  const canCreate = canCrmPermission('crm.commercial.invoice.create')

  const filtered = useMemo(() => {
    let list = [...invoices]
    if (statusFilter) list = list.filter((i) => i.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (i) =>
          i.invoiceNo.toLowerCase().includes(q)
          || i.customerName.toLowerCase().includes(q)
          || (i.salesOrderNo ?? '').toLowerCase().includes(q)
          || (i.proformaNo ?? '').toLowerCase().includes(q),
      )
    }
    return list.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate))
  }, [invoices, search, statusFilter])

  const columns = useMemo<ColumnDef<CrmTaxInvoice, unknown>[]>(
    () => [
      {
        accessorKey: 'invoiceNo',
        header: 'Invoice No.',
        cell: ({ row }) => (
          <TableLink to={`/crm/commercial/invoices/${row.original.id}`}>{row.original.invoiceNo}</TableLink>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusDot label={CRM_TAX_INVOICE_STATUS_LABELS[row.original.status]} tone={invoiceTone(row.original.status)} />
        ),
      },
      {
        accessorKey: 'customerName',
        header: 'Customer',
        cell: ({ row }) => (
          <TableLink to={salesCustomer360Path(row.original.customerId)}>{row.original.customerName}</TableLink>
        ),
      },
      {
        accessorKey: 'invoiceDate',
        header: 'Date',
        cell: ({ row }) => formatDate(row.original.invoiceDate),
      },
      {
        id: 'total',
        header: 'Amount',
        cell: ({ row }) => formatCurrency(row.original.gst.grandTotal),
      },
      {
        id: 'balance',
        header: 'Balance',
        cell: ({ row }) => formatCurrency(row.original.balanceDue),
      },
      {
        id: 'so',
        header: 'SO',
        cell: ({ row }) =>
          row.original.salesOrderId ? (
            <TableLink to={`/crm/sales-orders/${row.original.salesOrderId}`}>{row.original.salesOrderNo}</TableLink>
          ) : (
            '—'
          ),
      },
    ],
    [],
  )

  return (
    <OperationalPageShell
      variant="dynamics"
      badge="CRM Commercial"
      title="Tax Invoices"
      description="Create and track tax invoices from sales orders and proformas — without leaving CRM"
      breadcrumbs={[
        { label: 'CRM', to: '/crm' },
        { label: 'Tax Invoices' },
      ]}
      favoritePath="/crm/commercial/invoices"
      commandBar={(
        <ErpCommandBar
          sticky={false}
          primaryAction={
            canCreate
              ? { id: 'new', label: 'Create Invoice', icon: Plus, onClick: () => navigate('/crm/commercial/invoices/new') }
              : undefined
          }
          secondaryActions={[
            { id: 'alloc', label: 'Payment Allocation', icon: ArrowLeftRight, onClick: () => navigate('/crm/commercial/payment-allocation') },
          ]}
        />
      )}
      filterBar={(
        <SmartFilterBar resultCount={filtered.length}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search invoice, customer, SO…" className="w-72" />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CrmTaxInvoiceStatus | '')} className="h-9 w-40 text-[13px]">
            <option value="">All statuses</option>
            {(Object.keys(CRM_TAX_INVOICE_STATUS_LABELS) as CrmTaxInvoiceStatus[]).map((s) => (
              <option key={s} value={s}>{CRM_TAX_INVOICE_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </SmartFilterBar>
      )}
    >
      <DataTable
        data={filtered}
        columns={columns}
        stickyFirstColumn
        zebra
        toolbar="compact"
        showCompactSearch={false}
        pageSize={50}
        showPagination
        getRowId={(row) => row.id}
        onRowView={(row) => navigate(`/crm/commercial/invoices/${row.id}`)}
        emptyMessage="No tax invoices yet. Create one from a sales order, proforma, or customer."
      />
    </OperationalPageShell>
  )
}

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

  if (!invoice) {
    return (
      <OperationalPageShell title="Invoice not found" breadcrumbs={[{ label: 'CRM', to: '/crm' }, { label: 'Not found' }]}>
        <Link to="/crm/commercial/invoices" className="text-sm font-semibold text-erp-primary">Back to invoices</Link>
      </OperationalPageShell>
    )
  }

  function act(label: string, fn: () => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>) {
    void Promise.resolve(fn()).then((r) => {
      setToast(r.ok ? label : (r.error ?? 'Action failed'))
    })
  }

  return (
    <>
      <Toast message={toast} />
      <OperationalPageShell
        variant="dynamics"
        badge="CRM Commercial"
        title={invoice.invoiceNo}
        description={`${invoice.customerName} · ${CRM_TAX_INVOICE_STATUS_LABELS[invoice.status]}`}
        breadcrumbs={[
          { label: 'CRM', to: '/crm' },
          { label: 'Tax Invoices', to: '/crm/commercial/invoices' },
          { label: invoice.invoiceNo },
        ]}
        favoritePath={`/crm/commercial/invoices/${invoice.id}`}
        commandBar={(
          <ErpCommandBar
            sticky={false}
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
                : invoice.balanceDue > 0 && invoice.status !== 'cancelled' && invoice.status !== 'draft'
                  ? {
                      id: 'alloc',
                      label: 'Allocate Payment',
                      icon: ArrowLeftRight,
                      onClick: () => navigate(`/crm/commercial/payment-allocation?customerId=${invoice.customerId}&invoiceId=${invoice.id}`),
                    }
                  : undefined
            }
            secondaryActions={[
              ...(invoice.status === 'draft' && canCrmPermission('crm.commercial.invoice.cancel')
                ? [{
                    id: 'cancel',
                    label: 'Cancel Draft',
                    icon: XCircle,
                    onClick: () =>
                      act('Draft cancelled', () =>
                        isApiMode() ? apiCancelDraftInvoice(invoice.id) : cancelDraftInvoice(invoice.id),
                      ),
                  }]
                : []),
              { id: 'customer', label: 'Customer 360', icon: FileText, onClick: () => navigate(salesCustomer360Path(invoice.customerId)) },
            ]}
          />
        )}
        insights={[
          { label: 'Status', value: CRM_TAX_INVOICE_STATUS_LABELS[invoice.status], accent: invoice.status === 'paid' ? 'green' : 'amber' },
          { label: 'Total', value: formatCurrency(invoice.gst.grandTotal), accent: 'blue' },
          { label: 'Paid', value: formatCurrency(invoice.amountPaid), accent: 'green' },
          { label: 'Balance', value: formatCurrency(invoice.balanceDue), accent: 'amber' },
        ]}
      >
        <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            <ErpCardSection title="Invoice lines">
              <div className="col-span-2 overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-erp-border text-erp-muted">
                      <th className="py-2 pr-3">Item</th>
                      <th className="py-2 pr-3">Qty</th>
                      <th className="py-2 pr-3">Rate</th>
                      <th className="py-2 pr-3">Tax %</th>
                      <th className="py-2">Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.lines.map((line) => (
                      <tr key={line.id} className="border-b border-erp-border/60">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{line.itemCode}</div>
                          <div className="text-[12px] text-erp-muted">{line.description}</div>
                        </td>
                        <td className="py-2 pr-3">{line.qty} {line.uom}</td>
                        <td className="py-2 pr-3">{formatCurrency(line.unitPrice)}</td>
                        <td className="py-2 pr-3">{line.taxPct}%</td>
                        <td className="py-2">{formatCurrency(line.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ErpCardSection>
            <ErpCardSection title="Allocation history">
              <div className="col-span-2 space-y-2">
                {allocations.length === 0 ? (
                  <p className="text-[13px] text-erp-muted">No allocations yet.</p>
                ) : (
                  allocations.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-erp-border px-3 py-2 text-[13px]">
                      <span>
                        {formatDate(a.allocationDate)} · {a.receiptNo}
                        {a.reversedAt ? <span className="ml-2 text-erp-danger">(Reversed)</span> : null}
                      </span>
                      <span className="font-semibold">{formatCurrency(a.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </ErpCardSection>
          </div>
          <aside className="space-y-4">
            <ErpCardSection title="References">
              <ErpFieldRow label="Customer" readOnly>
                <TableLink to={salesCustomer360Path(invoice.customerId)}>{invoice.customerName}</TableLink>
              </ErpFieldRow>
              {invoice.salesOrderId ? (
                <ErpFieldRow label="Sales Order" readOnly>
                  <TableLink to={`/crm/sales-orders/${invoice.salesOrderId}`}>{invoice.salesOrderNo}</TableLink>
                </ErpFieldRow>
              ) : null}
              {invoice.quotationId ? (
                <ErpFieldRow label="Quotation" readOnly>
                  <TableLink to={`/crm/quotations/${invoice.quotationId}`}>{invoice.quotationNo ?? invoice.quotationId}</TableLink>
                </ErpFieldRow>
              ) : null}
              {invoice.proformaInvoiceId ? (
                <ErpFieldRow label="Proforma" readOnly>
                  <TableLink to={`/sales/proforma-invoices/${invoice.proformaInvoiceId}`}>{invoice.proformaNo}</TableLink>
                </ErpFieldRow>
              ) : null}
              <ErpFieldRow label="Payment status" readOnly>
                {CRM_INVOICE_PAYMENT_STATUS_LABELS[invoice.paymentStatus]}
              </ErpFieldRow>
              <ErpFieldRow label="Delivery" readOnly>{invoice.deliveryTerms || '—'}</ErpFieldRow>
              <ErpFieldRow label="Payment terms" readOnly>{invoice.paymentTerms || '—'}</ErpFieldRow>
            </ErpCardSection>
          </aside>
        </div>
      </OperationalPageShell>
    </>
  )
}

export function CrmInvoiceCreatePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const salesOrderId = params.get('salesOrderId')
  const proformaId = params.get('proformaId')
  const customerIdParam = params.get('customerId')

  const createFromSo = useCrmCommercialStore((s) => s.createInvoiceFromSalesOrder)
  const createFromPi = useCrmCommercialStore((s) => s.createInvoiceFromProforma)
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const proformas = useProformaInvoiceStore((s) => s.proformaInvoices)
  const customers = useMasterStore((s) => s.customers)
  const getCustomer = useMasterStore((s) => s.getCustomer)

  const [sourceType, setSourceType] = useState<'sales_order' | 'proforma' | 'customer'>(
    salesOrderId ? 'sales_order' : proformaId ? 'proforma' : 'customer',
  )
  const [selectedSo, setSelectedSo] = useState(salesOrderId ?? '')
  const [selectedPi, setSelectedPi] = useState(proformaId ?? '')
  const [selectedCustomer, setSelectedCustomer] = useState(customerIdParam ?? '')
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setError(null)
    let result: { ok: boolean; error?: string; id?: string }
    if (sourceType === 'sales_order') {
      if (!selectedSo) {
        setError('Select a sales order.')
        return
      }
      if (isApiMode()) {
        const local = createFromSo(selectedSo)
        if (!local.ok || !local.id) {
          setError(local.error ?? 'Could not create invoice')
          return
        }
        const draft = useCrmCommercialStore.getState().getInvoice(local.id)
        if (!draft) {
          setError('Draft invoice missing after create')
          return
        }
        // Remove local-only draft and persist via API
        useCrmCommercialStore.setState((s) => ({
          invoices: s.invoices.filter((i) => i.id !== local.id),
        }))
        result = await apiCreateInvoice({
          customerId: draft.customerId,
          source: draft.source,
          salesOrderId: draft.salesOrderId,
          salesOrderNo: draft.salesOrderNo,
          quotationId: draft.quotationId,
          quotationNo: draft.quotationNo,
          paymentTerms: draft.paymentTerms,
          deliveryTerms: draft.deliveryTerms,
          customerPoNumber: draft.customerPoNumber,
          billingAddress: draft.billingAddress,
          shippingAddress: draft.shippingAddress,
          remarks: draft.remarks,
          customerState: draft.customerState,
          lines: draft.lines,
        })
      } else {
        result = createFromSo(selectedSo)
      }
    } else if (sourceType === 'proforma') {
      if (!selectedPi) {
        setError('Select a proforma invoice.')
        return
      }
      if (isApiMode()) {
        const local = createFromPi(selectedPi)
        if (!local.ok || !local.id) {
          setError(local.error ?? 'Could not create invoice')
          return
        }
        const draft = useCrmCommercialStore.getState().getInvoice(local.id)
        useCrmCommercialStore.setState((s) => ({
          invoices: s.invoices.filter((i) => i.id !== local.id),
        }))
        if (!draft) {
          setError('Draft invoice missing after create')
          return
        }
        result = await apiCreateInvoice({
          customerId: draft.customerId,
          source: draft.source,
          salesOrderId: draft.salesOrderId,
          salesOrderNo: draft.salesOrderNo,
          proformaInvoiceId: draft.proformaInvoiceId,
          proformaNo: draft.proformaNo,
          quotationId: draft.quotationId,
          quotationNo: draft.quotationNo,
          paymentTerms: draft.paymentTerms,
          deliveryTerms: draft.deliveryTerms,
          customerPoNumber: draft.customerPoNumber,
          billingAddress: draft.billingAddress,
          shippingAddress: draft.shippingAddress,
          remarks: draft.remarks,
          customerState: draft.customerState,
          lines: draft.lines,
        })
      } else {
        result = createFromPi(selectedPi)
      }
    } else {
      if (!selectedCustomer) {
        setError('Select a customer.')
        return
      }
      const so = salesOrders.find((s) => s.customerId === selectedCustomer && s.status !== 'open')
      if (so) {
        if (isApiMode()) {
          const local = createFromSo(so.id)
          if (!local.ok || !local.id) {
            setError(local.error ?? 'Could not create invoice')
            return
          }
          const draft = useCrmCommercialStore.getState().getInvoice(local.id)
          useCrmCommercialStore.setState((s) => ({
            invoices: s.invoices.filter((i) => i.id !== local.id),
          }))
          if (!draft) {
            setError('Draft invoice missing after create')
            return
          }
          result = await apiCreateInvoice({
            customerId: draft.customerId,
            source: draft.source,
            salesOrderId: draft.salesOrderId,
            salesOrderNo: draft.salesOrderNo,
            quotationId: draft.quotationId,
            quotationNo: draft.quotationNo,
            paymentTerms: draft.paymentTerms,
            deliveryTerms: draft.deliveryTerms,
            customerPoNumber: draft.customerPoNumber,
            billingAddress: draft.billingAddress,
            shippingAddress: draft.shippingAddress,
            remarks: draft.remarks,
            customerState: draft.customerState,
            lines: draft.lines,
          })
        } else {
          result = createFromSo(so.id)
        }
      } else {
        setError('No confirmed sales order found for this customer. Create an invoice from an SO or proforma instead.')
        return
      }
    }
    if (!result.ok || !result.id) {
      setError(result.error ?? 'Could not create invoice')
      return
    }
    notify.success('Draft invoice created')
    navigate(`/crm/commercial/invoices/${result.id}`)
  }

  const confirmedSos = salesOrders.filter((s) => s.status !== 'open' && s.status !== 'closed')
  const issuedPis = proformas.filter((p) => p.status === 'issued')

  return (
    <OperationalPageShell
      variant="dynamics"
      badge="CRM Commercial"
      title="Create Tax Invoice"
      description="Auto-fills customer, items, taxes, and delivery details from the source document"
      breadcrumbs={[
        { label: 'CRM', to: '/crm' },
        { label: 'Tax Invoices', to: '/crm/commercial/invoices' },
        { label: 'New' },
      ]}
      commandBar={(
        <ErpCommandBar
          sticky={false}
          primaryAction={{ id: 'create', label: 'Create Draft Invoice', icon: Plus, onClick: handleCreate }}
          secondaryActions={[{ id: 'back', label: 'Cancel', onClick: () => navigate('/crm/commercial/invoices') }]}
        />
      )}
    >
      <ErpCardSection title="Source document">
        <ErpFieldRow label="Create from">
          <Select value={sourceType} onChange={(e) => setSourceType(e.target.value as typeof sourceType)}>
            <option value="sales_order">Sales Order</option>
            <option value="proforma">Proforma Invoice</option>
            <option value="customer">Customer (latest SO)</option>
          </Select>
        </ErpFieldRow>
        {sourceType === 'sales_order' ? (
          <ErpFieldRow label="Sales Order" required>
            <Select value={selectedSo} onChange={(e) => setSelectedSo(e.target.value)}>
              <option value="">{SELECT_PLACEHOLDER}</option>
              {confirmedSos.map((so) => (
                <option key={so.id} value={so.id}>
                  {so.salesOrderNo} — {getCustomer(so.customerId)?.customerName ?? so.customerId}
                </option>
              ))}
            </Select>
          </ErpFieldRow>
        ) : null}
        {sourceType === 'proforma' ? (
          <ErpFieldRow label="Proforma" required>
            <Select value={selectedPi} onChange={(e) => setSelectedPi(e.target.value)}>
              <option value="">{SELECT_PLACEHOLDER}</option>
              {issuedPis.map((pi) => (
                <option key={pi.id} value={pi.id}>
                  {pi.proformaNo} — {pi.customerName}
                </option>
              ))}
            </Select>
          </ErpFieldRow>
        ) : null}
        {sourceType === 'customer' ? (
          <ErpFieldRow label="Customer" required>
            <Select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}>
              <option value="">{SELECT_PLACEHOLDER}</option>
              {customers.filter((c) => c.isActive).map((c) => (
                <option key={c.id} value={c.id}>{c.customerName}</option>
              ))}
            </Select>
          </ErpFieldRow>
        ) : null}
        {error ? <p className="col-span-2 text-[13px] text-erp-danger">{error}</p> : null}
        <p className="col-span-2 text-[12px] text-erp-muted">
          Partial invoices are supported: remaining SO quantity stays available for another invoice. Draft invoices can be cancelled before posting.
        </p>
      </ErpCardSection>
    </OperationalPageShell>
  )
}

/** Receive payment against a proforma — form page. */
export function ProformaReceivePaymentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const proforma = useProformaInvoiceStore((s) => (id ? s.getProforma(id) : undefined))
  const allReceipts = useCrmCommercialStore((s) => s.receipts)
  const summary = useMemo(() => {
    if (!proforma) return null
    const amountReceived = allReceipts
      .filter((r) => r.proformaInvoiceId === proforma.id)
      .reduce((s, r) => s + r.amount, 0)
    const totalAmount = proforma.gst.grandTotal
    return {
      totalAmount,
      amountReceived,
      balanceAmount: Math.max(0, totalAmount - amountReceived),
      paymentStatus:
        amountReceived <= 0.009
          ? ('unpaid' as const)
          : amountReceived + 0.009 >= totalAmount
            ? ('fully_paid' as const)
            : ('partially_paid' as const),
    }
  }, [proforma, allReceipts])
  const receive = useCrmCommercialStore((s) => s.receiveProformaPayment)

  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMode, setPaymentMode] = useState<CrmPaymentMode | ''>('')
  const [transactionRef, setTransactionRef] = useState('')
  const [amount, setAmount] = useState('')
  const [remarks, setRemarks] = useState('')
  const [attachmentName, setAttachmentName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!proforma || !summary) {
    return (
      <OperationalPageShell title="Proforma not found">
        <Link to="/sales/proforma-invoices" className="text-sm font-semibold text-erp-primary">Back</Link>
      </OperationalPageShell>
    )
  }

  async function submit() {
    setError(null)
    if (!paymentMode) {
      setError('Select a payment mode.')
      return
    }
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid amount received.')
      return
    }
    const payload = {
      proformaInvoiceId: proforma!.id,
      receiptDate,
      paymentMode,
      transactionRef,
      amount: amt,
      remarks,
      attachmentName,
    }
    const result = isApiMode()
      ? await apiReceiveProformaPayment({
          ...payload,
          customerId: proforma!.customerId,
          proformaNo: proforma!.proformaNo,
          proformaGrandTotal: proforma!.gst.grandTotal,
        })
      : receive(payload)
    if (!result.ok) {
      setError(result.error ?? 'Failed to record receipt')
      return
    }
    notify.success(`Receipt recorded`)
    navigate(`/sales/proforma-invoices/${proforma!.id}`)
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      badge="CRM Commercial"
      title="Receive Payment"
      description={`Against ${proforma.proformaNo} · Balance ${formatCurrency(summary.balanceAmount)}`}
      breadcrumbs={[
        { label: 'Proforma Invoices', to: '/sales/proforma-invoices' },
        { label: proforma.proformaNo, to: `/sales/proforma-invoices/${proforma.id}` },
        { label: 'Receive Payment' },
      ]}
      commandBar={(
        <ErpCommandBar
          sticky={false}
          primaryAction={{ id: 'save', label: 'Save Receipt', icon: Banknote, onClick: submit }}
          secondaryActions={[{ id: 'back', label: 'Cancel', onClick: () => navigate(`/sales/proforma-invoices/${proforma.id}`) }]}
        />
      )}
      insights={[
        { label: 'Proforma Amount', value: formatCurrency(summary.totalAmount), accent: 'blue' },
        { label: 'Received', value: formatCurrency(summary.amountReceived), accent: 'green' },
        { label: 'Balance', value: formatCurrency(summary.balanceAmount), accent: 'amber' },
      ]}
    >
      <ErpCardSection title="Payment receipt">
        <ErpFieldRow label="Receipt Number" readOnly>Auto-generated on save</ErpFieldRow>
        <ErpFieldRow label="Receipt Date" required>
          <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
        </ErpFieldRow>
        <ErpFieldRow label="Customer" readOnly>{proforma.customerName}</ErpFieldRow>
        <ErpFieldRow label="Proforma Reference" readOnly>{proforma.proformaNo}</ErpFieldRow>
        <ErpFieldRow label="Payment Mode" required>
          <Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as CrmPaymentMode | '')}>
            <option value="">{SELECT_PLACEHOLDER}</option>
            {(Object.keys(CRM_PAYMENT_MODE_LABELS) as CrmPaymentMode[]).map((m) => (
              <option key={m} value={m}>{CRM_PAYMENT_MODE_LABELS[m]}</option>
            ))}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow label="Transaction Reference">
          <Input value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} placeholder="UTR / Cheque / UPI ref" />
        </ErpFieldRow>
        <ErpFieldRow label="Amount Received" required>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={String(summary.balanceAmount)}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Remarks">
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} />
        </ErpFieldRow>
        <ErpFieldRow label="Attachment (optional)">
          <Input
            type="file"
            onChange={(e) => setAttachmentName(e.target.files?.[0]?.name ?? null)}
          />
          {attachmentName ? <span className="text-[12px] text-erp-muted">{attachmentName}</span> : null}
        </ErpFieldRow>
        {error ? <p className="col-span-2 text-[13px] text-erp-danger">{error}</p> : null}
      </ErpCardSection>
    </OperationalPageShell>
  )
}

export function CrmPaymentAllocationPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const customers = useMasterStore((s) => s.customers)
  const [customerId, setCustomerId] = useState(params.get('customerId') ?? '')
  const [selectedReceiptId, setSelectedReceiptId] = useState('')
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [allocationDate, setAllocationDate] = useState(new Date().toISOString().slice(0, 10))
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Select stable store slices only — derived filters must be memoized
  // (inline .filter() / [] in Zustand selectors causes infinite re-renders).
  const invoices = useCrmCommercialStore((s) => s.invoices)
  const receipts = useCrmCommercialStore((s) => s.receipts)
  const allocations = useCrmCommercialStore((s) => s.allocations)
  const allocatePayments = useCrmCommercialStore((s) => s.allocatePayments)
  const reverseAllocation = useCrmCommercialStore((s) => s.reverseAllocation)

  const openInvoices = useMemo(
    () =>
      customerId
        ? invoices.filter(
            (i) =>
              i.customerId === customerId
              && i.status !== 'draft'
              && i.status !== 'cancelled'
              && i.balanceDue > 0.009,
          )
        : [],
    [customerId, invoices],
  )
  const availableReceipts = useMemo(
    () =>
      customerId
        ? receipts.filter((r) => r.customerId === customerId && r.unallocatedAmount > 0.009)
        : [],
    [customerId, receipts],
  )
  const history = useMemo(
    () => (customerId ? allocations.filter((a) => a.customerId === customerId) : []),
    [customerId, allocations],
  )
  const selectedReceipt = useMemo(
    () => (selectedReceiptId ? receipts.find((r) => r.id === selectedReceiptId) : undefined),
    [selectedReceiptId, receipts],
  )

  const preInvoiceId = params.get('invoiceId')

  async function submit() {
    setError(null)
    if (!selectedReceiptId) {
      setError('Select a receipt to allocate.')
      return
    }
    const allocationsPayload = Object.entries(amounts)
      .map(([invoiceId, raw]) => ({ invoiceId, amount: Number(raw) }))
      .filter((row) => Number.isFinite(row.amount) && row.amount > 0)
    if (!allocationsPayload.length) {
      setError('Enter at least one allocation amount.')
      return
    }
    const payload = {
      receiptId: selectedReceiptId,
      allocations: allocationsPayload,
      allocationDate,
      remarks,
    }
    const result = isApiMode()
      ? await apiAllocatePayments(payload)
      : allocatePayments(payload)
    if (!result.ok) {
      setError(result.error ?? 'Allocation failed')
      return
    }
    notify.success('Payment allocated')
    setAmounts({})
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      badge="CRM Commercial"
      title="Payment Allocation"
      description="Allocate customer receipts against one or more open invoices"
      breadcrumbs={[
        { label: 'CRM', to: '/crm' },
        { label: 'Payment Allocation' },
      ]}
      favoritePath="/crm/commercial/payment-allocation"
      commandBar={(
        <ErpCommandBar
          sticky={false}
          primaryAction={
            canCrmPermission('crm.commercial.allocation.create')
              ? { id: 'alloc', label: 'Allocate', icon: ArrowLeftRight, onClick: submit }
              : undefined
          }
          secondaryActions={[
            { id: 'invoices', label: 'Invoices', icon: FileText, onClick: () => navigate('/crm/commercial/invoices') },
            { id: 'orders', label: 'Sales Orders', icon: ShoppingCart, onClick: () => navigate('/crm/sales-orders') },
          ]}
        />
      )}
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <ErpCardSection title="Select customer & receipt">
          <ErpFieldRow label="Customer" required>
            <Select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setSelectedReceiptId(''); setAmounts({}) }}>
              <option value="">{SELECT_PLACEHOLDER}</option>
              {customers.filter((c) => c.isActive).map((c) => (
                <option key={c.id} value={c.id}>{c.customerName}</option>
              ))}
            </Select>
          </ErpFieldRow>
          <ErpFieldRow label="Available receipt">
            <Select value={selectedReceiptId} onChange={(e) => setSelectedReceiptId(e.target.value)}>
              <option value="">{SELECT_PLACEHOLDER}</option>
              {availableReceipts.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.receiptNo} · unallocated {formatCurrency(r.unallocatedAmount)}
                  {r.proformaNo ? ` · ${r.proformaNo}` : ''}
                </option>
              ))}
            </Select>
          </ErpFieldRow>
          {selectedReceipt ? (
            <ErpFieldRow label="Unallocated" readOnly>{formatCurrency(selectedReceipt.unallocatedAmount)}</ErpFieldRow>
          ) : null}
          <ErpFieldRow label="Allocation date">
            <Input type="date" value={allocationDate} onChange={(e) => setAllocationDate(e.target.value)} />
          </ErpFieldRow>
          <ErpFieldRow label="Remarks">
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
          </ErpFieldRow>
          {error ? <p className="col-span-2 text-[13px] text-erp-danger">{error}</p> : null}
        </ErpCardSection>

        <ErpCardSection title="Open invoices">
          <div className="col-span-2 space-y-2">
            {!customerId ? (
              <p className="text-[13px] text-erp-muted">Select a customer to see open invoices.</p>
            ) : openInvoices.length === 0 ? (
              <p className="text-[13px] text-erp-muted">No open invoices for this customer.</p>
            ) : (
              openInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className={cn(
                    'rounded border border-erp-border p-3 text-[13px]',
                    preInvoiceId === inv.id && 'border-erp-primary bg-erp-primary/5',
                  )}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <TableLink to={`/crm/commercial/invoices/${inv.id}`}>{inv.invoiceNo}</TableLink>
                    <StatusDot label={CRM_TAX_INVOICE_STATUS_LABELS[inv.status]} tone={invoiceTone(inv.status)} />
                  </div>
                  <div className="mb-2 grid grid-cols-3 gap-2 text-[12px] text-erp-muted">
                    <span>Invoice {formatCurrency(inv.gst.grandTotal)}</span>
                    <span>Allocated {formatCurrency(inv.amountPaid)}</span>
                    <span>Balance {formatCurrency(inv.balanceDue)}</span>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder={`Allocate up to ${inv.balanceDue}`}
                    value={amounts[inv.id] ?? ''}
                    onChange={(e) => setAmounts((prev) => ({ ...prev, [inv.id]: e.target.value }))}
                  />
                </div>
              ))
            )}
          </div>
        </ErpCardSection>
      </div>

      <ErpCardSection title="Allocation history" className="mt-6">
        <div className="col-span-2 overflow-x-auto">
          {history.length === 0 ? (
            <p className="text-[13px] text-erp-muted">No allocations yet for this customer.</p>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-erp-border text-erp-muted">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Receipt</th>
                  <th className="py-2 pr-3">Invoice</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((a) => (
                  <tr key={a.id} className="border-b border-erp-border/60">
                    <td className="py-2 pr-3">{formatDate(a.allocationDate)}</td>
                    <td className="py-2 pr-3">{a.receiptNo}</td>
                    <td className="py-2 pr-3">{a.invoiceNo}</td>
                    <td className="py-2 pr-3">
                      {formatCurrency(a.amount)}
                      {a.reversedAt ? <span className="ml-1 text-erp-danger">(Reversed)</span> : null}
                    </td>
                    <td className="py-2">
                      {!a.reversedAt && canCrmPermission('crm.commercial.allocation.reverse') ? (
                        <ErpButton
                          variant="ghost"
                          onClick={() => {
                            void (async () => {
                              const r = isApiMode()
                                ? await apiReverseAllocation(a.id)
                                : reverseAllocation(a.id)
                              if (!r.ok) notify.error(r.error ?? 'Reverse failed')
                              else notify.success('Allocation reversed')
                            })()
                          }}
                        >
                          Reverse
                        </ErpButton>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </ErpCardSection>
    </OperationalPageShell>
  )
}

export function CrmReceiptDetailPage() {
  const { id } = useParams()
  const receipt = useCrmCommercialStore((s) => (id ? s.receipts.find((r) => r.id === id) : undefined))
  const allAllocations = useCrmCommercialStore((s) => s.allocations)
  const allocations = useMemo(
    () => (id ? allAllocations.filter((a) => a.receiptId === id && !a.reversedAt) : []),
    [allAllocations, id],
  )
  const navigate = useNavigate()

  if (!receipt) {
    return (
      <OperationalPageShell title="Receipt not found">
        <Link to="/crm/commercial/payment-allocation" className="text-sm font-semibold text-erp-primary">Back</Link>
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      badge="CRM Commercial"
      title={receipt.receiptNo}
      description={`${receipt.customerName} · ${CRM_PAYMENT_MODE_LABELS[receipt.paymentMode]}`}
      breadcrumbs={[
        { label: 'CRM', to: '/crm' },
        { label: 'Payment Allocation', to: '/crm/commercial/payment-allocation' },
        { label: receipt.receiptNo },
      ]}
      commandBar={(
        <ErpCommandBar
          sticky={false}
          primaryAction={{
            id: 'alloc',
            label: 'Allocate',
            icon: ArrowLeftRight,
            onClick: () => navigate(`/crm/commercial/payment-allocation?customerId=${receipt.customerId}`),
          }}
        />
      )}
      insights={[
        { label: 'Amount', value: formatCurrency(receipt.amount), accent: 'blue' },
        { label: 'Unallocated', value: formatCurrency(receipt.unallocatedAmount), accent: 'amber' },
        { label: 'Date', value: formatDate(receipt.receiptDate), accent: 'slate' },
      ]}
    >
      <ErpCardSection title="Receipt details">
        <ErpFieldRow label="Customer" readOnly>
          <TableLink to={salesCustomer360Path(receipt.customerId)}>{receipt.customerName}</TableLink>
        </ErpFieldRow>
        {receipt.proformaInvoiceId ? (
          <ErpFieldRow label="Proforma" readOnly>
            <TableLink to={`/sales/proforma-invoices/${receipt.proformaInvoiceId}`}>{receipt.proformaNo}</TableLink>
          </ErpFieldRow>
        ) : null}
        <ErpFieldRow label="Transaction ref" readOnly>{receipt.transactionRef || '—'}</ErpFieldRow>
        <ErpFieldRow label="Remarks" readOnly>{receipt.remarks || '—'}</ErpFieldRow>
        <ErpFieldRow label="Attachment" readOnly>{receipt.attachmentName || '—'}</ErpFieldRow>
      </ErpCardSection>
      <ErpCardSection title="Allocations" className="mt-4">
        <div className="col-span-2 space-y-2">
          {allocations.length === 0 ? (
            <p className="text-[13px] text-erp-muted">Not allocated to any invoice yet.</p>
          ) : (
            allocations.map((a) => (
              <div key={a.id} className="flex justify-between rounded border border-erp-border px-3 py-2 text-[13px]">
                <span>{a.invoiceNo} · {formatDate(a.allocationDate)}</span>
                <span className="font-semibold">{formatCurrency(a.amount)}</span>
              </div>
            ))
          )}
        </div>
      </ErpCardSection>
    </OperationalPageShell>
  )
}
