import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import {
  ArrowLeft,
  Banknote,
  FileText,
  IndianRupee,
  Plus,
  Printer,
  Receipt,
  Wallet,
} from 'lucide-react'
import {
  DynamicsModuleDashboard,
  DynamicsDashboardPanel,
  DynamicsTabs,
  DynamicsCommandButton,
} from '../../components/dynamics'
import { DocumentHeader } from '../../components/design-system/DocumentExperience'
import { DocumentLayout, FactBox, FactBoxPanel, FastTabs } from '../../components/design-system/FactBox'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { DataTable } from '../../components/tables/DataTable'
import { Badge, statusColor } from '../../components/ui/Badge'
import { AppLink } from '../../components/ui/AppLink'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/forms/Inputs'
import { DetailGrid, DetailField } from '../../components/masters/MasterLayouts'
import { useInvoiceStore } from '../../store/invoiceStore'
import { ApprovalChainPanel } from '../../components/approval/ApprovalChainPanel'
import { SerialGenealogyPanel } from '../../components/serial/SerialGenealogyPanel'
import { EntityDocumentsPanel } from '../../components/dms/EntityDocumentsPanel'
import { DocumentHealthBadge, NextBestActionPanel, LiveStatusLabel } from '../../components/live-erp'
import { buildInvoiceNextActions, computeInvoiceHealth } from '../../utils/liveErpMetrics'
import { useDispatchStore } from '../../store/dispatchStore'
import type { InvoiceCandidate, PaymentMode, ReceivableRow, SalesInvoice } from '../../types/invoice'
import { paymentStatusLabel } from '../../types/invoice'
import { COMPANY_GSTIN, COMPANY_NAME, COMPANY_STATE } from '../../types/invoice'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { gstSchemeLabel } from '../../utils/gstEngine'
import { amountInWords } from '../../utils/amountInWords'
import { TaxInvoiceDocument, printTaxInvoice } from '../../components/invoice/TaxInvoiceDocument'

function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
      {message}
    </div>
  )
}

function useToast() {
  const [toast, setToast] = useState<string | null>(null)
  function show(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }
  return { toast, show }
}

function paymentStatusColor(status: string): 'green' | 'red' | 'yellow' | 'orange' | 'blue' | 'gray' {
  if (status === 'paid') return 'green'
  if (status === 'overdue') return 'red'
  if (status === 'partial') return 'orange'
  if (status === 'unpaid') return 'yellow'
  return 'gray'
}

type InvoiceTab = 'invoices' | 'create' | 'receivables'

// ─── Dashboard ───────────────────────────────────────────────────────────────

export function InvoiceDashboardPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<InvoiceTab>('invoices')
  const invoices = useInvoiceStore((s) => s.invoices)
  const dispatches = useDispatchStore((s) => s.dispatches)

  const metrics = useMemo(
    () => useInvoiceStore.getState().getMetrics(),
    [invoices, dispatches],
  )
  const receivables = useMemo(
    () => useInvoiceStore.getState().getReceivables(),
    [invoices],
  )
  const candidates = useMemo(
    () => useInvoiceStore.getState().getInvoiceCandidates(),
    [invoices, dispatches],
  )

  const createFromDispatch = useInvoiceStore((s) => s.createFromDispatch)
  const { toast, show } = useToast()

  const invoiceColumns: ColumnDef<SalesInvoice, unknown>[] = [
    {
      accessorKey: 'invoiceNo',
      header: 'Invoice No',
      cell: ({ row }) => (
        <Link to={`/invoices/${row.original.id}`} className="font-mono text-xs font-medium text-erp-accent hover:underline">
          {row.original.invoiceNo}
        </Link>
      ),
    },
    { accessorKey: 'customerName', header: 'Customer' },
    { accessorKey: 'salesOrderNo', header: 'SO', cell: ({ row }) => <span className="font-mono text-xs">{row.original.salesOrderNo}</span> },
    { accessorKey: 'dispatchNo', header: 'Dispatch', cell: ({ row }) => <span className="font-mono text-xs">{row.original.dispatchNo}</span> },
    {
      id: 'total',
      header: 'Total',
      cell: ({ row }) => formatCurrency(row.original.gst.grandTotal),
    },
    {
      accessorKey: 'paymentStatus',
      header: 'Payment',
      cell: ({ row }) => (
        <Badge color={paymentStatusColor(row.original.paymentStatus)}>
          {paymentStatusLabel(row.original.paymentStatus)}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge color={statusColor(row.original.status)}>{row.original.status}</Badge>,
    },
  ]

  const receivableColumns: ColumnDef<ReceivableRow, unknown>[] = [
    {
      accessorKey: 'invoiceNo',
      header: 'Invoice',
      cell: ({ row }) => (
        <Link to={`/invoices/${row.original.invoiceId}`} className="font-mono text-xs text-erp-accent hover:underline">
          {row.original.invoiceNo}
        </Link>
      ),
    },
    { accessorKey: 'customerName', header: 'Customer' },
    { accessorKey: 'dueDate', header: 'Due', cell: ({ row }) => formatDate(row.original.dueDate) },
    { accessorKey: 'grandTotal', header: 'Invoiced', cell: ({ row }) => formatCurrency(row.original.grandTotal) },
    { accessorKey: 'amountPaid', header: 'Paid', cell: ({ row }) => formatCurrency(row.original.amountPaid) },
    {
      accessorKey: 'balanceDue',
      header: 'Receivable',
      cell: ({ row }) => (
        <span className={row.original.balanceDue > 0 ? 'font-medium text-amber-700' : 'text-emerald-600'}>
          {formatCurrency(row.original.balanceDue)}
        </span>
      ),
    },
    {
      accessorKey: 'paymentStatus',
      header: 'Payment Status',
      cell: ({ row }) => (
        <Badge color={paymentStatusColor(row.original.paymentStatus)}>
          {paymentStatusLabel(row.original.paymentStatus)}
        </Badge>
      ),
    },
  ]

  const candidateColumns: ColumnDef<InvoiceCandidate, unknown>[] = [
    { accessorKey: 'dispatchNo', header: 'Dispatch', cell: ({ row }) => <span className="font-mono text-xs">{row.original.dispatchNo}</span> },
    { accessorKey: 'customerName', header: 'Customer' },
    { accessorKey: 'productCode', header: 'Product', cell: ({ row }) => <span className="font-mono text-xs">{row.original.productCode}</span> },
    { accessorKey: 'qty', header: 'Qty', cell: ({ row }) => formatNumber(row.original.qty) },
    { accessorKey: 'unitPrice', header: 'Unit Price', cell: ({ row }) => formatCurrency(row.original.unitPrice) },
    {
      id: 'action',
      header: '',
      cell: ({ row }) => (
        <Button
          size="sm"
          onClick={() => {
            const r = createFromDispatch(row.original.dispatchId)
            if (r.ok && r.id) {
              show('Draft invoice created')
              navigate(`/invoices/${r.id}`)
            } else {
              show(r.error ?? 'Failed')
            }
          }}
        >
          Create Invoice
        </Button>
      ),
    },
  ]

  const tabs: { id: InvoiceTab; label: string }[] = [
    { id: 'invoices', label: 'Invoices' },
    { id: 'create', label: 'Create from Dispatch' },
    { id: 'receivables', label: 'Receivables' },
  ]

  return (
    <>
      <Toast message={toast} />
      <DynamicsModuleDashboard
        title="Finance & Invoicing"
        subtitle="GST tax invoices, accounts receivable, and payment tracking"
        badge="Finance"
        favoritePath="/invoices/register"
        healthScore={metrics.overdueCount > 3 ? 68 : metrics.overdueCount > 0 ? 78 : 92}
        heroMetrics={[
          { id: 'invoiced', label: 'Total Invoiced', value: formatCurrency(metrics.totalInvoiced), icon: Receipt, accent: 'blue' },
          { id: 'recv', label: 'Receivable', value: formatCurrency(metrics.totalReceivable), icon: Wallet, accent: 'amber' },
          { id: 'collected', label: 'Collected', value: formatCurrency(metrics.totalCollected), icon: IndianRupee, accent: 'green' },
          { id: 'overdue', label: 'Overdue Invoices', value: metrics.overdueCount, icon: Banknote, accent: metrics.overdueCount ? 'red' : 'green', helper: `${metrics.unpaidCount} unpaid` },
        ]}
        actions={
          <Button size="sm" onClick={() => setTab('create')}>
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        }
        quickActions={
          <>
            <DynamicsCommandButton primary icon={<Plus className="h-4 w-4" />} onClick={() => setTab('create')}>
              New Invoice
            </DynamicsCommandButton>
            <DynamicsCommandButton onClick={() => setTab('receivables')}>Receivables</DynamicsCommandButton>
            <DynamicsCommandButton onClick={() => setTab('invoices')}>Invoice Register</DynamicsCommandButton>
          </>
        }
        kpiStrip={[
          { label: 'Outstanding AR', value: formatCurrency(metrics.totalReceivable), tone: metrics.totalReceivable > 0 ? 'warning' : 'success' },
          { label: 'Collected', value: formatCurrency(metrics.totalCollected), tone: 'success' },
          { label: 'Unpaid', value: metrics.unpaidCount, tone: metrics.unpaidCount ? 'critical' : 'success' },
        ]}
      >
        <DynamicsTabs
          items={tabs.map((t) => ({ label: t.label, path: t.id }))}
          activePath={tab}
          onChange={(id) => setTab(id as InvoiceTab)}
        />

        {tab === 'invoices' && (
          <DynamicsDashboardPanel title="Tax Invoices" noPadding>
            {invoices.length === 0 ? (
              <p className="dyn-empty-hint">No invoices yet. Create from a dispatched delivery.</p>
            ) : (
              <DataTable data={invoices.filter((i) => i.status !== 'cancelled')} columns={invoiceColumns} />
            )}
          </DynamicsDashboardPanel>
        )}

        {tab === 'create' && (
          <DynamicsDashboardPanel title="Create Invoice from Dispatch" noPadding>
            {candidates.length === 0 ? (
              <p className="dyn-empty-hint">No dispatched deliveries pending invoice. Confirm dispatch first.</p>
            ) : (
              <DataTable data={candidates} columns={candidateColumns} />
            )}
          </DynamicsDashboardPanel>
        )}

        {tab === 'receivables' && (
          <DynamicsDashboardPanel
            title="Accounts Receivable"
            actions={<Wallet className="h-4 w-4 text-erp-muted" />}
            noPadding
          >
            {receivables.length === 0 ? (
              <p className="dyn-empty-hint">No posted invoices — receivables appear after posting.</p>
            ) : (
              <DataTable data={receivables} columns={receivableColumns} />
            )}
          </DynamicsDashboardPanel>
        )}
      </DynamicsModuleDashboard>
    </>
  )
}

type InvoiceDetailTab = 'summary' | 'tax-invoice' | 'receivable'

// ─── Invoice Detail ──────────────────────────────────────────────────────────

export function InvoiceDetailPage() {
  const { id } = useParams()
  const { toast, show } = useToast()
  const [tab, setTab] = useState<InvoiceDetailTab>('summary')
  const invoices = useInvoiceStore((s) => s.invoices)
  const postInvoice = useInvoiceStore((s) => s.postInvoice)
  const recordPayment = useInvoiceStore((s) => s.recordPayment)

  const invoice = useMemo(
    () => (id ? useInvoiceStore.getState().getInvoice(id) : undefined),
    [id, invoices],
  )

  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [payRef, setPayRef] = useState('')
  const [payMode, setPayMode] = useState<PaymentMode>('neft')

  if (!invoice) {
    return (
      <div className="p-8 text-center text-slate-500">
        Invoice not found.{' '}
        <Link to="/invoices/register" className="text-erp-accent hover:underline">
          Back
        </Link>
      </div>
    )
  }

  const { gst } = invoice
  const invoiceHealth = computeInvoiceHealth(invoice)
  const invoiceNextActions = buildInvoiceNextActions(invoice)
  const invoiceStatusMessage =
    invoice.paymentStatus === 'overdue'
      ? `Payment overdue — ${formatCurrency(invoice.balanceDue)} outstanding`
      : invoice.status === 'draft'
        ? 'Draft invoice — post to receivable when ready'
        : invoice.paymentStatus === 'partial'
          ? `Partial payment received — ${formatCurrency(invoice.balanceDue)} balance due`
          : undefined

  const detailTabs: { id: InvoiceDetailTab; label: string }[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'tax-invoice', label: 'Tax Invoice' },
    { id: 'receivable', label: 'Receivable & Payments' },
  ]

  const docActions = (
    <div className="flex flex-wrap gap-2">
      <Link to="/invoices/register">
        <Button variant="secondary" size="sm">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </Link>
      <Button variant="secondary" size="sm" onClick={() => { setTab('tax-invoice'); setTimeout(printTaxInvoice, 200) }}>
        <Printer className="h-4 w-4" />
        Print Tax Invoice
      </Button>
      {invoice.status === 'draft' && (
        <Button size="sm" onClick={() => { const r = postInvoice(invoice.id); show(r.ok ? 'Invoice posted to receivable' : r.error ?? 'Failed') }}>
          <FileText className="h-4 w-4" />
          Post Invoice
        </Button>
      )}
    </div>
  )

  return (
    <div className="erp-page">
      <Toast message={toast} />
      <div className="no-print">
        <DocumentHeader
          docNo={invoice.invoiceNo}
          docType="Tax Invoice"
          status={invoice.status}
          createdDate={formatDate(invoice.invoiceDate)}
          actions={docActions}
        />
        <DocumentLayout
          main={
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <DocumentHealthBadge health={invoiceHealth} />
                <Badge color={statusColor(invoice.status)}>{invoice.status}</Badge>
                <Badge color={paymentStatusColor(invoice.paymentStatus)}>
                  {paymentStatusLabel(invoice.paymentStatus)}
                </Badge>
                {invoiceStatusMessage && (
                  <LiveStatusLabel message={invoiceStatusMessage} variant={invoice.paymentStatus === 'overdue' ? 'danger' : 'warning'} />
                )}
              </div>

              <div className="mb-4 max-w-md">
                <NextBestActionPanel actions={invoiceNextActions} title="Next Best Actions" compact />
              </div>

              <div className="mb-4">
                <ApprovalChainPanel documentType="invoice_cancellation" entityId={invoice.id} />
              </div>

              <div className="mb-4">
                <SerialGenealogyPanel customerId={invoice.customerId} trailerNo={invoice.lines[0]?.trailerNo} compact />
              </div>

              <div className="mb-4">
                <EntityDocumentsPanel entityType="invoice" entityId={invoice.id} entityLabel={invoice.invoiceNo} />
              </div>

              <FastTabs tabs={detailTabs} active={tab} onChange={(id) => setTab(id as InvoiceDetailTab)} />

      {(tab === 'summary' || tab === 'receivable') && (
        <div>
          {tab === 'summary' && (
            <>
              <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Invoice Lines</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                          <th className="px-4 py-2">Item</th>
                          <th className="px-4 py-2">Trailer No</th>
                          <th className="px-4 py-2">Chassis No</th>
                          <th className="px-4 py-2">HSN</th>
                          <th className="px-4 py-2 text-right">Qty</th>
                          <th className="px-4 py-2 text-right">Rate</th>
                          <th className="px-4 py-2 text-right">Taxable</th>
                          <th className="px-4 py-2 text-right">GST %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-erp-border">
                        {invoice.lines.map((line) => (
                          <tr key={line.id}>
                            <td className="px-4 py-2">
                              <span className="font-mono text-xs">{line.itemCode}</span>
                              <p className="text-xs text-slate-500">{line.description}</p>
                            </td>
                            <td className="px-4 py-2 font-mono text-xs">{line.trailerNo || '—'}</td>
                            <td className="px-4 py-2 font-mono text-xs">{line.chassisNo || '—'}</td>
                            <td className="px-4 py-2 font-mono text-xs">{line.hsnCode}</td>
                            <td className="px-4 py-2 text-right">{formatNumber(line.qty)}</td>
                            <td className="px-4 py-2 text-right font-mono">{formatCurrency(line.unitPrice)}</td>
                            <td className="px-4 py-2 text-right font-mono">{formatCurrency(line.taxableAmount)}</td>
                            <td className="px-4 py-2 text-right">{line.gstRate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>GST Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="text-xs text-slate-500">{gstSchemeLabel(gst.scheme)}</p>
                    <div className="flex justify-between">
                      <span>Taxable Amount</span>
                      <span className="font-mono">{formatCurrency(gst.taxableAmount)}</span>
                    </div>
                    {gst.scheme === 'cgst_sgst' ? (
                      <>
                        <div className="flex justify-between">
                          <span>CGST @ {gst.cgstRate}%</span>
                          <span className="font-mono">{formatCurrency(gst.cgstAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>SGST @ {gst.sgstRate}%</span>
                          <span className="font-mono">{formatCurrency(gst.sgstAmount)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between">
                        <span>IGST @ {gst.igstRate}%</span>
                        <span className="font-mono">{formatCurrency(gst.igstAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-erp-border pt-2 font-medium">
                      <span>Grand Total</span>
                      <span className="font-mono text-base">{formatCurrency(gst.grandTotal)}</span>
                    </div>
                    <p className="border-t border-erp-border pt-2 text-xs italic text-slate-600">
                      {amountInWords(gst.grandTotal)}
                    </p>
                    <div className="mt-4 border-t border-erp-border pt-3 text-xs text-slate-500">
                      <p>{COMPANY_NAME} · {COMPANY_STATE} ({COMPANY_GSTIN})</p>
                      <p>Bill to: {invoice.customerState} ({invoice.customerGstin})</p>
                      {invoice.lrNo && <p>LR: {invoice.lrNo} · Vehicle: {invoice.vehicleNo}</p>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {tab === 'receivable' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Receivable</CardTitle>
                </CardHeader>
                <CardContent>
                  <DetailGrid>
                    <DetailField label="Invoice Date" value={formatDate(invoice.invoiceDate)} />
                    <DetailField label="Due Date" value={formatDate(invoice.dueDate)} />
                    <DetailField label="Credit Days" value={`${invoice.creditDays} days`} />
                    <DetailField label="Amount Paid" value={formatCurrency(invoice.amountPaid)} />
                    <DetailField
                      label="Balance Due"
                      value={
                        <span className={invoice.balanceDue > 0 ? 'font-medium text-amber-700' : 'text-emerald-600'}>
                          {formatCurrency(invoice.balanceDue)}
                        </span>
                      }
                    />
                    <DetailField label="Payment Status" value={paymentStatusLabel(invoice.paymentStatus)} />
                  </DetailGrid>
                </CardContent>
              </Card>

              {invoice.status === 'posted' && invoice.balanceDue > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Record Payment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Amount</label>
                      <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={String(invoice.balanceDue)} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Payment Date</label>
                      <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Reference No</label>
                      <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="UTR / Cheque no" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Mode</label>
                      <Select value={payMode} onChange={(e) => setPayMode(e.target.value as PaymentMode)}>
                        <option value="neft">NEFT</option>
                        <option value="rtgs">RTGS</option>
                        <option value="cheque">Cheque</option>
                        <option value="upi">UPI</option>
                        <option value="cash">Cash</option>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        const amount = parseFloat(payAmount) || invoice.balanceDue
                        const r = recordPayment(invoice.id, {
                          amount,
                          paymentDate: payDate,
                          referenceNo: payRef || `PAY-${Date.now()}`,
                          mode: payMode,
                        })
                        show(r.ok ? 'Payment recorded' : r.error ?? 'Failed')
                        if (r.ok) setPayAmount('')
                      }}
                    >
                      <Banknote className="h-4 w-4" />
                      Record Payment
                    </Button>
                  </CardContent>
                </Card>
              )}

              {invoice.payments.length > 0 && (
                <Card className={invoice.status !== 'posted' || invoice.balanceDue <= 0 ? 'lg:col-span-2' : ''}>
                  <CardHeader>
                    <CardTitle>Payment History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="divide-y divide-erp-border">
                      {invoice.payments.map((p) => (
                        <li key={p.id} className="flex justify-between py-2 text-sm">
                          <span>
                            {formatDate(p.paymentDate)} · {p.mode.toUpperCase()} · {p.referenceNo}
                          </span>
                          <span className="font-mono font-medium text-emerald-700">{formatCurrency(p.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
            </>
          }
          factBoxes={
            <FactBoxPanel>
              <FactBox
                title="Details"
                fields={[
                  { label: 'Customer', value: invoice.customerName },
                  { label: 'Invoice Date', value: formatDate(invoice.invoiceDate) },
                  { label: 'Due Date', value: formatDate(invoice.dueDate) },
                  { label: 'Credit Days', value: `${invoice.creditDays} days` },
                  { label: 'Lines', value: invoice.lines.length },
                ]}
              />
              <FactBox
                title="Amounts"
                fields={[
                  { label: 'Taxable', value: formatCurrency(gst.taxableAmount) },
                  { label: 'Grand Total', value: formatCurrency(gst.grandTotal) },
                  { label: 'Amount Paid', value: formatCurrency(invoice.amountPaid) },
                  { label: 'Balance Due', value: formatCurrency(invoice.balanceDue) },
                  { label: 'Payment', value: paymentStatusLabel(invoice.paymentStatus) },
                ]}
              />
              <FactBox
                title="Links"
                fields={[
                  { label: 'Sales Order', value: <AppLink to={`/sales/orders/${invoice.salesOrderId}`}>{invoice.salesOrderNo}</AppLink> },
                  { label: 'Dispatch', value: <AppLink to={`/dispatch/${invoice.dispatchId}`}>{invoice.dispatchNo}</AppLink> },
                  { label: 'GST Scheme', value: gstSchemeLabel(gst.scheme) },
                ]}
              />
            </FactBoxPanel>
          }
        />
      </div>

      {tab === 'tax-invoice' && (
        <TaxInvoiceDocument invoice={invoice} className="mx-auto max-w-4xl" />
      )}
    </div>
  )
}
