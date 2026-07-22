import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import {
  createVendorAdjustmentAllocation,
  getAllocatablePayablesForDebitNote,
  getVendorAdjustment,
} from '@/services/bridges/payablesApiBridge'
import type { AllocatableVendorInvoiceItem, CreateVendorAdjustmentAllocationInput, VendorAdjustmentDto } from '@/types/moneyOut'
import { formatCurrency } from '@/utils/formatters/currency'
import { useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import { parseDecimal, todayIsoDate, vendorAdjustmentDisplayNumber } from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

export function VendorAdjustmentAllocatePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useMoneyOutPermissions()
  const [adjustment, setAdjustment] = useState<VendorAdjustmentDto | null>(null)
  const [items, setItems] = useState<AllocatableVendorInvoiceItem[]>([])
  const [sourceOutstanding, setSourceOutstanding] = useState('0')
  const [sourceUpdatedAt, setSourceUpdatedAt] = useState<string | null>(null)
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [allocationDate, setAllocationDate] = useState(todayIsoDate())
  const [loading, setLoading] = useState(true)
  const [allocating, setAllocating] = useState(false)
  const idempotencyRef = useRef<{ signature: string; key: string } | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const adj = await getVendorAdjustment(id)
      setAdjustment(adj)
      if (adj.status === 'POSTED' && adj.adjustmentType === 'VENDOR_DEBIT_NOTE') {
        const result = await getAllocatablePayablesForDebitNote(id)
        setItems(result.items)
        setSourceOutstanding(result.sourceOutstanding)
        setSourceUpdatedAt(result.sourceUpdatedAt)
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
      notify.error('Debit note balance could not be resolved. Refresh and retry.')
      return
    }
    setAllocating(true)
    try {
      const input: CreateVendorAdjustmentAllocationInput = {
        expectedAdjustmentUpdatedAt: adjustment?.updatedAt,
        expectedSourceOpenItemUpdatedAt: sourceUpdatedAt,
        allocationDate,
        idempotencyKey: resolveIdempotencyKey(),
        lines: selectedLines,
      }
      const result = await createVendorAdjustmentAllocation(id, input)
      notify.success(result.idempotentReplay ? 'Allocation replayed (idempotent)' : 'Allocation applied')
      navigate(`/accounting/money-out/vendor-adjustments/${id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Allocation failed')
      idempotencyRef.current = null
      void load()
    } finally {
      setAllocating(false)
    }
  }

  if (!perms.canCreateAllocation) {
    return (
      <MoneyOutWorkspaceShell title="Allocate Debit Note">
        <p className="text-[13px] text-erp-muted">You do not have permission to allocate debit notes.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode() || loading || !adjustment) {
    return (
      <MoneyOutWorkspaceShell title="Allocate Debit Note">
        <LoadingState variant="card" />
      </MoneyOutWorkspaceShell>
    )
  }

  return (
    <MoneyOutWorkspaceShell title={`Allocate ${vendorAdjustmentDisplayNumber(adjustment)}`}>
      <div className="mb-3 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-900">
        Subledger allocation only — no journal entry. Applies posted debit note against vendor invoices / credit adjustments.
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3 text-[12px]">
        <div>
          <span className="text-erp-muted">Remaining debit note</span>
          <div className="font-semibold tabular-nums">{formatCurrency(parseDecimal(sourceOutstanding))}</div>
        </div>
        <div>
          <span className="text-erp-muted">Selected total</span>
          <div className="font-semibold tabular-nums">{formatCurrency(totalSelected)}</div>
        </div>
        <div>
          <span className="text-erp-muted">Remaining after</span>
          <div className="font-semibold tabular-nums">{formatCurrency(Math.max(0, remainingAfter))}</div>
        </div>
      </div>

      <div className="mb-3 max-w-xs">
        <label className="mb-1 block text-[12px] text-erp-muted">Allocation date</label>
        <Input type="date" value={allocationDate} onChange={(e) => setAllocationDate(e.target.value)} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-erp-border text-erp-muted">
              <th className="py-2 pr-3 font-medium">Payable</th>
              <th className="py-2 pr-3 text-right font-medium">Outstanding</th>
              <th className="py-2 pr-3 text-right font-medium">Suggested</th>
              <th className="py-2 font-medium">Allocate</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.openItemId} className="border-b border-erp-border/60">
                <td className="py-2 pr-3">
                  <div className="font-medium">{item.documentNumber}</div>
                  <div className="text-[11px] text-erp-muted">{item.supplierInvoiceNumber ?? item.documentDate}</div>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(parseDecimal(item.outstandingAmount))}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(parseDecimal(item.suggestedAllocationAmount))}</td>
                <td className="py-2">
                  <Input
                    value={amounts[item.openItemId] ?? ''}
                    onChange={(e) => setAmounts((prev) => ({ ...prev, [item.openItemId]: e.target.value }))}
                    className="max-w-[120px]"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-2">
        <ErpButton variant="secondary" onClick={() => navigate(`/accounting/money-out/vendor-adjustments/${id}`)}>
          Cancel
        </ErpButton>
        <ErpButton variant="primary" onClick={() => void runAllocate()} disabled={allocating}>
          {allocating ? 'Allocating…' : 'Confirm Allocation'}
        </ErpButton>
      </div>
    </MoneyOutWorkspaceShell>
  )
}
