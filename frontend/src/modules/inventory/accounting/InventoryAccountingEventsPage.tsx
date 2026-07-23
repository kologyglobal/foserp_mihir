/**
 * Inventory accounting events workspace — dual-mode.
 * API: live gate + event register from /inventory/accounting/*.
 * Demo: small seed list so the screen is browsable without VITE_USE_API.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Landmark, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/forms/Inputs'
import { isApiMode } from '@/config/apiConfig'
import {
  fetchInventoryAccountingEvents,
  fetchInventoryAccountingGate,
  type InventoryAccountingEventDto,
  type InventoryAccountingGateStatus,
} from '@/services/api/inventoryAccountingApi'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDateTime } from '@/utils/dates/format'
import { cn } from '@/utils/cn'

const DEMO_EVENTS: InventoryAccountingEventDto[] = [
  {
    id: 'demo-inv-acct-1',
    legalEntityId: null,
    eventType: 'GRN_INWARD',
    status: 'SKIPPED_FLAG_OFF',
    movementId: null,
    idempotencyKey: 'DEMO:GRN:1',
    sourceDocumentType: 'GOODS_RECEIPT',
    sourceDocumentId: 'demo-grn-1',
    quantity: '100.0000',
    amount: '125000.0000',
    currencyCode: 'INR',
    voucherId: null,
    postingEventId: null,
    failureReason: null,
    postedAt: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-inv-acct-2',
    legalEntityId: null,
    eventType: 'STOCK_ADJUSTMENT',
    status: 'RECORDED',
    movementId: null,
    idempotencyKey: 'DEMO:ADJ:1',
    sourceDocumentType: 'STOCK_ADJUSTMENT',
    sourceDocumentId: 'demo-adj-1',
    quantity: '-2.0000',
    amount: '4500.0000',
    currencyCode: 'INR',
    voucherId: null,
    postingEventId: null,
    failureReason: null,
    postedAt: null,
    createdAt: new Date().toISOString(),
  },
]

function statusTone(status: string): 'success' | 'warning' | 'critical' | 'neutral' {
  if (status === 'POSTED') return 'success'
  if (status === 'FAILED') return 'critical'
  if (status === 'RECORDED') return 'warning'
  return 'neutral'
}

export function InventoryAccountingEventsPage() {
  const perms = useInventoryPermissions()
  const api = isApiMode()
  const [gate, setGate] = useState<InventoryAccountingGateStatus | null>(null)
  const [rows, setRows] = useState<InventoryAccountingEventDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!perms.canView) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (!api) {
        setGate({ legalEntityId: null, enabled: false, reason: 'FLAG_OFF' })
        setRows(DEMO_EVENTS)
        setSelectedId(DEMO_EVENTS[0]?.id ?? null)
        return
      }
      const [gateRes, eventsRes] = await Promise.all([
        fetchInventoryAccountingGate(),
        fetchInventoryAccountingEvents({
          limit: 100,
          status: statusFilter || undefined,
        }),
      ])
      setGate(gateRes.data)
      setRows(eventsRes.data ?? [])
      setSelectedId((prev) => prev ?? eventsRes.data?.[0]?.id ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inventory accounting events')
    } finally {
      setLoading(false)
    }
  }, [api, perms.canView, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((r) =>
      `${r.eventType} ${r.sourceDocumentType} ${r.sourceDocumentId} ${r.status} ${r.idempotencyKey}`
        .toLowerCase()
        .includes(q),
    )
  }, [rows, search])

  const selected = visible.find((r) => r.id === selectedId) ?? visible[0] ?? null

  if (!perms.canView) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Inventory"
        title="Inventory Accounting"
        breadcrumbs={[{ label: 'Inventory', to: '/inventory' }, { label: 'Accounting' }]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ShieldOff} title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory"
      title="Inventory Accounting"
      description={
        api
          ? 'Live GRN / adjustment / dispatch accounting events. GL posts only when INVENTORY_ACCOUNTING is enabled.'
          : 'Demo preview of inventory accounting events. Switch to API mode for live data.'
      }
      breadcrumbs={[{ label: 'Inventory', to: '/inventory' }, { label: 'Accounting' }]}
      autoBreadcrumbs={false}
      favoritePath="/inventory/accounting"
      showDescription
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      {loading ? <LoadingState variant="card" /> : null}
      {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}

      {!loading && !error ? (
        <div className="space-y-3">
          {gate ? (
            <div
              className={cn(
                'flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]',
                gate.enabled
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                  : 'border-amber-200 bg-amber-50 text-amber-950',
              )}
            >
              <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <p>
                {api ? (
                  gate.enabled ? (
                    <>
                      <span className="font-semibold">INVENTORY_ACCOUNTING enabled.</span> Events with value post
                      SYSTEM vouchers via the central posting engine.
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">INVENTORY_ACCOUNTING is off</span>
                      {gate.reason === 'NO_LEGAL_ENTITY' ? ' (no legal entity)' : ''}. Events are still recorded for
                      audit; enable the flag under Finance › Features when mappings and an open period are ready.
                    </>
                  )
                ) : (
                  <>
                    <span className="font-semibold">Demo mode.</span> Showing seed events — no live inventory GL.
                  </>
                )}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <SearchInput value={search} onChange={setSearch} placeholder="Search type, document, status…" />
            </div>
            <div className="min-w-[160px]">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                <option value="RECORDED">Recorded</option>
                <option value="POSTED">Posted</option>
                <option value="FAILED">Failed</option>
                <option value="SKIPPED_FLAG_OFF">Skipped (flag off)</option>
                <option value="SKIPPED_ZERO">Skipped (zero)</option>
                <option value="SKIPPED_NO_LEGAL_ENTITY">Skipped (no LE)</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="overflow-x-auto rounded border border-erp-border bg-white lg:col-span-2">
              {visible.length === 0 ? (
                <p className="px-4 py-10 text-center text-[13px] text-erp-muted">No inventory accounting events.</p>
              ) : (
                <table className="erp-table w-full min-w-[720px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[10px] uppercase text-erp-muted">
                      <th className="px-3 py-2 font-semibold">Event</th>
                      <th className="px-3 py-2 font-semibold">Source</th>
                      <th className="px-3 py-2 text-right font-semibold">Amount</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Recorded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr
                        key={r.id}
                        className={cn(
                          'cursor-pointer border-b border-erp-border/70 hover:bg-erp-surface-alt/40',
                          selected?.id === r.id ? 'bg-erp-primary/5' : '',
                        )}
                        onClick={() => setSelectedId(r.id)}
                      >
                        <td className="px-3 py-2 font-medium">{String(r.eventType).replace(/_/g, ' ')}</td>
                        <td className="px-3 py-2 text-erp-muted">
                          {r.sourceDocumentType.replace(/_/g, ' ')}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(r.amount))}</td>
                        <td className="px-3 py-2">
                          <DynamicsStatusChip label={String(r.status)} tone={statusTone(String(r.status))} />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <aside className="rounded border border-erp-border bg-white p-3 text-[12px]">
              {selected ? (
                <dl className="space-y-2">
                  <div>
                    <dt className="text-[10px] font-bold uppercase text-erp-muted">Event</dt>
                    <dd className="font-semibold">{String(selected.eventType).replace(/_/g, ' ')}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase text-erp-muted">Status</dt>
                    <dd>
                      <DynamicsStatusChip label={String(selected.status)} tone={statusTone(String(selected.status))} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase text-erp-muted">Quantity</dt>
                    <dd className="tabular-nums">{selected.quantity}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase text-erp-muted">Amount</dt>
                    <dd className="tabular-nums font-semibold">{formatCurrency(Number(selected.amount))}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase text-erp-muted">Source document</dt>
                    <dd className="font-mono text-[11px] break-all">{selected.sourceDocumentId}</dd>
                  </div>
                  {selected.failureReason ? (
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-erp-muted">Failure</dt>
                      <dd className="text-rose-800">{selected.failureReason}</dd>
                    </div>
                  ) : null}
                  {selected.voucherId ? (
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-erp-muted">Voucher</dt>
                      <dd>
                        <Link
                          to={`/accounting/ledger-entries?voucherId=${selected.voucherId}`}
                          className="font-medium text-erp-primary hover:underline"
                        >
                          Open ledger for voucher
                        </Link>
                      </dd>
                    </div>
                  ) : (
                    <p className="text-erp-muted">
                      No voucher yet. Posting runs automatically when the inventory accounting flag is on and amount
                      &gt; 0.
                    </p>
                  )}
                </dl>
              ) : (
                <p className="text-erp-muted">Select an event to see details.</p>
              )}
            </aside>
          </div>
        </div>
      ) : null}
    </OperationalPageShell>
  )
}
