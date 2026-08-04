import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input } from '@/components/forms/Inputs'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { LoadingState } from '@/design-system/components/LoadingState'
import { allocateReceipt, getCustomerReceipt, listCustomerOpenItems, previewReceiptAllocation } from '@/services/bridges/receivablesApiBridge'
import type { CustomerReceiptDto, OutstandingOpenItemDto, ReceiptAllocationPreview } from '@/types/moneyIn'
import { formatCurrency } from '@/utils/formatters/currency'
import { useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { receiptDisplayNumber, parseDecimal } from '../moneyInUi'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

export function ReceiptAllocatePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useMoneyInPermissions()
  const [receipt, setReceipt] = useState<CustomerReceiptDto | null>(null)
  const [openItems, setOpenItems] = useState<OutstandingOpenItemDto[]>([])
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [allocationDate, setAllocationDate] = useState(today())
  const [loading, setLoading] = useState(true)
  const [previewing, setPreviewing] = useState(false)
  const [allocating, setAllocating] = useState(false)
  const [preview, setPreview] = useState<ReceiptAllocationPreview | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await getCustomerReceipt(id)
      setReceipt(data)
      if (data.status === 'POSTED') {
        const items = await listCustomerOpenItems(data.customerId, { pageSize: 100 })
        setOpenItems(
          items.items.filter(
            (row) =>
              Boolean(row.salesInvoiceId) &&
              Number(row.outstandingAmount) > 0 &&
              row.status !== 'SETTLED' &&
              !row.isOnHold &&
              !row.isDisputed,
          ),
        )
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load receipt')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (perms.canAllocate) void load()
  }, [load, perms.canAllocate])

  const selectedLines = useMemo(
    () =>
      Object.entries(amounts)
        .filter(([, v]) => Number(v) > 0)
        .map(([openItemId, amount]) => {
          const item = openItems.find((o) => o.openItemId === openItemId)
          return item ? { invoiceId: item.salesInvoiceId ?? '', invoiceOpenItemId: openItemId, amount } : null
        })
        .filter((x): x is { invoiceId: string; invoiceOpenItemId: string; amount: string } => x !== null && x.invoiceId !== ''),
    [amounts, openItems],
  )

  const unallocated = receipt ? parseDecimal(receipt.unallocatedAmount) : 0
  const totalSelected = selectedLines.reduce((s, l) => s + Number(l.amount), 0)
  const remainingAfter = unallocated - totalSelected
  const balanceState =
    totalSelected <= 0
      ? 'idle'
      : remainingAfter < -0.0001
        ? 'over'
        : remainingAfter > 0.0001
          ? 'under'
          : 'exact'

  const runPreview = async () => {
    if (!id || selectedLines.length === 0) {
      notify.error('Enter at least one allocation amount')
      return
    }
    setPreviewing(true)
    try {
      const result = await previewReceiptAllocation(id, { allocationDate, allocations: selectedLines })
      setPreview(result)
      if (result.valid) notify.success('Preview looks good')
      else notify.error('Preview has issues — review before allocating')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setPreviewing(false)
    }
  }

  const runAllocate = async () => {
    if (!id || selectedLines.length === 0) {
      notify.error('Enter at least one allocation amount')
      return
    }
    setAllocating(true)
    try {
      const idempotencyKey = crypto.randomUUID()
      const result = await allocateReceipt(id, { allocationDate, allocations: selectedLines }, idempotencyKey)
      notify.success(result.idempotentReplay ? 'Allocation replayed (idempotent)' : 'Allocation posted')
      navigate(`/accounting/money-in/receipts/${id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Allocation failed')
    } finally {
      setAllocating(false)
    }
  }

  const setAmount = (openItemId: string, value: string) => {
    setAmounts((prev) => ({ ...prev, [openItemId]: value }))
    setPreview(null)
  }

  const fillOutstanding = (item: OutstandingOpenItemDto) => {
    const outstanding = parseDecimal(item.outstandingAmount)
    const alreadyOnOthers = Object.entries(amounts)
      .filter(([key]) => key !== item.openItemId)
      .reduce((s, [, v]) => s + (Number(v) > 0 ? Number(v) : 0), 0)
    const maxForRow = Math.max(0, Math.min(outstanding, unallocated - alreadyOnOthers))
    setAmount(item.openItemId, maxForRow > 0 ? maxForRow.toFixed(2) : '')
  }

  if (!perms.canAllocate) {
    return (
      <MoneyInWorkspaceShell title="Allocate Receipt">
        <p className="text-[13px] text-erp-muted">You do not have permission to allocate customer receipts.</p>
      </MoneyInWorkspaceShell>
    )
  }

  if (loading || !receipt) {
    return (
      <MoneyInWorkspaceShell title="Allocate Receipt">
        <LoadingState variant="card" />
      </MoneyInWorkspaceShell>
    )
  }

  if (receipt.status !== 'POSTED') {
    return (
      <MoneyInWorkspaceShell title={`Allocate ${receiptDisplayNumber(receipt)}`}>
        <div className="mi-allocate">
          <PageBackLink to={`/accounting/money-in/receipts/${id}`} label="Back to receipt" />
          <p className="mi-allocate-empty">Only posted receipts can be allocated.</p>
        </div>
      </MoneyInWorkspaceShell>
    )
  }

  const receiptNo = receiptDisplayNumber(receipt)

  return (
    <MoneyInWorkspaceShell title={`Allocate ${receiptNo}`}>
      <div className="mi-allocate">
        <PageBackLink to={`/accounting/money-in/receipts/${id}`} label="Back to receipt" />

        <section className="mi-allocate-context" aria-label="Receipt allocation context">
          <div className="mi-allocate-context__avatar" aria-hidden>
            {customerInitials(receipt.customerNameSnapshot)}
          </div>
          <div className="mi-allocate-context__main">
            <div className="mi-allocate-context__title-row">
              <h2 className="mi-allocate-context__name">{receipt.customerNameSnapshot}</h2>
              <span className="mi-allocate-context__receipt">{receiptNo}</span>
            </div>
            <div className="mi-allocate-context__chips">
              <span className="mi-allocate-chip">
                <span className="mi-allocate-chip__label">Receipt date</span>
                <span className="tabular-nums">{receipt.receiptDate}</span>
              </span>
              <span className="mi-allocate-chip mi-allocate-chip--unallocated">
                <span className="mi-allocate-chip__label">Unallocated</span>
                <span className="tabular-nums">{formatCurrency(unallocated)}</span>
              </span>
              {receipt.currencyCode ? (
                <span className="mi-allocate-chip">
                  <span className="mi-allocate-chip__label">Currency</span>
                  <span>{receipt.currencyCode}</span>
                </span>
              ) : null}
            </div>
          </div>
          <label className="mi-allocate-date">
            <span className="mi-allocate-date__label">Allocation date</span>
            <Input
              type="date"
              className="mi-allocate-date__input"
              value={allocationDate}
              onChange={(e) => {
                setAllocationDate(e.target.value)
                setPreview(null)
              }}
            />
          </label>
        </section>

        {openItems.length === 0 ? (
          <p className="mi-allocate-empty">No outstanding invoices found for this customer.</p>
        ) : (
          <section className="mi-allocate-panel" aria-label="Invoice allocations">
            <div className="mi-allocate-panel__head">
              <h3 className="mi-allocate-panel__title">Open invoices</h3>
              <span className="mi-allocate-panel__meta">{openItems.length} open</span>
            </div>
            <div className="mi-allocate-table-wrap">
              <table className="mi-allocate-table">
                <thead>
                  <tr>
                    <th scope="col">Invoice</th>
                    <th scope="col">Date</th>
                    <th scope="col" className="mi-allocate-table__num">
                      Outstanding
                    </th>
                    <th scope="col" className="mi-allocate-table__alloc">
                      Allocate amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {openItems.map((item) => {
                    const rowAmount = amounts[item.openItemId] ?? ''
                    const rowVal = Number(rowAmount)
                    const outstanding = parseDecimal(item.outstandingAmount)
                    const overOutstanding = rowVal > outstanding + 0.0001
                    return (
                      <tr key={item.openItemId} className={rowVal > 0 ? 'mi-allocate-table__row--active' : undefined}>
                        <td className="mi-allocate-table__invoice">{item.invoiceNumber ?? '—'}</td>
                        <td className="mi-allocate-table__date tabular-nums">{item.invoiceDate}</td>
                        <td className="mi-allocate-table__num tabular-nums">{formatCurrency(outstanding)}</td>
                        <td className="mi-allocate-table__alloc">
                          <div className="mi-allocate-amount">
                            <Input
                              className={`mi-allocate-amount__input${overOutstanding ? ' mi-allocate-amount__input--warn' : ''}`}
                              placeholder="0.00"
                              inputMode="decimal"
                              aria-label={`Allocate to ${item.invoiceNumber ?? 'invoice'}`}
                              value={rowAmount}
                              onChange={(e) => setAmount(item.openItemId, e.target.value)}
                            />
                            <button
                              type="button"
                              className="mi-allocate-amount__fill"
                              onClick={() => fillOutstanding(item)}
                              title="Fill up to outstanding / remaining unallocated"
                            >
                              Max
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div
          className={`mi-allocate-totals mi-allocate-totals--${balanceState}`}
          role="status"
          aria-live="polite"
        >
          <div className="mi-allocate-totals__item">
            <span className="mi-allocate-totals__label">Unallocated</span>
            <span className="mi-allocate-totals__value tabular-nums">{formatCurrency(unallocated)}</span>
          </div>
          <div className="mi-allocate-totals__item mi-allocate-totals__item--primary">
            <span className="mi-allocate-totals__label">Total to allocate</span>
            <span className="mi-allocate-totals__value tabular-nums">{formatCurrency(totalSelected)}</span>
          </div>
          <div className="mi-allocate-totals__item">
            <span className="mi-allocate-totals__label">
              {balanceState === 'over' ? 'Over by' : 'Remaining after'}
            </span>
            <span className="mi-allocate-totals__value tabular-nums">
              {formatCurrency(Math.abs(remainingAfter))}
            </span>
          </div>
          {balanceState === 'over' ? (
            <p className="mi-allocate-totals__hint">Allocation exceeds the unallocated receipt balance.</p>
          ) : null}
          {balanceState === 'under' ? (
            <p className="mi-allocate-totals__hint">
              {formatCurrency(remainingAfter)} will remain unallocated on this receipt.
            </p>
          ) : null}
          {balanceState === 'exact' ? (
            <p className="mi-allocate-totals__hint">Fully allocating the available receipt balance.</p>
          ) : null}
        </div>

        {preview && (
          <div
            className={`mi-allocate-preview ${preview.valid ? 'mi-allocate-preview--ok' : 'mi-allocate-preview--bad'}`}
          >
            <p className="mi-allocate-preview__title">{preview.valid ? 'Preview valid' : 'Preview has issues'}</p>
            <p className="mi-allocate-preview__line">
              Unallocated after: {formatCurrency(parseDecimal(preview.receiptUnallocatedAfter))}
            </p>
            {preview.errors.length > 0 && (
              <ul className="mi-allocate-preview__errors">
                {preview.errors.map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mi-allocate-actions">
          <ErpButton
            type="button"
            variant="primary"
            className="mi-allocate-actions__primary"
            onClick={() => void runAllocate()}
            disabled={allocating || selectedLines.length === 0 || balanceState === 'over'}
          >
            {allocating ? 'Allocating…' : 'Allocate'}
          </ErpButton>
          <ErpButton
            type="button"
            variant="secondary"
            onClick={() => void runPreview()}
            disabled={previewing || selectedLines.length === 0}
          >
            {previewing ? 'Previewing…' : 'Preview'}
          </ErpButton>
          <button
            type="button"
            className="mi-allocate-actions__back"
            onClick={() => navigate(`/accounting/money-in/receipts/${id}`)}
          >
            Back
          </button>
        </div>
      </div>
    </MoneyInWorkspaceShell>
  )
}
