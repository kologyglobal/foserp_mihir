import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download, RefreshCw } from 'lucide-react'
import { TaxComplianceShell, TaxStatusBadge } from '@/components/accounting/tax-compliance'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { getGstDashboard, loadPeriodFilter } from '@/services/accounting/taxComplianceService'
import type { GstDashboardData, PeriodFilterState } from '@/types/taxCompliance'
import { useTaxCompliancePermissions } from '@/utils/permissions/taxCompliance'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'

export function GstDashboardPage() {
  const navigate = useNavigate()
  const perms = useTaxCompliancePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const [data, setData] = useState<GstDashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await getGstDashboard(filter))
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const kpis: EnterpriseKpiItem[] = useMemo(() => {
    if (!data) return []
    const k = data.kpis
    return [
      { id: 'out', label: 'Outward Supplies', value: formatCompactCurrency(k.outwardSupplies), helper: formatCurrency(k.outwardSupplies), accent: 'blue', onClick: () => navigate('/accounting/tax-compliance/gst/outward-supplies') },
      { id: 'in', label: 'Inward Supplies', value: formatCompactCurrency(k.inwardSupplies), accent: 'slate', onClick: () => navigate('/accounting/tax-compliance/gst/inward-supplies') },
      { id: 'outTax', label: 'Output Tax', value: formatCompactCurrency(k.outputTax), accent: 'amber' },
      { id: 'itc', label: 'ITC Eligible Preview', value: formatCompactCurrency(k.itcEligible), accent: 'green', onClick: () => navigate('/accounting/tax-compliance/gst/itc-reconciliation') },
      { id: 'rcm', label: 'RCM Liability', value: formatCompactCurrency(k.rcmLiability), accent: 'slate', onClick: () => navigate('/accounting/tax-compliance/gst/reverse-charge') },
      { id: 'net', label: 'Net Liability Preview', value: formatCompactCurrency(k.netLiabilityPreview), accent: 'red' },
    ]
  }, [data, navigate])

  return (
    <TaxComplianceShell
      title="GST Dashboard"
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
              onClick: () => notify.info('Placeholder export — GST dashboard preview only.'),
            },
          ]}
        />
      }
    >
      {loading || !data ? (
        <LoadingState />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded border border-erp-border p-3">
            <h2 className="text-[13px] font-semibold">Supply mix (preview)</h2>
            <ul className="mt-2 space-y-1.5 text-[12px]">
              {data.suppliesMix.map((s) => (
                <li key={s.name} className="flex justify-between">
                  <span>{s.name}</span>
                  <span className="font-medium">{formatCurrency(s.value)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded border border-erp-border p-3">
            <h2 className="text-[13px] font-semibold">Return status</h2>
            <ul className="mt-2 space-y-2 text-[12px]">
              {data.returnStatus.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <Link
                    to={
                      r.returnType === 'GSTR-1'
                        ? '/accounting/tax-compliance/gst/gstr-1'
                        : r.returnType === 'GSTR-3B'
                          ? '/accounting/tax-compliance/gst/gstr-3b'
                          : '/accounting/tax-compliance/gst/gstr-2b'
                    }
                    className="font-medium text-erp-primary hover:underline"
                  >
                    {r.returnType}
                  </Link>
                  <TaxStatusBadge status={r.status} />
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
              <span className="text-erp-muted">E-Invoice pending: {data.kpis.eInvoicePending}</span>
              <span className="text-erp-muted">·</span>
              <span className="text-erp-muted">E-Way pending: {data.kpis.eWayPending}</span>
              <span className="text-erp-muted">·</span>
              <Link to="/accounting/tax-compliance/gst/exceptions" className="font-semibold text-erp-primary hover:underline">
                Exceptions: {data.kpis.exceptions}
              </Link>
            </div>
          </section>
        </div>
      )}
    </TaxComplianceShell>
  )
}
