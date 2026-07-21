import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  allocateCreditNote,
  getCustomerCreditNote,
  listCustomerOpenItems,
  previewCreditNoteAllocation,
} from '@/services/bridges/receivablesApiBridge'
import type { CreditNoteAllocationPreview, CustomerCreditNoteDto, OutstandingOpenItemDto } from '@/types/moneyIn'
import { formatCurrency } from '@/utils/formatters/currency'
import { useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { creditNoteDisplayNumber, parseDecimal } from '../moneyInUi'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function CreditNoteAllocatePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useMoneyInPermissions()
  const [note, setNote] = useState<CustomerCreditNoteDto | null>(null)
  const [openItems, setOpenItems] = useState<OutstandingOpenItemDto[]>([])
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [allocationDate, setAllocationDate] = useState(today())
  const [loading, setLoading] = useState(true)
  const [previewing, setPreviewing] = useState(false)
  const [allocating, setAllocating] = useState(false)
  const [preview, setPreview] = useState<CreditNoteAllocationPreview | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await getCustomerCreditNote(id)
      setNote(data)
      if (data.status === 'POSTED') {
        const items = await listCustomerOpenItems(data.customerId, { pageSize: 100 })
        setOpenItems(items.items)
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load credit note')
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

  const totalSelected = selectedLines.reduce((s, l) => s + Number(l.amount), 0)

  const runPreview = async () => {
    if (!id || selectedLines.length === 0) {
      notify.error('Enter at least one allocation amount')
      return
    }
    setPreviewing(true)
    try {
      const result = await previewCreditNoteAllocation(id, { allocationDate, allocations: selectedLines })
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
      const result = await allocateCreditNote(id, { allocationDate, allocations: selectedLines }, idempotencyKey)
      notify.success(result.idempotentReplay ? 'Allocation replayed (idempotent)' : 'Allocation posted')
      navigate(`/accounting/money-in/credit-notes/${id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Allocation failed')
    } finally {
      setAllocating(false)
    }
  }

  if (!perms.canAllocate) {
    return (
      <MoneyInWorkspaceShell title="Allocate Credit Note">
        <p className="text-[13px] text-erp-muted">You do not have permission to allocate credit notes.</p>
      </MoneyInWorkspaceShell>
    )
  }

  if (loading || !note) {
    return (
      <MoneyInWorkspaceShell title="Allocate Credit Note">
        <LoadingState variant="card" />
      </MoneyInWorkspaceShell>
    )
  }

  if (note.status !== 'POSTED') {
    return (
      <MoneyInWorkspaceShell title={`Allocate ${creditNoteDisplayNumber(note)}`}>
        <p className="text-[13px] text-erp-muted">Only posted credit notes can be allocated.</p>
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <MoneyInWorkspaceShell title={`Allocate ${creditNoteDisplayNumber(note)}`}>
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded border border-erp-border bg-slate-50 p-3 text-[12px]">
        <span className="text-erp-muted">Customer: <strong className="text-erp-text">{note.customerNameSnapshot}</strong></span>
        <span className="text-erp-muted">Unallocated: <strong className="text-erp-text">{formatCurrency(parseDecimal(note.unallocatedAmount))}</strong></span>
        <label className="flex items-center gap-2 text-erp-muted">
          Allocation date
          <Input type="date" className="h-8 text-[12px]" value={allocationDate} onChange={(e) => setAllocationDate(e.target.value)} />
        </label>
      </div>

      {openItems.length === 0 ? (
        <p className="text-[13px] text-erp-muted">No outstanding invoices found for this customer.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border text-erp-muted">
                <th className="py-2 pr-3 font-medium">Invoice</th>
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 text-right font-medium">Outstanding</th>
                <th className="py-2 font-medium">Allocate amount</th>
              </tr>
            </thead>
            <tbody>
              {openItems.map((item) => (
                <tr key={item.openItemId} className="border-b border-erp-border/60">
                  <td className="py-2 pr-3 font-medium">{item.invoiceNumber ?? '—'}</td>
                  <td className="py-2 pr-3 tabular-nums">{item.invoiceDate}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(parseDecimal(item.outstandingAmount))}</td>
                  <td className="py-2">
                    <Input
                      className="h-8 w-32 text-[12px]"
                      placeholder="0.00"
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

      <div className="mt-3 flex items-center justify-between rounded border border-erp-border bg-slate-50 px-3 py-2 text-[12px]">
        <span className="text-erp-muted">Total to allocate</span>
        <span className="font-semibold tabular-nums text-erp-text">{formatCurrency(totalSelected)}</span>
      </div>

      {preview && (
        <div className={`mt-3 rounded border px-3 py-2 text-[12px] ${preview.valid ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>
          <p className="font-medium">{preview.valid ? 'Preview valid' : 'Preview has issues'}</p>
          <p className="mt-1">Unallocated after: {formatCurrency(parseDecimal(preview.creditNoteUnallocatedAfter))}</p>
          {preview.errors.length > 0 && (
            <ul className="mt-1 list-inside list-disc">
              {preview.errors.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <ErpButton type="button" variant="secondary" onClick={() => void runPreview()} disabled={previewing || selectedLines.length === 0}>
          {previewing ? 'Previewing…' : 'Preview'}
        </ErpButton>
        <ErpButton type="button" variant="primary" onClick={() => void runAllocate()} disabled={allocating || selectedLines.length === 0}>
          {allocating ? 'Allocating…' : 'Allocate'}
        </ErpButton>
        <ErpButton type="button" variant="ghost" onClick={() => navigate(`/accounting/money-in/credit-notes/${id}`)}>
          Back
        </ErpButton>
      </div>
    </MoneyInWorkspaceShell>
  )
}
