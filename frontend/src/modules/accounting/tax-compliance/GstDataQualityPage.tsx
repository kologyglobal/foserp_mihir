import { useCallback, useEffect, useState } from 'react'
import { Play, RefreshCw, Save, Wand2 } from 'lucide-react'
import { TaxComplianceShell } from '@/components/accounting/tax-compliance'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  applyDataQualityBackfill,
  dryRunDataQualityBackfill,
  getDataQualityFreezeReadiness,
  getDataQualityRuns,
  loadPeriodFilter,
  saveDataQualityRun,
} from '@/services/accounting/taxComplianceService'
import type { PeriodFilterState } from '@/types/taxCompliance'
import { notify } from '@/store/toastStore'
import { useTaxCompliancePermissions } from '@/utils/permissions/taxCompliance'
import { isApiMode } from '@/config/apiConfig'

/**
 * Phase 17 — GST data quality, companyGstin backfill, books freeze checklist.
 * Not portal LIVE · not FULL GST COMPLIANT · no silent re-tax.
 */
export function GstDataQualityPage() {
  const perms = useTaxCompliancePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const [freeze, setFreeze] = useState<Awaited<ReturnType<typeof getDataQualityFreezeReadiness>> | null>(
    null,
  )
  const [dry, setDry] = useState<Awaited<ReturnType<typeof dryRunDataQualityBackfill>> | null>(null)
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [f, r] = await Promise.all([getDataQualityFreezeReadiness(filter), getDataQualityRuns()])
      setFreeze(f)
      setRuns(r.items ?? [])
      setDry(null)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to load data quality')
      setFreeze(null)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const onDryRun = async () => {
    setBusy(true)
    try {
      const plan = await dryRunDataQualityBackfill(filter)
      setDry(plan as Awaited<ReturnType<typeof dryRunDataQualityBackfill>>)
      notify.success('Backfill dry-run ready')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Dry-run failed')
    } finally {
      setBusy(false)
    }
  }

  const onApply = async () => {
    if (!isApiMode()) {
      notify.error('Apply requires API mode')
      return
    }
    setBusy(true)
    try {
      const result = (await applyDataQualityBackfill(filter)) as { updated?: number }
      notify.success(`Backfilled ${result.updated ?? 0} ledger row(s)`)
      await load()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Apply failed')
    } finally {
      setBusy(false)
    }
  }

  const onSaveRun = async () => {
    if (!isApiMode()) {
      notify.error('Saving evidence runs requires API mode')
      return
    }
    setBusy(true)
    try {
      await saveDataQualityRun(filter)
      notify.success('Data quality evidence run stored')
      await load()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to save run')
    } finally {
      setBusy(false)
    }
  }

  const quality = freeze?.quality as
    | {
        totalRows?: number
        nullCompanyGstinCount?: number
        filedWithNullGstinCount?: number
        findings?: Array<{ code?: string; severity?: string; message?: string }>
      }
    | undefined
  const checklist = freeze?.checklist as
    | {
        ready?: boolean
        summary?: string
        items?: Array<{ id?: string; label?: string; status?: string; message?: string }>
      }
    | undefined
  const plan = dry?.plan as
    | {
        candidateTotal?: number
        alreadyPopulated?: number
        unresolvable?: unknown[]
        candidates?: Array<{ documentNumber?: string | null; toGstin?: string; source?: string }>
      }
    | undefined

  return (
    <TaxComplianceShell
      title="Data quality & freeze"
      description="Ledger companyGstin hygiene, safe null-only backfill, and books freeze checklist — not portal LIVE, not FULL GST COMPLIANT."
      bannerVariant="filing-demo"
      periodFilter={filter}
      onPeriodChange={setFilter}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            {
              id: 'dry-run',
              label: busy ? 'Working…' : 'Backfill dry-run',
              icon: Play,
              onClick: () => void onDryRun(),
              disabled: busy || !(perms.canDataQualityManage || perms.canSetup || perms.canGstReconcile),
            },
            {
              id: 'apply',
              label: 'Apply null GSTIN backfill',
              icon: Wand2,
              onClick: () => void onApply(),
              disabled: busy || !(perms.canDataQualityManage || perms.canSetup),
            },
            {
              id: 'save-run',
              label: 'Save evidence run',
              icon: Save,
              onClick: () => void onSaveRun(),
              disabled: busy || !(perms.canDataQualityManage || perms.canSetup),
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
            <h2 className="text-sm font-semibold">Health</h2>
            <p className="mt-1 text-xs text-erp-muted">
              Overall: {freeze?.health?.overall ?? '-'} · Score: {freeze?.health?.scorePct ?? '-'}% · Freeze
              ready (books): {checklist?.ready ? 'Yes' : 'No'} · Full GST compliant? No (honest) · Mode:{' '}
              {perms.isApiMode ? 'API' : 'Demo'}
            </p>
            <p className="mt-2 text-xs text-erp-muted">{checklist?.summary ?? freeze?.disclaimer}</p>
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">Quality findings</h2>
            <p className="mt-1 text-xs text-erp-muted">
              Rows: {quality?.totalRows ?? 0} · Null GSTIN: {quality?.nullCompanyGstinCount ?? 0} · Filed
              null: {quality?.filedWithNullGstinCount ?? 0}
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {(quality?.findings ?? []).map((f) => (
                <li key={`${f.code}-${f.message}`}>
                  <span className="font-medium">{f.severity}</span> — {f.message}
                </li>
              ))}
              {(quality?.findings?.length ?? 0) === 0 && (
                <li className="text-xs text-erp-muted">No findings for this period.</li>
              )}
            </ul>
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">Freeze checklist</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {(checklist?.items ?? []).map((item) => (
                <li key={item.id}>
                  <span className="font-medium">{item.status}</span> · {item.label} — {item.message}
                </li>
              ))}
            </ul>
          </section>

          {plan && (
            <section className="rounded border border-erp-border bg-white p-4">
              <h2 className="text-sm font-semibold">Backfill plan</h2>
              <p className="mt-1 text-xs text-erp-muted">
                Candidates: {plan.candidateTotal ?? 0} · Already stamped: {plan.alreadyPopulated ?? 0} ·
                Unresolvable: {plan.unresolvable?.length ?? 0}
              </p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-sm">
                {(plan.candidates ?? []).slice(0, 20).map((c, i) => (
                  <li key={`${c.documentNumber}-${i}`}>
                    {c.documentNumber ?? '-'} → {c.toGstin} ({c.source})
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">Evidence runs</h2>
            {runs.length === 0 ? (
              <p className="mt-1 text-xs text-erp-muted">No stored runs (API mode after migrate).</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {runs.map((r) => (
                  <li key={String(r.id)}>
                    {String(r.returnPeriod)} · {String(r.overall)} · score {String(r.scorePct)}% ·{' '}
                    {String(r.status)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </TaxComplianceShell>
  )
}
