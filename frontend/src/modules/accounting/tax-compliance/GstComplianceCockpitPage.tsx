import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { TaxComplianceShell } from '@/components/accounting/tax-compliance'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getComplianceCockpit,
  getMultiPeriodHealth,
  getOpsCapabilityMatrix,
  loadPeriodFilter,
} from '@/services/accounting/taxComplianceService'
import type { PeriodFilterState } from '@/types/taxCompliance'
import { notify } from '@/store/toastStore'
import { useTaxCompliancePermissions } from '@/utils/permissions/taxCompliance'

/**
 * Phase 15 — multi-period compliance cockpit (notices + audit packs + health roll-up).
 * Books-side only — not FULL GST COMPLIANT / not portal LIVE.
 */
export function GstComplianceCockpitPage() {
  const perms = useTaxCompliancePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState<{
    matrix: Awaited<ReturnType<typeof getOpsCapabilityMatrix>> | null
    cockpit: Awaited<ReturnType<typeof getComplianceCockpit>> | null
    health: Awaited<ReturnType<typeof getMultiPeriodHealth>> | null
  }>({ matrix: null, cockpit: null, health: null })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [matrix, cockpit, health] = await Promise.all([
        getOpsCapabilityMatrix(),
        getComplianceCockpit(filter),
        getMultiPeriodHealth(filter),
      ])
      setPayload({ matrix, cockpit, health })
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to load compliance cockpit')
      setPayload({ matrix: null, cockpit: null, health: null })
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const periods = payload.health?.periods ?? payload.cockpit?.multiPeriod?.periods ?? []

  return (
    <TaxComplianceShell
      title="Compliance cockpit"
      description="Multi-period GST health, notices log, and audit export packs — books-side only. Not portal LIVE, not FULL GST COMPLIANT."
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
          ]}
        />
      }
    >
      {loading ? (
        <LoadingState variant="card" />
      ) : (
        <div className="space-y-6">
          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">Capability matrix</h2>
            <p className="mt-1 text-xs text-erp-muted">
              Verdict: {payload.matrix?.verdict ?? '—'} · Full GST compliant? No · Mode:{' '}
              {perms.isApiMode ? 'API' : 'Demo'}
            </p>
            <ul className="mt-3 divide-y divide-erp-border text-sm">
              {(payload.matrix?.capabilities ?? []).map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline gap-2 py-2">
                  <span className="font-medium">{c.label}</span>
                  <span className="rounded bg-erp-surface-muted px-1.5 py-0.5 text-xs text-erp-muted">{c.status}</span>
                  <span className="w-full text-xs text-erp-muted">{c.notes}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">Multi-period health</h2>
            <p className="mt-1 text-xs text-erp-muted">
              Overall: {payload.health?.overallGrade ?? payload.cockpit?.multiPeriod?.overallGrade ?? '—'} · avg score{' '}
              {payload.health?.averageScore ?? payload.cockpit?.multiPeriod?.averageScore ?? '—'}
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs text-erp-muted">
                  <tr>
                    <th className="py-1 pr-3">Period</th>
                    <th className="py-1 pr-3">Grade</th>
                    <th className="py-1 pr-3">Score</th>
                    <th className="py-1">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.returnPeriod} className="border-t border-erp-border">
                      <td className="py-1.5 pr-3 font-medium">{p.returnPeriod}</td>
                      <td className="py-1.5 pr-3">{p.grade}</td>
                      <td className="py-1.5 pr-3">{p.score}</td>
                      <td className="py-1.5 text-xs text-erp-muted">
                        {(p.issues ?? []).slice(0, 2).map((i) => i.message).join('; ') || '—'}
                      </td>
                    </tr>
                  ))}
                  {periods.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-3 text-xs text-erp-muted">
                        No period health rows (select a period or use API mode).
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">Open notices</h2>
            <p className="mt-1 text-xs text-erp-muted">
              {(payload.cockpit?.openWork?.openNotices ?? []).length} open item(s) — manuals books log only.
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {(payload.cockpit?.openWork?.openNotices ?? []).map((n) => (
                <li key={String(n.id)} className="border-t border-erp-border py-2 first:border-0">
                  <span className="font-medium">{String(n.noticeRef ?? n.id)}</span>{' '}
                  <span className="text-xs text-erp-muted">{String(n.status ?? '')}</span>
                  <div className="text-xs text-erp-muted">{String(n.subject ?? '')}</div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">Recent audit packs</h2>
            <p className="mt-1 text-xs text-erp-muted">
              {(payload.cockpit?.openWork?.recentAuditPacks ?? []).length} pack(s) — digests only, not portal payloads.
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {(payload.cockpit?.openWork?.recentAuditPacks ?? []).map((p) => (
                <li key={String(p.id)} className="border-t border-erp-border py-2 first:border-0">
                  <span className="font-medium">{String(p.returnPeriod ?? '')}</span>{' '}
                  <span className="text-xs text-erp-muted">{String(p.status ?? '')}</span>
                  <div className="text-xs text-erp-muted truncate">{String(p.digestHash ?? '')}</div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </TaxComplianceShell>
  )
}
