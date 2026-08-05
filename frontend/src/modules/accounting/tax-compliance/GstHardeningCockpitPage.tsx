/**
 * Phase 13 — Go-live UAT gate + period books reconciliation cockpit.
 * Dual-mode: API lives against hardening endpoints; demo uses pure client fixture.
 * Not FULL GST COMPLIANT · not portal LIVE.
 */
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { TaxComplianceShell } from '@/components/accounting/tax-compliance'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getGoLiveGate,
  getHardeningCapabilityMatrix,
  getPeriodComplianceHealth,
  loadPeriodFilter,
} from '@/services/accounting/taxComplianceService'
import type { PeriodFilterState } from '@/types/taxCompliance'
import { notify } from '@/store/toastStore'
import { useTaxCompliancePermissions } from '@/utils/permissions/taxCompliance'
import { isApiMode } from '@/config/apiConfig'

const DEMO_HEALTH = {
  returnPeriod: '2026-04',
  companyGstin: '27AAAAA0000A1Z5',
  health: {
    overall: 'READY_WITH_WARNINGS' as const,
    blockerCount: 0,
    warningCount: 1,
    findings: [
      {
        code: 'FILING_SESSION_ABSENT',
        severity: 'INFO',
        title: 'No Phase 12 filing session (demo)',
        detail: 'SIMULATED portal only until UAT.',
      },
      {
        code: 'NOT_FULL_GST_COMPLIANT',
        severity: 'INFO',
        title: 'Not FULL GST COMPLIANT',
        detail: 'Demo fixture.',
      },
    ],
  },
  preFile: {
    canCreateFilingPackage: false,
    reasons: ['GSTR-1 must be LOCKED (demo)'],
    overall: 'NOT_READY' as const,
  },
  notFullGstCompliant: true as const,
}

const DEMO_GATE = {
  gate: {
    overall: 'NOT_READY' as const,
    passedCount: 0,
    totalCount: 7,
    canClaimFullGstCompliant: false as const,
    notFullGstCompliant: true as const,
    filingProviderMode: 'SIMULATED' as const,
    axes: [
      { id: 'LIVE_IRN', label: 'Live e-Invoice (IRN) tested', status: 'FAIL', passed: false },
      { id: 'LIVE_EWAY', label: 'Live e-Way tested', status: 'FAIL', passed: false },
      { id: 'GSTR_1_3B_RECON', label: 'GSTR-1 / 3B recon tested', status: 'FAIL', passed: false },
      { id: 'GSTR_2B_RECON', label: 'GSTR-2B recon tested', status: 'FAIL', passed: false },
      { id: 'PAYMENT', label: 'GST payment tested', status: 'FAIL', passed: false },
      { id: 'MULTI_GSTIN', label: 'Multi-GSTIN tested', status: 'FAIL', passed: false },
      { id: 'STATUTORY_UAT', label: 'Statutory UAT sign-off', status: 'FAIL', passed: false },
    ],
    blockers: ['UAT axes pending (demo)'],
  },
}

export function GstHardeningCockpitPage() {
  const perms = useTaxCompliancePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const [loading, setLoading] = useState(true)
  const [matrix, setMatrix] = useState<{ verdict?: string; capabilities?: Array<Record<string, string>> } | null>(
    null,
  )
  const [health, setHealth] = useState<typeof DEMO_HEALTH | null>(null)
  const [gate, setGate] = useState<typeof DEMO_GATE | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (!isApiMode()) {
        setMatrix({
          verdict: 'READY_WITH_CONDITIONS',
          capabilities: [
            { id: 'period_books_reconcile', label: 'Period books reconciliation', status: 'READY' },
            { id: 'go_live_uat_gate', label: 'Statutory go-live / UAT gate', status: 'READY' },
            { id: 'full_gst_compliant', label: 'FULL GST COMPLIANT', status: 'NOT_IN_SCOPE' },
          ],
        })
        setHealth(DEMO_HEALTH)
        setGate(DEMO_GATE)
        return
      }
      const [m, h, g] = await Promise.all([
        getHardeningCapabilityMatrix(),
        getPeriodComplianceHealth(filter),
        getGoLiveGate(),
      ])
      setMatrix(m as typeof matrix)
      setHealth(h as typeof DEMO_HEALTH)
      setGate(g as typeof DEMO_GATE)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to load go-live cockpit')
      setMatrix(null)
      setHealth(null)
      setGate(null)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <TaxComplianceShell
      title="Go-live / UAT cockpit"
      description="Period books reconciliation + statutory go-live axes — not portal LIVE, not FULL GST COMPLIANT."
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
        <LoadingState label="Loading go-live cockpit…" />
      ) : (
        <div className="space-y-6">
          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">Capability matrix</h2>
            <p className="mt-1 text-xs text-erp-muted">
              Verdict: {matrix?.verdict ?? '—'} · Mode: {perms.isApiMode ? 'API' : 'Demo'} · Full GST
              compliant? No
            </p>
            <ul className="mt-3 divide-y divide-erp-border text-sm">
              {(matrix?.capabilities ?? []).map((c) => (
                <li key={String(c.id)} className="flex flex-wrap gap-2 py-2">
                  <span className="font-medium">{c.label}</span>
                  <span className="text-erp-muted">{c.status}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">Period books health</h2>
            <p className="mt-1 text-xs text-erp-muted">
              {health?.returnPeriod ?? '—'} · GSTIN {health?.companyGstin ?? '—'} · Overall{' '}
              {health?.health.overall ?? '—'} · blockers {health?.health.blockerCount ?? 0} · warnings{' '}
              {health?.health.warningCount ?? 0}
            </p>
            <p className="mt-1 text-xs text-erp-muted">
              Pre-file package: {health?.preFile.canCreateFilingPackage ? 'yes' : 'no'}
              {health?.preFile.reasons?.length
                ? ` — ${health.preFile.reasons.join('; ')}`
                : ''}
            </p>
            <ul className="mt-3 max-h-64 space-y-1 overflow-auto text-sm">
              {(health?.health.findings ?? []).map((f) => (
                <li key={f.code + f.title} className="flex gap-2">
                  <span className="w-20 shrink-0 text-xs font-semibold text-erp-muted">{f.severity}</span>
                  <span>
                    <span className="font-medium">{f.title}</span>
                    <span className="text-erp-muted"> — {f.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded border border-erp-border bg-white p-4">
            <h2 className="text-sm font-semibold">Go-live / UAT gate</h2>
            <p className="mt-1 text-xs text-erp-muted">
              {gate?.gate.passedCount ?? 0}/{gate?.gate.totalCount ?? 7} axes · provider{' '}
              {gate?.gate.filingProviderMode ?? '—'} · canClaimFullGstCompliant:{' '}
              {String(gate?.gate.canClaimFullGstCompliant ?? false)}
            </p>
            <ul className="mt-3 divide-y divide-erp-border text-sm">
              {(gate?.gate.axes ?? []).map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline gap-2 py-2">
                  <span className="font-medium">{a.label}</span>
                  <span className="text-xs text-erp-muted">{a.status}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </TaxComplianceShell>
  )
}
