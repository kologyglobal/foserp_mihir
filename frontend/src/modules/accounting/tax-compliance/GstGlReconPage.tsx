import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Save } from 'lucide-react'
import { TaxComplianceShell } from '@/components/accounting/tax-compliance'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getGlReconReport,
  getGlReconRuns,
  loadPeriodFilter,
  saveGlReconRun,
} from '@/services/accounting/taxComplianceService'
import type { PeriodFilterState } from '@/types/taxCompliance'
import { notify } from '@/store/toastStore'
import { useTaxCompliancePermissions } from '@/utils/permissions/taxCompliance'
import { isApiMode } from '@/config/apiConfig'

/**
 * Phase 18 — GST subledger vs GL control recon (advisory books only).
 */
export function GstGlReconPage() {
  const perms = useTaxCompliancePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const [report, setReport] = useState<Awaited<ReturnType<typeof getGlReconReport>> | null>(null)
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, runList] = await Promise.all([getGlReconReport(filter), getGlReconRuns()])
      setReport(r)
      setRuns(runList.items ?? [])
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to load GL recon')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const onSave = async () => {
    if (!isApiMode()) {
      notify.error('Saving evidence runs requires API mode')
      return
    }
    setSaving(true)
    try {
      await saveGlReconRun(filter)
      notify.success('GST vs GL recon run stored')
      await load()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to save run')
    } finally {
      setSaving(false)
    }
  }

  const lines = (report?.lines ?? []) as Array<{
    taxType?: string
    label?: string
    status?: string
    gstLedgerAmount?: number
    glNetAmount?: number
    variance?: number
    message?: string
    accountCode?: string | null
  }>

  return (
    <TaxComplianceShell
      title="GST vs GL recon"
      description="Period GST ledger totals vs default CoA control mappings — advisory only; not portal, no auto-journals, not FULL GST COMPLIANT."
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
              id: 'save',
              label: saving ? 'Saving…' : 'Save evidence run',
              icon: Save,
              onClick: () => void onSave(),
              disabled: saving || !(perms.canGlReconManage || perms.canSetup || perms.canGstReconcile),
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
              Overall: {report?.health?.overall ?? '-'} · Score: {report?.health?.scorePct ?? '-'}% · Variances:{' '}
              {report?.health?.varianceCount ?? 0} · Unmapped: {report?.health?.unmappedCount ?? 0} · Abs var:{' '}
              {report?.health?.totalAbsVariance ?? 0} · Close claim:{' '}
              {report?.readyForCloseClaim ? 'Yes (books)' : 'No'} · Full GST compliant? No · Mode:{' '}
              {perms.isApiMode ? 'API' : 'Demo'}
            </p>
            <p className="mt-2 text-xs text-erp-muted">{report?.disclaimer}</p>
          </section>

          <section className="rounded border border-erp-border bg-white p-4 overflow-x-auto">
            <h2 className="text-sm font-semibold">Buckets</h2>
            <table className="mt-2 w-full text-left text-sm">
              <thead className="text-xs text-erp-muted">
                <tr>
                  <th className="py-1 pr-2">Bucket</th>
                  <th className="py-1 pr-2">Status</th>
                  <th className="py-1 pr-2">Account</th>
                  <th className="py-1 pr-2">GST ledger</th>
                  <th className="py-1 pr-2">GL net</th>
                  <th className="py-1 pr-2">Variance</th>
                  <th className="py-1">Note</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.taxType} className="border-t border-erp-border/60">
                    <td className="py-1 pr-2">{l.label ?? l.taxType}</td>
                    <td className="py-1 pr-2 font-medium">{l.status}</td>
                    <td className="py-1 pr-2">{l.accountCode ?? '-'}</td>
                    <td className="py-1 pr-2">{l.gstLedgerAmount ?? 0}</td>
                    <td className="py-1 pr-2">{l.glNetAmount ?? 0}</td>
                    <td className="py-1 pr-2">{l.variance ?? 0}</td>
                    <td className="py-1 text-xs text-erp-muted">{l.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">Evidence runs</h2>
            {runs.length === 0 ? (
              <p className="mt-1 text-xs text-erp-muted">No stored runs (API after migrate).</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {runs.map((r) => (
                  <li key={String(r.id)}>
                    {String(r.returnPeriod)} · {String(r.overall)} · var {String(r.varianceCount)} ·{' '}
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
