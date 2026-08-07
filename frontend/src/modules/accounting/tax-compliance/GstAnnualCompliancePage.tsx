import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { TaxComplianceShell } from '@/components/accounting/tax-compliance'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  archiveFinancialYear,
  financialYearFromPeriodKey,
  getAnnualFyCockpit,
  getAnnualReturnDetail,
  getFyArchives,
  getPhase14CapabilityMatrix,
  loadPeriodFilter,
  lockAnnualReturn,
  markAnnualFiledExternal,
  prepareAnnualReturn,
} from '@/services/accounting/taxComplianceService'
import type { PeriodFilterState } from '@/types/taxCompliance'
import { appPromptNote } from '@/store/confirmDialogStore'
import { notify } from '@/store/toastStore'
import { useTaxCompliancePermissions } from '@/utils/permissions/taxCompliance'

/**
 * Phase 14 — GSTR-9 annual worksheet, FY cockpit, multi-year archive.
 * Books-side only — not portal annual file · not FULL GST COMPLIANT.
 */
export function GstAnnualCompliancePage() {
  const perms = useTaxCompliancePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const financialYear = useMemo(
    () => financialYearFromPeriodKey(filter.periodKey),
    [filter.periodKey],
  )
  const [matrix, setMatrix] = useState<Record<string, unknown> | null>(null)
  const [cockpit, setCockpit] = useState<Record<string, unknown> | null>(null)
  const [annual, setAnnual] = useState<{ item: Record<string, unknown> | null; livePreview: Record<string, unknown> | null } | null>(
    null,
  )
  const [archives, setArchives] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [m, c, a, f] = await Promise.all([
        getPhase14CapabilityMatrix(),
        getAnnualFyCockpit(financialYear),
        getAnnualReturnDetail(financialYear),
        getFyArchives(financialYear),
      ])
      setMatrix(m as Record<string, unknown>)
      setCockpit(c as Record<string, unknown>)
      setAnnual(a as { item: Record<string, unknown> | null; livePreview: Record<string, unknown> | null })
      setArchives((f as { items: Array<Record<string, unknown>> }).items ?? [])
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to load annual compliance')
      setMatrix(null)
      setCockpit(null)
    } finally {
      setLoading(false)
    }
  }, [financialYear])

  useEffect(() => {
    void load()
  }, [load])

  const health = (cockpit?.health ?? null) as {
    score?: number
    grade?: string
    issues?: Array<{ code: string; severity: string; message: string }>
    metrics?: Record<string, number | boolean>
  } | null

  const status = String(annual?.item?.status ?? '-')
  const canMutate = perms.isApiMode && (perms.canGstPrepareReturn || perms.canSetup)

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
      notify.success(label)
      await load()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : label)
    } finally {
      setBusy(false)
    }
  }

  return (
    <TaxComplianceShell
      title="Annual / FY archive"
      description="GSTR-9 books worksheet, compliance score, multi-year FY retention — not portal annual submit, not FULL GST COMPLIANT."
      bannerVariant="filing-demo"
      periodFilter={filter}
      onPeriodChange={setFilter}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            {
              id: 'refresh',
              label: 'Refresh',
              icon: RefreshCw,
              onClick: () => void load(),
              disabled: busy,
            },
          ]}
        />
      }
    >
      {loading ? (
        <LoadingState variant="card" />
      ) : (
        <div className="space-y-6">
          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">Financial year</h2>
            <p className="mt-1 text-xs text-erp-muted">
              Derived from period filter as Indian FY (Apr–Mar): <strong>{financialYear}</strong> · Mode:{' '}
              {perms.isApiMode ? 'API' : 'Demo'}
            </p>
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">FY compliance cockpit</h2>
            <p className="mt-1 text-sm">
              Score <strong>{health?.score ?? '-'}</strong> · Grade <strong>{health?.grade ?? '-'}</strong>
            </p>
            <p className="mt-1 text-xs text-erp-muted">{String(cockpit?.disclaimer ?? '')}</p>
            <ul className="mt-3 divide-y divide-erp-border text-sm">
              {(health?.issues ?? []).map((i) => (
                <li key={i.code} className="py-2">
                  <span className="rounded bg-erp-surface-muted px-1.5 py-0.5 text-xs text-erp-muted">{i.severity}</span>{' '}
                  {i.message}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">GSTR-9 annual worksheet</h2>
            <p className="mt-1 text-xs text-erp-muted">
              Status: {status}
              {annual?.item?.draftVersion != null ? ` · draft v${String(annual.item.draftVersion)}` : ''}
            </p>
            {annual?.livePreview && !annual.item && (
              <p className="mt-2 text-xs text-erp-muted">
                Live rollup not yet prepared. Outward tax preview:{' '}
                {String((annual.livePreview as { outward?: { totalTax?: number } }).outward?.totalTax ?? '-')}
              </p>
            )}
            {canMutate && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border border-erp-border px-3 py-1.5 text-xs font-semibold hover:bg-erp-surface-muted"
                  disabled={busy}
                  onClick={() => void run('Annual worksheet prepared', () => prepareAnnualReturn(financialYear))}
                >
                  Prepare
                </button>
                <button
                  type="button"
                  className="rounded border border-erp-border px-3 py-1.5 text-xs font-semibold hover:bg-erp-surface-muted"
                  disabled={busy}
                  onClick={() => void run('Annual locked', () => lockAnnualReturn(financialYear))}
                >
                  Lock
                </button>
                <button
                  type="button"
                  className="rounded border border-erp-border px-3 py-1.5 text-xs font-semibold hover:bg-erp-surface-muted"
                  disabled={busy}
                  onClick={() =>
                    void (async () => {
                      const arn = await appPromptNote({
                        title: 'Portal ARN',
                        description: 'Enter acknowledgment from GST portal after you file outside FOS.',
                        note: { required: true, label: 'ARN / acknowledgment' },
                      })
                      if (!arn) return
                      await run('Marked filed externally', () =>
                        markAnnualFiledExternal(financialYear, { acknowledgmentRef: arn }),
                      )
                    })()
                  }
                >
                  Mark filed external
                </button>
                <button
                  type="button"
                  className="rounded border border-erp-border px-3 py-1.5 text-xs font-semibold hover:bg-erp-surface-muted"
                  disabled={busy}
                  onClick={() =>
                    void run('FY archived', () => archiveFinancialYear(financialYear, 'Multi-year retention'))
                  }
                >
                  Archive FY
                </button>
              </div>
            )}
            {!perms.isApiMode && (
              <p className="mt-2 text-xs text-erp-muted">Mutations require API mode (VITE_USE_API=true).</p>
            )}
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">FY archives</h2>
            <p className="mt-1 text-xs text-erp-muted">{archives.length} archive row(s). Retention markers only — no ledger purge.</p>
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">Capability matrix</h2>
            <p className="mt-1 text-xs text-erp-muted">
              Verdict: {String(matrix?.verdict ?? '-')} · Full GST compliant?{' '}
              {matrix?.notFullGstCompliant === false ? 'Yes' : 'No (honest label)'}
            </p>
            <ul className="mt-3 divide-y divide-erp-border text-sm">
              {((matrix?.capabilities as Array<Record<string, string>>) ?? []).map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline gap-2 py-2">
                  <span className="font-medium">{c.label}</span>
                  <span className="rounded bg-erp-surface-muted px-1.5 py-0.5 text-xs text-erp-muted">{c.status}</span>
                  <span className="w-full text-xs text-erp-muted">{c.notes}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </TaxComplianceShell>
  )
}
