import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download, RefreshCw } from 'lucide-react'
import { TaxComplianceShell, TaxStatusBadge } from '@/components/accounting/tax-compliance'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import {
  getTaxComplianceDashboard,
  loadPeriodFilter,
} from '@/services/accounting/taxComplianceService'
import type { PeriodFilterState, TaxComplianceDashboard } from '@/types/taxCompliance'
import { useTaxCompliancePermissions } from '@/utils/permissions/taxCompliance'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'

export function TaxComplianceOverviewPage() {
  const navigate = useNavigate()
  const perms = useTaxCompliancePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const [data, setData] = useState<TaxComplianceDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!perms.canView) {
      setError('You do not have permission to view tax compliance.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await getTaxComplianceDashboard(filter))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [filter, perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  const kpis: EnterpriseKpiItem[] = useMemo(() => {
    if (!data) return []
    const k = data.kpis
    return [
      { id: 'out', label: 'Outward Taxable', value: formatCompactCurrency(k.outwardTaxable), helper: formatCurrency(k.outwardTaxable), accent: 'blue', onClick: () => navigate('/accounting/tax-compliance/gst/outward-supplies') },
      { id: 'in', label: 'Inward Taxable', value: formatCompactCurrency(k.inwardTaxable), helper: formatCurrency(k.inwardTaxable), accent: 'slate', onClick: () => navigate('/accounting/tax-compliance/gst/inward-supplies') },
      { id: 'itc', label: 'ITC Pending', value: formatCompactCurrency(k.itcPending), accent: 'amber', onClick: () => navigate('/accounting/tax-compliance/gst/itc-reconciliation') },
      { id: 'pay', label: 'GST Payable Preview', value: formatCompactCurrency(k.gstPayablePreview), accent: 'green' },
      { id: 'tds', label: 'TDS Deducted', value: formatCompactCurrency(k.tdsDeducted), accent: 'slate', onClick: () => navigate('/accounting/tax-compliance/tds') },
      { id: 'ex', label: 'Open Exceptions', value: String(k.openExceptions), accent: 'red', onClick: () => navigate('/accounting/tax-compliance/gst/exceptions') },
    ]
  }, [data, navigate])

  return (
    <TaxComplianceShell
      title="GST & TDS Overview"
      description="Compliance workspace dashboard — live GST extract KPIs when API mode is on."
      periodFilter={filter}
      onPeriodChange={setFilter}
      kpiStrip={kpis}
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
              disabled: !perms.canExport,
              onClick: () => notify.info('Placeholder export — CSV preview not generated for overview KPIs.'),
            },
          ]}
        />
      }
    >
      {loading ? <LoadingState /> : null}
      {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}
      {!loading && !error && data ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded border border-erp-border p-3">
            <h2 className="text-[13px] font-semibold text-erp-text">Filing watch</h2>
            <ul className="mt-2 space-y-2">
              {data.filingWatch.map((f) => (
                <li key={f.label} className="flex items-center justify-between gap-2 text-[12px]">
                  <Link to={f.href} className="font-medium text-erp-primary hover:underline">
                    {f.label}
                  </Link>
                  <span className="text-erp-muted">Due {formatDate(f.dueDate)}</span>
                  <TaxStatusBadge status={f.status} />
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded border border-erp-border p-3">
            <h2 className="text-[13px] font-semibold text-erp-text">Exception highlights</h2>
            <ul className="mt-2 space-y-2">
              {data.exceptionHighlights.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-2 text-[12px]">
                  <div>
                    <div className="font-medium text-erp-text">{e.category}</div>
                    <div className="text-erp-muted">{e.description}</div>
                  </div>
                  <TaxStatusBadge status={e.severity} />
                </li>
              ))}
            </ul>
            <Link
              to="/accounting/tax-compliance/gst/exceptions"
              className="mt-2 inline-block text-[12px] font-semibold text-erp-primary hover:underline"
            >
              Open GST Exceptions
            </Link>
          </section>
          <section className="rounded border border-erp-border p-3 lg:col-span-2">
            <h2 className="text-[13px] font-semibold text-erp-text">Recent activity</h2>
            <ul className="mt-2 space-y-1.5 text-[12px] text-erp-muted">
              {data.recentActivity.map((a) => (
                <li key={a.id}>
                  <span className="font-medium text-erp-text">{a.when}</span> — {a.text}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-erp-muted">
              GSTIN {data.gstin.gstin} · {data.period.label} · Preview figures only
            </p>
          </section>
        </div>
      ) : null}
    </TaxComplianceShell>
  )
}
