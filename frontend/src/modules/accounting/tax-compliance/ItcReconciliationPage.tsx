import { useCallback, useEffect, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { TaxComplianceShell, TaxStatusBadge } from '@/components/accounting/tax-compliance'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getItcReconciliation,
  loadPeriodFilter,
  updateItcMatchStatus,
} from '@/services/accounting/taxComplianceService'
import type { ItcReconRow, PeriodFilterState } from '@/types/taxCompliance'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { useTaxCompliancePermissions } from '@/utils/permissions/taxCompliance'
import { cn } from '@/utils/cn'

export function ItcReconciliationPage() {
  const perms = useTaxCompliancePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const [rows, setRows] = useState<ItcReconRow[]>([])
  const [summary, setSummary] = useState({ matchedTax: 0, mismatchTax: 0, booksOnlyTax: 0, gstr2bOnlyTax: 0, pendingCount: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [overrideReason, setOverrideReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getItcReconciliation(filter)
      setRows(res.rows)
      setSummary(res.summary)
      setSelectedId((prev) => prev ?? res.rows[0]?.id ?? null)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const selected = rows.find((r) => r.id === selectedId) ?? null

  const applyStatus = async (status: 'Accepted' | 'Rejected' | 'Deferred' | 'Pending Review') => {
    if (!selected || !perms.canGstReconcile) return
    try {
      await updateItcMatchStatus(selected.id, status, {
        overrideReason: overrideReason || undefined,
        reviewerNote: status === 'Accepted' ? 'Accepted in frontend preview workbench' : undefined,
      })
      notify.success(`ITC row ${status} (preview only — no GL posting).`)
      setOverrideReason('')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  return (
    <TaxComplianceShell
      title="ITC Reconciliation"
      description="Two-pane books vs GSTR-2B workbench. Low-confidence matches require override reason."
      periodFilter={filter}
      onPeriodChange={setFilter}
      denseBanner
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            {
              id: 'export',
              label: 'Export Preview',
              icon: Download,
              onClick: () => notify.info('Placeholder export — ITC variance CSV not generated.'),
            },
          ]}
        />
      }
    >
      <div className="sticky top-0 z-10 mb-2 grid grid-cols-2 gap-2 rounded border border-erp-border bg-erp-surface p-2 text-[11px] sm:grid-cols-5">
        <div><div className="text-erp-muted">Matched tax</div><div className="font-semibold">{formatCurrency(summary.matchedTax)}</div></div>
        <div><div className="text-erp-muted">Mismatch</div><div className="font-semibold">{formatCurrency(summary.mismatchTax)}</div></div>
        <div><div className="text-erp-muted">Books only</div><div className="font-semibold">{formatCurrency(summary.booksOnlyTax)}</div></div>
        <div><div className="text-erp-muted">2B only</div><div className="font-semibold">{formatCurrency(summary.gstr2bOnlyTax)}</div></div>
        <div><div className="text-erp-muted">Pending</div><div className="font-semibold">{summary.pendingCount}</div></div>
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          <div className="overflow-auto rounded border border-erp-border">
            <table className="min-w-full text-left text-[12px]">
              <thead className="bg-erp-surface text-[11px] font-semibold uppercase text-erp-muted">
                <tr>
                  <th className="px-2 py-1.5">Status</th>
                  <th className="px-2 py-1.5">Books</th>
                  <th className="px-2 py-1.5">2B</th>
                  <th className="px-2 py-1.5">Conf.</th>
                  <th className="px-2 py-1.5 text-right">Δ Tax</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={cn(
                      'cursor-pointer border-t border-erp-border/70 hover:bg-erp-surface/80',
                      selectedId === r.id && 'bg-erp-primary/5',
                    )}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <td className="px-2 py-1.5"><TaxStatusBadge status={r.matchStatus} /></td>
                    <td className="px-2 py-1.5">{r.books?.docNo ?? '—'}</td>
                    <td className="px-2 py-1.5">{r.gstr2b?.invoiceNo ?? '—'}</td>
                    <td className="px-2 py-1.5">{r.confidence}</td>
                    <td className="px-2 py-1.5 text-right">{formatCurrency(r.varianceTax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded border border-erp-border p-3 text-[12px]">
            {!selected ? (
              <p className="text-erp-muted">Select a row to review match details.</p>
            ) : (
              <>
                <h3 className="text-[13px] font-semibold">Match detail</h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded bg-erp-surface p-2">
                    <div className="font-semibold text-erp-muted">Books</div>
                    <p>{selected.books ? `${selected.books.partyName} · ${selected.books.docNo}` : 'No books line'}</p>
                    {selected.books ? (
                      <p className="mt-1">{formatCurrency(selected.books.taxableValue)} / tax {formatCurrency(selected.books.totalTax)}</p>
                    ) : null}
                  </div>
                  <div className="rounded bg-erp-surface p-2">
                    <div className="font-semibold text-erp-muted">GSTR-2B</div>
                    <p>{selected.gstr2b ? `${selected.gstr2b.supplierName} · ${selected.gstr2b.invoiceNo}` : 'No 2B line'}</p>
                    {selected.gstr2b ? (
                      <p className="mt-1">
                        {formatCurrency(selected.gstr2b.taxableValue)} / tax{' '}
                        {formatCurrency(selected.gstr2b.igst + selected.gstr2b.cgst + selected.gstr2b.sgst + selected.gstr2b.cess)}
                      </p>
                    ) : null}
                  </div>
                </div>
                {selected.reviewerNote ? <p className="mt-2 text-erp-muted">{selected.reviewerNote}</p> : null}
                <label className="mt-3 flex flex-col gap-0.5 text-[11px] font-semibold text-erp-muted">
                  Override reason (required for low-confidence accept)
                  <input
                    className="h-8 rounded border border-erp-border px-2 text-[12px] font-normal text-erp-text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="erp-btn erp-btn-primary h-8 px-3 text-[12px]" disabled={!perms.canGstReconcile} onClick={() => void applyStatus('Accepted')}>
                    Accept
                  </button>
                  <button type="button" className="erp-btn erp-btn-ghost h-8 px-3 text-[12px]" disabled={!perms.canGstReconcile} onClick={() => void applyStatus('Rejected')}>
                    Reject
                  </button>
                  <button type="button" className="erp-btn erp-btn-ghost h-8 px-3 text-[12px]" disabled={!perms.canGstReconcile} onClick={() => void applyStatus('Deferred')}>
                    Defer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </TaxComplianceShell>
  )
}
