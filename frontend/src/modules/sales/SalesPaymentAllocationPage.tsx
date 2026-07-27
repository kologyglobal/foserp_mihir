/**
 * Sales Payment Allocation workspace — allocate customer receipts against open tax invoices.
 * Aligns with Tax Invoice / Proforma register chrome (Dynamics shell, KPI strip, command bar).
 */
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeftRight,
  FileText,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Wallet,
  Wand2,
} from 'lucide-react'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { StatusDot } from '../../components/design-system/StatusDot'
import type { StatusDotTone } from '../../components/design-system/StatusDot'
import { ENTERPRISE_FORM_CLASS } from '../../design-system/workspace'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { ErpButton } from '../../components/erp/ErpButton'
import { ErpCardSection, ErpFieldRow } from '../../components/erp/card-form'
import { Select, Input, Textarea } from '../../components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '../../components/forms/selectStandards'
import { TableLink } from '../../components/ui/AppLink'
import { EmptyState } from '../../components/ui/EmptyState'
import { SALES_CUSTOMER_360_HUB, salesCustomer360Path } from '../../config/entity360Routes'
import { isApiMode } from '../../config/apiConfig'
import { useCrmCommercialStore } from '../../store/crmCommercialStore'
import { useMasterStore } from '../../store/masterStore'
import { notify } from '../../store/toastStore'
import {
  apiAllocatePayments,
  apiReverseAllocation,
} from '../../services/bridges/crmCommercialApiBridge'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { canCrmPermission } from '../../utils/permissions/crm'
import { salesModuleBreadcrumbs } from '../../utils/salesNavigation'
import { buildPaymentAllocationWorkspaceKpis } from '../../utils/salesModuleKpis'
import { cn } from '../../utils/cn'
import type { CrmTaxInvoice, CrmTaxInvoiceStatus } from '../../types/crmCommercial'
import {
  CRM_PAYMENT_MODE_LABELS,
  CRM_TAX_INVOICE_STATUS_LABELS,
} from '../../types/crmCommercial'

function invoiceTone(status: CrmTaxInvoiceStatus): StatusDotTone {
  if (status === 'paid') return 'success'
  if (status === 'partially_paid' || status === 'posted') return 'warning'
  if (status === 'cancelled') return 'danger'
  return 'neutral'
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function isInvoiceOverdue(inv: CrmTaxInvoice): boolean {
  if (inv.status === 'cancelled' || inv.status === 'paid' || inv.status === 'draft') return false
  if (inv.balanceDue <= 0.009) return false
  return inv.dueDate.slice(0, 10) < todayIso()
}

function parseAmount(raw: string | undefined): number {
  if (!raw?.trim()) return 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

/** Apply receipt unallocated FIFO: overdue first, then earliest due date. */
function suggestAllocationAmounts(
  openInvoices: CrmTaxInvoice[],
  unallocated: number,
): Record<string, string> {
  let remaining = unallocated
  const sorted = [...openInvoices].sort((a, b) => {
    const aOver = isInvoiceOverdue(a) ? 0 : 1
    const bOver = isInvoiceOverdue(b) ? 0 : 1
    if (aOver !== bOver) return aOver - bOver
    return a.dueDate.localeCompare(b.dueDate) || a.invoiceNo.localeCompare(b.invoiceNo)
  })
  const next: Record<string, string> = {}
  for (const inv of sorted) {
    if (remaining <= 0.009) break
    const apply = Math.min(inv.balanceDue, remaining)
    if (apply > 0.009) {
      next[inv.id] = apply.toFixed(2)
      remaining -= apply
    }
  }
  return next
}

function SummaryTile({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'blue' | 'amber' | 'green' | 'slate'
}) {
  const accentClass =
    accent === 'amber'
      ? 'border-amber-200/80 bg-amber-50/60'
      : accent === 'green'
        ? 'border-emerald-200/80 bg-emerald-50/50'
        : accent === 'blue'
          ? 'border-sky-200/80 bg-sky-50/50'
          : 'border-erp-border bg-erp-surface'
  return (
    <div className={cn('min-w-0 rounded-md border px-2.5 py-2', accentClass)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-semibold tabular-nums text-erp-text" title={value}>
        {value}
      </p>
    </div>
  )
}

export function SalesPaymentAllocationPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const customers = useMasterStore((s) => s.customers)
  const [customerId, setCustomerId] = useState(params.get('customerId') ?? '')
  const [selectedReceiptId, setSelectedReceiptId] = useState('')
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [allocationDate, setAllocationDate] = useState(todayIso())
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const invoices = useCrmCommercialStore((s) => s.invoices)
  const receipts = useCrmCommercialStore((s) => s.receipts)
  const allocations = useCrmCommercialStore((s) => s.allocations)
  const allocatePayments = useCrmCommercialStore((s) => s.allocatePayments)
  const reverseAllocation = useCrmCommercialStore((s) => s.reverseAllocation)

  const canCreate = canCrmPermission('crm.commercial.allocation.create')
  const canReverse = canCrmPermission('crm.commercial.allocation.reverse')
  const preInvoiceId = params.get('invoiceId')

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

  const selectedCustomer = useMemo(
    () => (customerId ? customers.find((c) => c.id === customerId) : undefined),
    [customerId, customers],
  )

  const selectedTotal = useMemo(
    () => Object.values(amounts).reduce((sum, raw) => sum + parseAmount(raw), 0),
    [amounts],
  )

  const remaining =
    selectedReceipt != null ? selectedReceipt.unallocatedAmount - selectedTotal : null

  const overReceipt = remaining != null && remaining < -0.009
  const overInvoice = openInvoices.some((inv) => parseAmount(amounts[inv.id]) > inv.balanceDue + 0.009)
  const hasPositiveLine = openInvoices.some((inv) => parseAmount(amounts[inv.id]) > 0.009)
  const canSubmit =
    canCreate
    && Boolean(selectedReceiptId)
    && hasPositiveLine
    && !overReceipt
    && !overInvoice
    && !submitting

  const kpiStrip = useMemo(
    () =>
      buildPaymentAllocationWorkspaceKpis({
        receiptUnallocated: selectedReceipt?.unallocatedAmount ?? 0,
        openInvoiceCount: openInvoices.length,
        selectedTotal,
        remaining,
        hasReceipt: Boolean(selectedReceipt),
      }),
    [selectedReceipt, openInvoices.length, selectedTotal, remaining],
  )

  function resetWorkspace(options?: { keepCustomer?: boolean }) {
    if (!options?.keepCustomer) setCustomerId('')
    setSelectedReceiptId('')
    setAmounts({})
    setAllocationDate(todayIso())
    setRemarks('')
    setError(null)
  }

  function onCustomerChange(nextId: string) {
    setCustomerId(nextId)
    setSelectedReceiptId('')
    setAmounts({})
    setError(null)
  }

  function applySuggested() {
    if (!selectedReceipt) {
      setError('Select a receipt before suggesting allocations.')
      return
    }
    setAmounts(suggestAllocationAmounts(openInvoices, selectedReceipt.unallocatedAmount))
    setError(null)
  }

  function clearAmounts() {
    setAmounts({})
    setError(null)
  }

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
    if (overReceipt) {
      setError('Allocation total exceeds the receipt unallocated balance.')
      return
    }
    if (overInvoice) {
      setError('One or more amounts exceed the invoice balance due.')
      return
    }

    setSubmitting(true)
    try {
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
    } finally {
      setSubmitting(false)
    }
  }

  const allocateDisabledReason = !canCreate
    ? 'You do not have permission to allocate payments'
    : !selectedReceiptId
      ? 'Select a receipt first'
      : !hasPositiveLine
        ? 'Enter at least one allocation amount'
        : overReceipt
          ? 'Total exceeds receipt unallocated balance'
          : overInvoice
            ? 'An amount exceeds invoice balance due'
            : submitting
              ? 'Allocating…'
              : undefined

  return (
    <OperationalPageShell
      variant="dynamics"
      badge="Sales"
      title="Payment Allocation"
      description="Apply unallocated customer receipts against open tax invoices"
      breadcrumbs={salesModuleBreadcrumbs('Payment Allocation', '/sales/payment-allocation')}
      autoBreadcrumbs={false}
      favoritePath="/sales/payment-allocation"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            canCreate
              ? {
                  id: 'alloc',
                  label: submitting ? 'Allocating…' : 'Allocate',
                  icon: ArrowLeftRight,
                  onClick: () => void submit(),
                  disabled: !canSubmit,
                  disabledReason: allocateDisabledReason,
                }
              : undefined
          }
          secondaryActions={[
            {
              id: 'invoices',
              label: 'Tax Invoices',
              icon: FileText,
              onClick: () => navigate('/sales/invoices'),
            },
            {
              id: 'orders',
              label: 'Sales Orders',
              icon: ShoppingCart,
              onClick: () => navigate('/sales/orders'),
            },
            {
              id: 'proforma',
              label: 'Proforma',
              icon: Receipt,
              onClick: () => navigate('/sales/proforma-invoices'),
            },
            {
              id: 'clear',
              label: 'Clear',
              icon: RotateCcw,
              onClick: () => resetWorkspace(),
            },
          ]}
        />
      )}
      kpiStrip={kpiStrip}
      className={cn('enterprise-workspace', ENTERPRISE_FORM_CLASS)}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
        {/* Left: customer + receipt — stacked fields (narrow column; no dotted leaders) */}
        <ErpCardSection
          title="Customer & receipt"
          subtitle="Choose who paid and which receipt to apply"
          columns={1}
          icon={Wallet}
        >
          <ErpFieldRow label="Customer" required horizontal={false} className="min-w-0">
            <Select
              value={customerId}
              onChange={(e) => onCustomerChange(e.target.value)}
            >
              <option value="">{SELECT_PLACEHOLDER}</option>
              {customers
                .filter((c) => c.isActive)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customerName}
                  </option>
                ))}
            </Select>
          </ErpFieldRow>

          {selectedCustomer ? (
            <p className="col-span-full -mt-1 text-[12px] text-erp-muted">
              <TableLink to={salesCustomer360Path(selectedCustomer.id)}>
                Open Customer 360
              </TableLink>
            </p>
          ) : null}

          <ErpFieldRow
            label="Available receipt"
            horizontal={false}
            className="min-w-0"
            hint={!customerId ? 'Select a customer first' : undefined}
          >
            <Select
              value={selectedReceiptId}
              onChange={(e) => {
                setSelectedReceiptId(e.target.value)
                setAmounts({})
                setError(null)
              }}
              disabled={!customerId}
            >
              <option value="">{SELECT_PLACEHOLDER}</option>
              {availableReceipts.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.receiptNo} · unallocated {formatCurrency(r.unallocatedAmount)}
                  {r.proformaNo ? ` · ${r.proformaNo}` : ''}
                </option>
              ))}
            </Select>
          </ErpFieldRow>

          {!customerId ? (
            <div className="col-span-full rounded-md border border-dashed border-erp-border bg-erp-surface-alt/30">
              <EmptyState
                icon={Wallet}
                title="Select a customer"
                description="Choose a customer above to load unallocated receipts and open invoices."
                className="px-4 py-7"
                action={(
                  <ErpButton
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(SALES_CUSTOMER_360_HUB)}
                  >
                    Browse companies
                  </ErpButton>
                )}
              />
            </div>
          ) : availableReceipts.length === 0 ? (
            <div className="col-span-full rounded-md border border-dashed border-erp-border bg-erp-surface-alt/30">
              <EmptyState
                icon={Receipt}
                title="No unallocated receipts"
                description="Receive an advance against a proforma, or check that prior receipts are fully allocated."
                className="px-4 py-7"
                action={(
                  <div className="flex flex-wrap justify-center gap-2">
                    <ErpButton
                      variant="primary"
                      size="sm"
                      onClick={() => navigate('/sales/proforma-invoices')}
                    >
                      Proforma invoices
                    </ErpButton>
                    <ErpButton
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate('/sales/invoices')}
                    >
                      Tax invoices
                    </ErpButton>
                  </div>
                )}
              />
            </div>
          ) : selectedReceipt ? (
            <div className="col-span-full space-y-2.5 rounded-md border border-erp-border bg-erp-surface-alt/25 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                    Selected receipt
                  </p>
                  <p className="truncate text-[13px] font-semibold text-erp-text" title={selectedReceipt.receiptNo}>
                    {selectedReceipt.receiptNo}
                  </p>
                </div>
                <TableLink
                  to={`/sales/receipts/${selectedReceipt.id}`}
                  className="shrink-0 text-[12px]"
                >
                  View receipt
                </TableLink>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SummaryTile
                  label="Receipt amount"
                  value={formatCurrency(selectedReceipt.amount)}
                  accent="blue"
                />
                <SummaryTile
                  label="Unallocated"
                  value={formatCurrency(selectedReceipt.unallocatedAmount)}
                  accent="amber"
                />
                <SummaryTile
                  label="Mode"
                  value={CRM_PAYMENT_MODE_LABELS[selectedReceipt.paymentMode]}
                  accent="slate"
                />
                <SummaryTile
                  label="Date"
                  value={formatDate(selectedReceipt.receiptDate)}
                  accent="slate"
                />
              </div>
              {selectedReceipt.transactionRef ? (
                <div className="rounded-md border border-erp-border bg-erp-surface px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Reference</p>
                  <p
                    className="mt-0.5 truncate text-[13px] font-medium text-erp-text"
                    title={selectedReceipt.transactionRef}
                  >
                    {selectedReceipt.transactionRef}
                  </p>
                </div>
              ) : null}
              {selectedReceipt.proformaInvoiceId && selectedReceipt.proformaNo ? (
                <p className="text-[12px] text-erp-muted">
                  Advance from{' '}
                  <TableLink to={`/sales/proforma-invoices/${selectedReceipt.proformaInvoiceId}`}>
                    {selectedReceipt.proformaNo}
                  </TableLink>
                </p>
              ) : null}
            </div>
          ) : (
            <p className="col-span-full rounded-md border border-dashed border-erp-border bg-erp-surface-alt/20 px-3 py-3 text-[13px] leading-snug text-erp-muted">
              Select a receipt above to review amount, mode, and unallocated balance.
            </p>
          )}

          <ErpFieldRow label="Allocation date" horizontal={false} className="min-w-0">
            <Input
              type="date"
              value={allocationDate}
              onChange={(e) => setAllocationDate(e.target.value)}
            />
          </ErpFieldRow>
          <ErpFieldRow label="Remarks" horizontal={false} className="min-w-0">
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder="Optional note for this allocation"
            />
          </ErpFieldRow>

          {error ? (
            <p className="col-span-full text-[13px] text-erp-danger" role="alert">
              {error}
            </p>
          ) : null}
        </ErpCardSection>

        {/* Right: open invoices */}
        <ErpCardSection
          title="Open invoices"
          subtitle={
            customerId
              ? `${openInvoices.length} invoice${openInvoices.length === 1 ? '' : 's'} with balance due`
              : 'Balances available for allocation'
          }
          columns={1}
          icon={FileText}
          badge={
            selectedReceipt && remaining != null ? (
              <span
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                  overReceipt
                    ? 'bg-erp-danger/10 text-erp-danger'
                    : remaining < 0.009
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-900',
                )}
              >
                Remaining {formatCurrency(remaining)}
              </span>
            ) : null
          }
        >
          <div className="col-span-full space-y-3">
            {customerId && openInvoices.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <ErpButton
                  variant="secondary"
                  icon={Wand2}
                  onClick={applySuggested}
                  disabled={!selectedReceipt || !canCreate}
                  disabledReason={!selectedReceipt ? 'Select a receipt first' : undefined}
                >
                  Suggest allocate
                </ErpButton>
                <ErpButton
                  variant="ghost"
                  onClick={clearAmounts}
                  disabled={Object.keys(amounts).length === 0}
                >
                  Clear amounts
                </ErpButton>
                <span className="ml-auto text-[12px] text-erp-muted">
                  Selected{' '}
                  <strong className="tabular-nums text-erp-text">{formatCurrency(selectedTotal)}</strong>
                </span>
              </div>
            ) : null}

            {!customerId ? (
              <EmptyState
                icon={FileText}
                title="No customer selected"
                description="Select a customer on the left to list open tax invoices for allocation."
              />
            ) : openInvoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No open invoices"
                description="This customer has no posted invoices with an outstanding balance."
                action={(
                  <button
                    type="button"
                    className="erp-btn erp-btn--secondary text-[13px]"
                    onClick={() => navigate('/sales/invoices')}
                  >
                    View tax invoices
                  </button>
                )}
              />
            ) : (
              <div className="overflow-x-auto rounded-md border border-erp-border">
                <table className="w-full min-w-[640px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-erp-border bg-erp-surface-alt/50 text-[11px] uppercase tracking-wide text-erp-muted">
                      <th className="px-3 py-2.5 font-medium">Invoice</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium">Due</th>
                      <th className="px-3 py-2.5 text-right font-medium">Invoice</th>
                      <th className="px-3 py-2.5 text-right font-medium">Paid</th>
                      <th className="px-3 py-2.5 text-right font-medium">Balance</th>
                      <th className="px-3 py-2.5 font-medium">Allocate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openInvoices.map((inv) => {
                      const overdue = isInvoiceOverdue(inv)
                      const lineAmt = parseAmount(amounts[inv.id])
                      const lineOver = lineAmt > inv.balanceDue + 0.009
                      const highlighted = preInvoiceId === inv.id
                      return (
                        <tr
                          key={inv.id}
                          className={cn(
                            'border-b border-erp-border/60 last:border-0',
                            highlighted && 'bg-erp-primary/5',
                            overdue && !highlighted && 'bg-rose-50/40',
                          )}
                        >
                          <td className="px-3 py-2.5">
                            <TableLink to={`/sales/invoices/${inv.id}`} className="font-semibold">
                              {inv.invoiceNo}
                            </TableLink>
                            {inv.salesOrderNo ? (
                              <p className="mt-0.5 text-[11px] text-erp-muted">SO {inv.salesOrderNo}</p>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusDot
                              label={CRM_TAX_INVOICE_STATUS_LABELS[inv.status]}
                              tone={invoiceTone(inv.status)}
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={cn(overdue && 'font-semibold text-erp-danger')}
                              title={overdue ? 'Overdue' : undefined}
                            >
                              {formatDate(inv.dueDate)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {formatCurrency(inv.gst.grandTotal)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-erp-muted">
                            {formatCurrency(inv.amountPaid)}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2.5 text-right font-semibold tabular-nums',
                              overdue && 'text-erp-danger',
                            )}
                          >
                            {formatCurrency(inv.balanceDue)}
                          </td>
                          <td className="px-3 py-2.5">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className={cn(
                                'h-8 w-[7.5rem] text-[13px]',
                                lineOver && 'border-erp-danger focus-visible:ring-erp-danger/30',
                              )}
                              placeholder={inv.balanceDue.toFixed(2)}
                              value={amounts[inv.id] ?? ''}
                              onChange={(e) =>
                                setAmounts((prev) => ({ ...prev, [inv.id]: e.target.value }))
                              }
                              disabled={!canCreate}
                              aria-label={`Allocate to ${inv.invoiceNo}`}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {selectedReceipt && hasPositiveLine ? (
              <div
                className={cn(
                  'flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-[12px]',
                  overReceipt
                    ? 'border-rose-200 bg-rose-50 text-rose-900'
                    : 'border-erp-border bg-erp-surface-alt/40 text-erp-muted',
                )}
              >
                <span>
                  Applying <strong className="tabular-nums text-erp-text">{formatCurrency(selectedTotal)}</strong>
                  {' '}of{' '}
                  <strong className="tabular-nums text-erp-text">
                    {formatCurrency(selectedReceipt.unallocatedAmount)}
                  </strong>
                  {' '}unallocated
                </span>
                <span className={cn('font-semibold tabular-nums', overReceipt ? 'text-erp-danger' : 'text-erp-text')}>
                  {overReceipt ? 'Over by ' : 'Left '}
                  {formatCurrency(Math.abs(remaining ?? 0))}
                </span>
              </div>
            ) : null}
          </div>
        </ErpCardSection>
      </div>

      <ErpCardSection
        title="Allocation history"
        subtitle={
          customerId
            ? selectedCustomer
              ? `Recent allocations for ${selectedCustomer.customerName}`
              : 'Recent allocations for this customer'
            : 'Select a customer to view history'
        }
        className="mt-6"
        columns={1}
        collapsible
        defaultOpen={history.length > 0}
      >
        <div className="col-span-full overflow-x-auto">
          {!customerId ? (
            <p className="text-[13px] text-erp-muted">Select a customer to view allocation history.</p>
          ) : history.length === 0 ? (
            <p className="text-[13px] text-erp-muted">No allocations yet for this customer.</p>
          ) : (
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-erp-border text-[11px] uppercase tracking-wide text-erp-muted">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Receipt</th>
                  <th className="py-2 pr-3 font-medium">Invoice</th>
                  <th className="py-2 pr-3 font-medium">Amount</th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((a) => (
                  <tr key={a.id} className="border-b border-erp-border/60">
                    <td className="py-2 pr-3 tabular-nums">{formatDate(a.allocationDate)}</td>
                    <td className="py-2 pr-3">
                      <TableLink to={`/sales/receipts/${a.receiptId}`}>{a.receiptNo}</TableLink>
                    </td>
                    <td className="py-2 pr-3">
                      <TableLink to={`/sales/invoices/${a.invoiceId}`}>{a.invoiceNo}</TableLink>
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {formatCurrency(a.amount)}
                      {a.reversedAt ? (
                        <span className="ml-1 text-erp-danger">(Reversed)</span>
                      ) : null}
                    </td>
                    <td className="py-2">
                      {!a.reversedAt && canReverse ? (
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
