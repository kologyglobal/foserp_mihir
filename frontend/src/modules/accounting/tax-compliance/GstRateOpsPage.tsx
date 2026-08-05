import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Save } from 'lucide-react'
import { TaxComplianceShell } from '@/components/accounting/tax-compliance'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getRateOpsFullReport,
  getRateOpsRuns,
  loadPeriodFilter,
  saveRateOpsRun,
} from '@/services/accounting/taxComplianceService'
import type { PeriodFilterState } from '@/types/taxCompliance'
import { notify } from '@/store/toastStore'
import { useTaxCompliancePermissions } from '@/utils/permissions/taxCompliance'
import { isApiMode } from '@/config/apiConfig'

/**
 * Phase 16 — GST rate master ops & determination continuity.
 * Books diagnostics only — not FULL GST COMPLIANT / not portal / not master CRUD.
 */
export function GstRateOpsPage() {
  const perms = useTaxCompliancePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const [report, setReport] = useState<Awaited<ReturnType<typeof getRateOpsFullReport>> | null>(null)
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, runList] = await Promise.all([getRateOpsFullReport(filter), getRateOpsRuns()])
      setReport(r)
      setRuns(runList.items ?? [])
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to load rate ops')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const onSaveRun = async () => {
    if (!isApiMode()) {
      notify.error('Saving evidence runs requires API mode')
      return
    }
    setSaving(true)
    try {
      await saveRateOpsRun(filter)
      notify.success('Rate ops evidence run stored')
      await load()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to save run')
    } finally {
      setSaving(false)
    }
  }

  const health = report?.health
  const coverage = report?.coverage as
    | {
        gaps?: Array<{ gstGroupCode?: string; message?: string }>
        expiring?: Array<{ code?: string; dateTo?: string; daysRemaining?: number; severity?: string }>
        overlaps?: Array<{ message?: string }>
        activeGroupCount?: number
        activeRateCount?: number
        asOfDate?: string
      }
    | undefined
  const drift = report?.drift as
    | {
        findingTotal?: number
        findings?: Array<{ message?: string; severity?: string; documentNumber?: string | null }>
        impact?: Array<{ gstGroupCode?: string | null; documentCount?: number; totalTaxAmount?: number }>
      }
    | undefined

  return (
    <TaxComplianceShell
      title="Rate master ops"
      description="Effective-dated coverage, expiries, overlaps, and posted-rate drift vs current masters — not re-tax, not portal, not FULL GST COMPLIANT."
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
            },
            {
              id: 'save-run',
              label: saving ? 'Saving…' : 'Save evidence run',
              icon: Save,
              onClick: () => void onSaveRun(),
              disabled: saving || !(perms.canRateOpsManage || perms.canSetup),
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
            <h2 className="text-sm font-semibold">Ops score</h2>
            <p className="mt-1 text-xs text-erp-muted">
              Overall: {health?.overall ?? '—'} · Score: {health?.scorePct ?? '—'}% · Full GST compliant? No
              (honest) · Mode: {perms.isApiMode ? 'API' : 'Demo'}
            </p>
            <p className="mt-2 text-xs text-erp-muted">{health?.disclaimer}</p>
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">Coverage</h2>
            <p className="mt-1 text-xs text-erp-muted">
              As-of {coverage?.asOfDate ?? '—'} · Active groups {coverage?.activeGroupCount ?? 0} · Active rates{' '}
              {coverage?.activeRateCount ?? 0}
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {(coverage?.gaps ?? []).length === 0 ? (
                <li className="text-erp-muted">No coverage gaps</li>
              ) : (
                (coverage?.gaps ?? []).map((g, i) => (
                  <li key={`gap-${i}`}>{g.message ?? g.gstGroupCode}</li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">Expiring & overlaps</h2>
            <div className="mt-2 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold text-erp-muted">Expiring (≤30d)</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {(coverage?.expiring ?? []).length === 0 ? (
                    <li className="text-erp-muted">None</li>
                  ) : (
                    (coverage?.expiring ?? []).map((e, i) => (
                      <li key={`exp-${i}`}>
                        {e.code} ends {e.dateTo} ({e.daysRemaining}d · {e.severity})
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-erp-muted">Overlaps</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {(coverage?.overlaps ?? []).length === 0 ? (
                    <li className="text-erp-muted">None</li>
                  ) : (
                    (coverage?.overlaps ?? []).map((o, i) => <li key={`ov-${i}`}>{o.message}</li>)
                  )}
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">Ledger vs master drift (advisory)</h2>
            <p className="mt-1 text-xs text-erp-muted">
              {drift?.findingTotal ?? 0} finding(s). Posted tax is not rewritten.
            </p>
            <ul className="mt-3 max-h-48 space-y-1 overflow-auto text-sm">
              {(drift?.findings ?? []).slice(0, 25).map((f, i) => (
                <li key={`dr-${i}`} className="border-b border-erp-border py-1">
                  <span className="text-xs text-erp-muted">{f.severity}</span> {f.documentNumber ?? 'doc'} —{' '}
                  {f.message}
                </li>
              ))}
              {(drift?.findings ?? []).length === 0 && (
                <li className="text-erp-muted">No drift findings for period</li>
              )}
            </ul>
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">Evidence runs</h2>
            <p className="mt-1 text-xs text-erp-muted">{runs.length} stored run(s)</p>
            <ul className="mt-2 divide-y divide-erp-border text-sm">
              {runs.length === 0 ? (
                <li className="py-2 text-erp-muted">No runs yet</li>
              ) : (
                runs.slice(0, 10).map((r) => (
                  <li key={String(r.id)} className="flex flex-wrap gap-2 py-2">
                    <span className="font-medium">{String(r.returnPeriod)}</span>
                    <span className="text-xs text-erp-muted">{String(r.overall)}</span>
                    <span className="text-xs text-erp-muted">score {String(r.scorePct)}</span>
                    <span className="text-xs text-erp-muted">{String(r.status)}</span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      )}
    </TaxComplianceShell>
  )
}
