import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FilePlus2, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import {
  listInvoiceReadyDispatchLines,
  prefillInvoiceFromDispatch,
} from '@/services/bridges/receivablesApiBridge'
import type { DispatchLineInvoiceReadyDto, InvoiceReadyPolicyDto } from '@/types/moneyIn'
import { mergeAllowedAction, useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { moneyInPath, parseDecimal } from '../moneyInUi'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'
import type { DispatchInvoicePrefillState } from '../invoices/invoicePrefillState'

function formatInvoiceMode(mode: string): string {
  switch (mode) {
    case 'ONE_PER_DISPATCH':
      return 'One invoice per dispatch'
    case 'CONSOLIDATED':
      return 'Consolidated (multi-dispatch OK)'
    case 'MANUAL_ONLY':
      return 'Manual only (multi-dispatch OK)'
    default:
      return mode
  }
}

function formatPodStatus(status: string | null | undefined): string {
  if (!status) return 'No POD'
  return status.replace(/_/g, ' ')
}

function formatBlockers(row: DispatchLineInvoiceReadyDto): string {
  if (row.blockers && row.blockers.length > 0) return row.blockers.join('; ')
  if (row.podBlocksInvoice) return 'Waiting on POD'
  return '-'
}

export function InvoiceReadyPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const outboundDispatchIdFilter = searchParams.get('outboundDispatchId') ?? undefined
  const perms = useMoneyInPermissions()
  const [rows, setRows] = useState<DispatchLineInvoiceReadyDto[]>([])
  const [policy, setPolicy] = useState<InvoiceReadyPolicyDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showPodWaiting, setShowPodWaiting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listInvoiceReadyDispatchLines({
        readyOnly: true,
        limit: 200,
        excludePodBlocked: !showPodWaiting,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(outboundDispatchIdFilter ? { outboundDispatchId: outboundDispatchIdFilter } : {}),
      })
      setRows(data.items)
      setPolicy(data.policy)
      setSelected((prev) => {
        const next = new Set<string>()
        for (const id of prev) {
          if (data.items.some((r) => r.outboundDispatchLineId === id)) next.add(id)
        }
        return next
      })
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load invoice-ready lines')
    } finally {
      setLoading(false)
    }
  }, [search, outboundDispatchIdFilter, showPodWaiting])

  useEffect(() => {
    if (perms.canViewInvoice) void load()
  }, [load, perms.canViewInvoice])

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(r.outboundDispatchLineId)),
    [rows, selected],
  )

  const customerIds = useMemo(
    () => new Set(selectedRows.map((r) => r.customerId).filter(Boolean)),
    [selectedRows],
  )

  const dispatchIds = useMemo(
    () => new Set(selectedRows.map((r) => r.outboundDispatchId)),
    [selectedRows],
  )

  const hasPodBlockedSelected = selectedRows.some((r) => r.podBlocksInvoice || r.canCreateInvoice === false)
  const multiDispatchBlocked =
    Boolean(policy) && !policy!.allowsMultiDispatchInvoice && dispatchIds.size > 1
  const createBlocked =
    selected.size === 0 ||
    customerIds.size > 1 ||
    multiDispatchBlocked ||
    hasPodBlockedSelected

  const createBlockReason = useMemo(() => {
    if (selected.size === 0) return null
    if (customerIds.size > 1) return 'Selected lines must belong to a single customer.'
    if (multiDispatchBlocked) {
      return 'Invoice mode is one-per-dispatch — select lines from a single dispatch only.'
    }
    if (hasPodBlockedSelected) {
      return 'Selection includes lines blocked by POD or remaining quantity — deselect them or capture delivery first.'
    }
    return null
  }, [selected.size, customerIds.size, multiDispatchBlocked, hasPodBlockedSelected])

  const selectableRows = useMemo(
    () => rows.filter((r) => r.canCreateInvoice !== false && !r.podBlocksInvoice),
    [rows],
  )

  const toggleLine = (lineId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === selectableRows.length && selectableRows.length > 0) setSelected(new Set())
    else setSelected(new Set(selectableRows.map((r) => r.outboundDispatchLineId)))
  }

  const onCreateInvoice = async () => {
    if (createBlocked) {
      notify.error(createBlockReason ?? 'Cannot create invoice from current selection')
      return
    }
    setCreating(true)
    try {
      const prefill = await prefillInvoiceFromDispatch([...selected])
      const state: DispatchInvoicePrefillState = { dispatchPrefill: prefill }
      navigate(moneyInPath('invoices/new'), { state })
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Prefill failed')
    } finally {
      setCreating(false)
    }
  }

  if (!perms.canViewInvoice) {
    return (
      <MoneyInWorkspaceShell title="Invoice Ready">
        <p className="text-[13px] text-erp-muted">You do not have permission to view invoice-ready lines.</p>
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <MoneyInWorkspaceShell
      title="Invoice Ready"
      description="Confirmed outbound dispatch lines with quantity available to invoice. Reduce qty on the draft invoice for partial billing (capped at ready qty)."
      actions={
        mergeAllowedAction(perms.canCreateInvoice) ? (
          <ErpButton
            variant="primary"
            icon={FilePlus2}
            disabled={creating || createBlocked}
            onClick={() => void onCreateInvoice()}
          >
            {creating ? 'Preparing…' : `Create Invoice (${selected.size})`}
          </ErpButton>
        ) : null
      }
    >
      {!isApiMode() && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          Invoice-ready dispatch lines are available in API mode only. Enable <code className="font-mono">VITE_USE_API=true</code>{' '}
          to load confirmed dispatches from the server.
        </div>
      )}

      {isApiMode() && policy && (
        <div className="mb-3 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-900">
          <div className="font-medium text-sky-950">Dispatch invoice policy</div>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            <li>
              Mode: <span className="font-medium">{formatInvoiceMode(policy.invoiceMode)}</span>
              {!policy.allowsMultiDispatchInvoice && (
                <span className="text-sky-800"> — select one dispatch at a time</span>
              )}
              {policy.allowsMultiDispatchInvoice && (
                <span className="text-sky-800"> — you may combine lines across dispatches for the same customer</span>
              )}
            </li>
            <li>
              POD before invoice:{' '}
              <span className="font-medium">{policy.requirePodBeforeInvoice ? 'Required' : 'Not required'}</span>
              {policy.requirePodBeforeInvoice && ' (Delivered or Partially delivered)'}
            </li>
            <li>
              Partial qty: edit line quantity on the Sales Invoice draft — save caps at invoice-ready qty
              {policy.allowPartialDispatch ? '' : ' (tenant also restricts partial dispatch)'}
            </li>
          </ul>
          <p className="mt-1.5 text-[11px] text-sky-800">
            Settings:{' '}
            <Link to="/dispatch/settings" className="font-medium text-erp-accent hover:underline">
              Dispatch commercial policy
            </Link>
          </p>
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-erp-border bg-erp-surface/40 px-3 py-2">
        <Input
          className="h-9 w-full max-w-xs text-[12px]"
          placeholder="Dispatch, SO, customer, item…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="flex items-center gap-1.5 text-[12px] text-erp-text">
          <input
            type="checkbox"
            checked={showPodWaiting}
            onChange={(e) => setShowPodWaiting(e.target.checked)}
          />
          Show POD-waiting
        </label>
        <ErpButton variant="secondary" size="sm" icon={RefreshCw} onClick={() => void load()}>
          Refresh
        </ErpButton>
        <span className="ml-auto text-[11px] text-erp-muted">
          {selected.size} selected · {rows.length} lines
        </span>
      </div>

      {createBlockReason && (
        <p className="mb-2 text-[12px] font-medium text-rose-700">{createBlockReason}</p>
      )}

      {loading ? (
        <LoadingState variant="table" />
      ) : rows.length === 0 ? (
        <p className="px-1 py-6 text-center text-[13px] text-erp-muted">
          {isApiMode() ? 'No invoice-ready dispatch lines match your filters.' : 'No demo data — switch to API mode.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                <th className="px-3 py-2 font-medium">
                  <input
                    type="checkbox"
                    aria-label="Select all creatable lines"
                    checked={selectableRows.length > 0 && selected.size === selectableRows.length}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-3 py-2 font-medium">Dispatch</th>
                <th className="px-3 py-2 font-medium">Sales order</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 text-right font-medium">Dispatched</th>
                <th className="px-3 py-2 text-right font-medium">Invoiced</th>
                <th className="px-3 py-2 text-right font-medium">Ready</th>
                <th className="px-3 py-2 font-medium">POD</th>
                <th className="px-3 py-2 font-medium">Blockers</th>
                <th className="px-3 py-2 font-medium">Challan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const blocked = row.canCreateInvoice === false || Boolean(row.podBlocksInvoice)
                return (
                  <tr
                    key={row.outboundDispatchLineId}
                    className={`border-b border-erp-border/60 ${blocked ? 'bg-amber-50/40 text-erp-muted' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.dispatchNo}`}
                        checked={selected.has(row.outboundDispatchLineId)}
                        disabled={blocked}
                        onChange={() => toggleLine(row.outboundDispatchLineId)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Link to={`/dispatch/${row.outboundDispatchId}`} className="font-medium text-erp-accent hover:underline">
                        {row.dispatchNo}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {row.salesOrderId ? (
                        <Link to={`/crm/sales-orders/${row.salesOrderId}`} className="hover:text-erp-accent hover:underline">
                          {row.salesOrderNo ?? row.salesOrderId.slice(0, 8)}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3 py-2">{row.customerName ?? '-'}</td>
                    <td className="px-3 py-2">
                      {row.itemCode ? `${row.itemCode} — ` : ''}
                      {row.itemName ?? row.itemId.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.dispatchedQty}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.invoicedQty}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-erp-text">
                      {row.invoiceReadyQty}
                    </td>
                    <td className="px-3 py-2">
                      <span className={row.podBlocksInvoice ? 'font-medium text-amber-800' : undefined}>
                        {formatPodStatus(row.podStatus)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px]">{formatBlockers(row)}</td>
                    <td className="px-3 py-2">{row.deliveryChallanNumber ?? '-'}</td>
                  </tr>
                )
              })}
            </tbody>
            {selectedRows.length > 0 && (
              <tfoot>
                <tr className="border-t border-erp-border bg-erp-surface-alt/40">
                  <td colSpan={7} className="px-3 py-2 text-right text-[11px] font-medium uppercase text-erp-muted">
                    Selected ready qty
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                    {selectedRows.reduce((s, r) => s + parseDecimal(r.invoiceReadyQty), 0).toFixed(3)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </MoneyInWorkspaceShell>
  )
}
