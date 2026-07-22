import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import {
  createVendorPaymentAllocation,
  getAllocatableVendorInvoices,
  getVendorPayment,
} from '@/services/bridges/payablesApiBridge'
import type {
  AllocatableVendorInvoiceItem,
  CreateVendorPaymentAllocationInput,
  VendorPaymentDto,
} from '@/types/moneyOut'
import { formatCurrency } from '@/utils/formatters/currency'
import { useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import { PAYMENT_PURPOSE_LABELS, parseDecimal, todayIsoDate, vendorPaymentDisplayNumber } from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

export function VendorPaymentAllocatePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useMoneyOutPermissions()
  const [payment, setPayment] = useState<VendorPaymentDto | null>(null)
  const [items, setItems] = useState<AllocatableVendorInvoiceItem[]>([])
  const [sourceOutstanding, setSourceOutstanding] = useState('0')
  const [sourceUpdatedAt, setSourceUpdatedAt] = useState<string | null>(null)
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [allocationDate, setAllocationDate] = useState(todayIsoDate())
  const [loading, setLoading] = useState(true)
  const [allocating, setAllocating] = useState(false)

  // Stable idempotency key per confirmation payload — reused on retry, regenerated when the
  // selection / amounts / allocation date change (see `keySignature`).
  const idempotencyRef = useRef<{ signature: string; key: string } | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const pmt = await getVendorPayment(id)
      setPayment(pmt)
      if (pmt.status === 'POSTED') {
        const result = await getAllocatableVendorInvoices(id)
        setItems(result.items)
        setSourceOutstanding(result.sourceOutstanding)
        setSourceUpdatedAt(result.sourceUpdatedAt)
        // Pre-fill suggested amounts (FIFO by due date) from the server suggestion.
        setAmounts(
          Object.fromEntries(
            result.items
              .filter((it) => parseDecimal(it.suggestedAllocationAmount) > 0)
              .map((it) => [it.openItemId, it.suggestedAllocationAmount]),
          ),
        )
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load allocation data')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (perms.canCreateAllocation) void load()
  }, [load, perms.canCreateAllocation])

  const selectedLines = useMemo(
    () =>
      Object.entries(amounts)
        .filter(([, v]) => parseDecimal(v) > 0)
        .map(([openItemId, amount]) => {
          const item = items.find((o) => o.openItemId === openItemId)
          return item
            ? { targetCreditOpenItemId: openItemId, expectedTargetUpdatedAt: item.updatedAt, amount: amount.trim() }
            : null
        })
        .filter(
          (x): x is { targetCreditOpenItemId: string; expectedTargetUpdatedAt: string; amount: string } => x !== null,
        ),
    [amounts, items],
  )

  const totalSelected = selectedLines.reduce((s, l) => s + parseDecimal(l.amount), 0)
  const remainingAfter = parseDecimal(sourceOutstanding) - totalSelected

  const keySignature = useMemo(
    () =>
      JSON.stringify({
        allocationDate,
        lines: [...selectedLines].sort((a, b) => a.targetCreditOpenItemId.localeCompare(b.targetCreditOpenItemId)),
      }),
    [allocationDate, selectedLines],
  )

  const resolveIdempotencyKey = useCallback((): string => {
    if (idempotencyRef.current && idempotencyRef.current.signature === keySignature) {
      return idempotencyRef.current.key
    }
    const key = crypto.randomUUID()
    idempotencyRef.current = { signature: keySignature, key }
    return key
  }, [keySignature])

  const runAllocate = async () => {
    if (!id || selectedLines.length === 0) {
      notify.error('Enter at least one allocation amount')
      return
    }
    if (!sourceUpdatedAt) {
      notify.error('Payment balance could not be resolved. Refresh and retry.')
      return
    }
    if (remainingAfter < -0.0001) {
      notify.error('Total allocation exceeds the remaining payment balance')
      return
    }
    setAllocating(true)
    try {
      const input: CreateVendorPaymentAllocationInput = {
        expectedPaymentUpdatedAt: payment?.updatedAt,
        expectedSourceOpenItemUpdatedAt: sourceUpdatedAt,
        allocationDate,
        idempotencyKey: resolveIdempotencyKey(),
        lines: selectedLines,
      }
      const result = await createVendorPaymentAllocation(id, input)
      notify.success(result.idempotentReplay ? 'Allocation replayed (idempotent)' : 'Allocation applied')
      navigate(`/accounting/money-out/vendor-payments/${id}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Allocation failed'
      notify.error(msg)
      // On any concurrency change, reload balances and force a fresh idempotency key.
      if (msg.toLowerCase().includes('changed') || msg.toLowerCase().includes('reload')) {
        idempotencyRef.current = null
        void load()
      }
    } finally {
      setAllocating(false)
    }
  }

  if (!perms.canCreateAllocation) {
    return (
      <MoneyOutWorkspaceShell title="Allocate Vendor Payment">
        <p className="text-[13px] text-erp-muted">You do not have permission to allocate vendor payments.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Allocate Vendor Payment">
        <p className="text-[13px] text-erp-muted">Vendor payment allocation requires API mode.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (loading || !payment) {
    return (
      <MoneyOutWorkspaceShell title="Allocate Vendor Payment">
        <LoadingState variant="card" />
      </MoneyOutWorkspaceShell>
    )
  }

  if (payment.status !== 'POSTED') {
    return (
      <MoneyOutWorkspaceShell title={`Allocate ${vendorPaymentDisplayNumber(payment)}`}>
        <p className="text-[13px] text-erp-muted">Only posted vendor payments can be allocated.</p>
        <ErpButton
          className="mt-3"
          variant="secondary"
          onClick={() => navigate(`/accounting/money-out/vendor-payments/${id}`)}
        >
          Back to payment
        </ErpButton>
      </MoneyOutWorkspaceShell>
    )
  }

  return (
    <MoneyOutWorkspaceShell title={`Allocate ${vendorPaymentDisplayNumber(payment)}`}>
      <div className="mb-3 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-900">
        Allocation settles vendor invoice open items against this payment. It updates subledger balances only and creates
        no journal entry.
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4 rounded border border-erp-border bg-slate-50 p-3 text-[12px]">
        <span className="text-erp-muted">
          Vendor: <strong className="text-erp-text">{payment.vendorNameSnapshot}</strong>
        </span>
        <span className="text-erp-muted">Purpose: {PAYMENT_PURPOSE_LABELS[payment.paymentPurpose]}</span>
        <span className="text-erp-muted">
          Unallocated: <strong className="text-erp-text">{formatCurrency(parseDecimal(sourceOutstanding))}</strong>
        </span>
        <label className="flex items-center gap-2 text-erp-muted">
          Allocation date
          <Input
            type="date"
            className="h-8 text-[12px]"
            value={allocationDate}
            onChange={(e) => setAllocationDate(e.target.value)}
          />
        </label>
      </div>

      {items.length === 0 ? (
        <p className="text-[13px] text-erp-muted">No outstanding invoices found for this vendor.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border text-erp-muted">
                <th className="py-2 pr-3 font-medium">Invoice</th>
                <th className="py-2 pr-3 font-medium">Supplier</th>
                <th className="py-2 pr-3 font-medium">Due</th>
                <th className="py-2 pr-3 text-right font-medium">Outstanding</th>
                <th className="py-2 font-medium">Allocate amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.openItemId} className="border-b border-erp-border/60">
                  <td className="py-2 pr-3 font-medium">{item.documentNumber}</td>
                  <td className="py-2 pr-3">{item.supplierInvoiceNumber ?? '—'}</td>
                  <td className="py-2 pr-3 tabular-nums">{item.dueDate ?? '—'}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatCurrency(parseDecimal(item.outstandingAmount))}
                  </td>
                  <td className="py-2">
                    <Input
                      className="h-8 w-32 text-[12px]"
                      placeholder="0.00"
                      inputMode="decimal"
                      value={amounts[item.openItemId] ?? ''}
                      onChange={(e) => setAmounts((prev) => ({ ...prev, [item.openItemId]: e.target.value }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded border border-erp-border bg-slate-50 px-3 py-2 text-[12px]">
        <span className="text-erp-muted">Total to allocate</span>
        <span className="font-semibold tabular-nums text-erp-text">{formatCurrency(totalSelected)}</span>
        <span className="text-erp-muted">
          Remaining after: <strong className={remainingAfter < -0.0001 ? 'text-rose-700' : 'text-erp-text'}>
            {formatCurrency(remainingAfter)}
          </strong>
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        <ErpButton
          type="button"
          variant="primary"
          onClick={() => void runAllocate()}
          disabled={allocating || selectedLines.length === 0}
        >
          {allocating ? 'Allocating…' : 'Allocate'}
        </ErpButton>
        <ErpButton type="button" variant="ghost" onClick={() => navigate(`/accounting/money-out/vendor-payments/${id}`)}>
          Back
        </ErpButton>
      </div>
    </MoneyOutWorkspaceShell>
  )
}
