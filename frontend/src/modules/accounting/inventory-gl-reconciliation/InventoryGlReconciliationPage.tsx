/**
 * FIN-CLOSE-1 — Inventory ↔ GL / WIP ↔ GL trial balance + failed events.
 * Read-only recon; Retry / Open Event / Open Voucher only — never Force Balance.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { Input, Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { isApiMode } from '@/config/apiConfig'
import { FinanceLegalEntitySwitcher } from '@/modules/accounting/settings/FinanceLegalEntitySwitcher'
import {
  fetchInventoryGlTrialBalance,
  fetchUnifiedFailedAccountingEvents,
  retryUnifiedFailedAccountingEvent,
  type InventoryGlTrialBalanceDto,
  type UnifiedFailedAccountingEventDto,
} from '@/services/api/inventoryGlReconciliationApi'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function reasonLabel(code: string) {
  return (
    {
      MATCHED: 'Matched',
      MAPPING_MISSING: 'Mapping missing',
      ACCOUNTING_EVENT_FAILED: 'Accounting event failed',
      ACCOUNTING_EVENT_UNPOSTED: 'Accounting event unposted',
      GRIR_NOT_CLEARED: 'GR/IR not cleared',
      MANUAL_GL_ENTRY_DIFFERENCE: 'Possible manual GL difference',
      OPERATIONAL_VALUE_DIFFERENCE: 'Operational vs GL difference',
      FEATURE_FLAG_OFF: 'Feature flag off',
    }[code] ?? code.replace(/_/g, ' ')
  )
}

function statusTone(status: string): 'success' | 'warning' | 'critical' | 'neutral' {
  if (status === 'MATCHED' || status === 'POSTED') return 'success'
  if (status === 'WARNING' || status === 'RECORDED' || status === 'UNMAPPED') return 'warning'
  if (status === 'DIFFERENCE' || status === 'FAILED') return 'critical'
  return 'neutral'
}

export function InventoryGlReconciliationPage() {
  const navigate = useNavigate()
  const api = isApiMode()
  const [asOfDate, setAsOfDate] = useState(todayIsoDate())
  const [tb, setTb] = useState<InventoryGlTrialBalanceDto | null>(null)
  const [failed, setFailed] = useState<UnifiedFailedAccountingEventDto[]>([])
  const [failedTotal, setFailedTotal] = useState(0)
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'INVENTORY' | 'MANUFACTURING'>('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!api) {
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const legalEntityId = resolveLegalEntityId()
      const [tbRes, failedRes] = await Promise.all([
        fetchInventoryGlTrialBalance({ legalEntityId, asOfDate }),
        fetchUnifiedFailedAccountingEvents({
          legalEntityId,
          source: sourceFilter,
          includeUnposted: true,
          page: 1,
          limit: 50,
        }),
      ])
      setTb(tbRes.data)
      setFailed(failedRes.data.items)
      setFailedTotal(failedRes.data.total)
      if (tbRes.data.forceBalanceAllowed !== false) {
        setError('Unexpected Force Balance capability — blocked by FIN-CLOSE-1')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inventory/GL reconciliation')
    } finally {
      setLoading(false)
    }
  }, [api, asOfDate, sourceFilter])

  useEffect(() => {
    void load()
  }, [load])

  const onRetry = async (row: UnifiedFailedAccountingEventDto) => {
    if (!row.canRetry) return
    setRetryingId(row.id)
    try {
      await retryUnifiedFailedAccountingEvent(row.id, row.source)
      notify.success(`${row.source} event retried`)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Retry failed')
    } finally {
      setRetryingId(null)
    }
  }

  if (!api) {
    return (
      <OperationalPageShell title="Inventory ↔ GL Reconciliation">
        <p className="text-[13px] text-erp-muted">
          Inventory ↔ GL / WIP ↔ GL reconciliation requires API mode (<code>VITE_USE_API=true</code>).
        </p>
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title="Inventory ↔ GL Reconciliation"
      description="Trial balance of inventory / WIP / GR-IR operational values against mapped GL accounts. Failed events can be retried — Force Balance is not available."
      actions={<FinanceLegalEntitySwitcher />}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            {
              id: 'val-recon',
              label: 'Stock ↔ Layers',
              onClick: () => navigate('/inventory/costing/reconciliation'),
            },
            {
              id: 'mfg',
              label: 'Manufacturing Accounting',
              onClick: () => navigate('/accounting/manufacturing'),
            },
          ]}
        />
      }
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-[12px] text-erp-muted">
          As of
          <Input
            type="date"
            className="mt-1"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
          />
        </label>
        <label className="text-[12px] text-erp-muted">
          Failed-event source
          <Select
            className="mt-1 min-w-[160px]"
            value={sourceFilter}
            onChange={(e) =>
              setSourceFilter(e.target.value as 'ALL' | 'INVENTORY' | 'MANUFACTURING')
            }
          >
            <option value="ALL">All</option>
            <option value="INVENTORY">Inventory</option>
            <option value="MANUFACTURING">Manufacturing</option>
          </Select>
        </label>
        <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
          Run report
        </ErpButton>
      </div>

      {loading ? <LoadingState variant="table" /> : null}
      {error ? (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
          {error}
        </div>
      ) : null}

      {tb ? (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: 'Matched', value: String(tb.totals.matched) },
              { label: 'Differences', value: String(tb.totals.differences) },
              { label: 'Unmapped', value: String(tb.totals.unmapped) },
              { label: 'Warnings', value: String(tb.totals.warnings) },
              {
                label: 'Abs. difference',
                value: formatCurrency(Number(tb.totals.absoluteDifference)),
              },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded border border-erp-border p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-erp-muted">
                  {kpi.label}
                </div>
                <div className="mt-1 text-[16px] font-semibold tabular-nums text-erp-text">
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded border border-erp-border bg-erp-surface px-3 py-2 text-[12px] text-erp-muted">
            Inv accounting {tb.inventoryAccountingEnabled ? 'ON' : 'OFF'} · Mfg accounting{' '}
            {tb.manufacturingAccountingEnabled ? 'ON' : 'OFF'} · Force Balance{' '}
            <strong className="text-erp-text">not allowed</strong>
          </div>

          <div className="overflow-x-auto rounded border border-erp-border">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-erp-canvas text-[11px] uppercase tracking-wide text-erp-muted">
                <tr>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2 text-right">Operational</th>
                  <th className="px-3 py-2 text-right">GL</th>
                  <th className="px-3 py-2 text-right">Difference</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Reasons / actions</th>
                </tr>
              </thead>
              <tbody>
                {tb.rows.map((row) => (
                  <tr key={row.mappingKey} className="border-t border-erp-border">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-erp-text">{row.mappingKey}</div>
                      <div className="text-[11px] text-erp-muted">
                        {row.accountCode
                          ? `${row.accountCode} · ${row.accountName}`
                          : 'Not mapped'}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(Number(row.operationalBalance))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(Number(row.glBalance))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(Number(row.difference))}
                    </td>
                    <td className="px-3 py-2">
                      <ErpStatusChip tone={statusTone(row.status)} label={row.status} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {row.reasonCodes.map((code) => (
                          <span
                            key={code}
                            className="rounded bg-erp-canvas px-1.5 py-0.5 text-[11px] text-erp-muted"
                          >
                            {reasonLabel(code)}
                          </span>
                        ))}
                      </div>
                      {(row.drillDown.failedEventCount > 0 ||
                        row.drillDown.unpostedEventCount > 0) && (
                        <div className="mt-1 text-[11px] text-erp-muted">
                          Failed {row.drillDown.failedEventCount} · Unposted{' '}
                          {row.drillDown.unpostedEventCount}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h2 className="text-[14px] font-semibold text-erp-text">
            Failed / unposted accounting events ({failedTotal})
          </h2>
        </div>
        {failed.length === 0 && !loading ? (
          <EmptyState
            icon={AlertTriangle}
            title="No failed events"
            description="Inventory and manufacturing queues are clear."
          />
        ) : (
          <div className="overflow-x-auto rounded border border-erp-border">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-erp-canvas text-[11px] uppercase tracking-wide text-erp-muted">
                <tr>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Failure</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {failed.map((row) => (
                  <tr key={`${row.source}-${row.id}`} className="border-t border-erp-border">
                    <td className="px-3 py-2">{row.source}</td>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{row.eventType}</div>
                      <div className="text-[11px] text-erp-muted">
                        {row.sourceDocumentType} · {row.sourceDocumentId.slice(0, 8)}…
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(Number(row.amount))}
                    </td>
                    <td className="px-3 py-2">
                      <ErpStatusChip tone={statusTone(row.status)} label={row.status} />
                    </td>
                    <td className="max-w-[240px] px-3 py-2 text-[12px] text-erp-muted">
                      {row.failureReason ?? '-'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {row.canRetry ? (
                          <ErpButton
                            variant="secondary"
                            icon={RotateCcw}
                            disabled={retryingId === row.id}
                            onClick={() => void onRetry(row)}
                          >
                            {retryingId === row.id ? 'Retrying…' : 'Retry'}
                          </ErpButton>
                        ) : null}
                        {row.links.sourcePath ? (
                          <Link
                            to={row.links.sourcePath}
                            className="erp-btn erp-btn-secondary inline-flex h-9 items-center px-3 text-[12px]"
                          >
                            Open source
                          </Link>
                        ) : null}
                        {row.links.voucherPath ? (
                          <Link
                            to={row.links.voucherPath}
                            className="erp-btn erp-btn-secondary inline-flex h-9 items-center px-3 text-[12px]"
                          >
                            Open voucher
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </OperationalPageShell>
  )
}
