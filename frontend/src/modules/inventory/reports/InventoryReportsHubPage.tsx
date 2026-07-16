import { Link } from 'react-router-dom'
import { BarChart3, ChevronRight, ExternalLink, FileSpreadsheet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { LoadingState } from '@/design-system/components/LoadingState'
import { getInventoryReports } from '@/services/inventory'
import type { InventoryReportCategoryGroup } from '@/types/inventoryDomain'
import { useInventoryPermissions } from '@/utils/permissions/inventory'

export function InventoryReportsHubPage() {
  const perms = useInventoryPermissions()
  const [catalog, setCatalog] = useState<InventoryReportCategoryGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getInventoryReports().then((c) => {
      setCatalog(c)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const totalReports = catalog.reduce((sum, g) => sum + g.reports.length, 0)

  if (!perms.canViewReports) {
    return (
      <OperationalPageShell title="Access denied" description="You do not have permission to view inventory reports.">
        <p className="text-sm text-erp-muted">Contact your administrator for inventory.reports.view access.</p>
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title="Inventory Reports"
      description="Stock, movement, tracking, exception and planning reports — demo mock data."
      badge="Inventory & Warehouse"
      variant="dynamics"
      favoritePath="/inventory/reports"
      breadcrumbs={[{ label: 'Inventory & Warehouse', to: '/inventory' }, { label: 'Reports' }]}
      autoBreadcrumbs={false}
      insights={[
        { label: 'Categories', value: catalog.length, accent: 'blue' },
        { label: 'Reports', value: totalReports, accent: 'slate' },
        { label: 'Linked', value: catalog.flatMap((g) => g.reports).filter((r) => r.externalPath).length, accent: 'green' },
      ]}
    >
      {loading ? <LoadingState variant="table" /> : null}
      {!loading ? (
        <div className="space-y-6">
          {catalog.map((group) => (
            <section key={group.id} className="rounded border border-erp-border bg-white" aria-labelledby={`report-cat-${group.id}`}>
              <header className="flex items-start gap-3 border-b border-erp-border px-4 py-3">
                <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-erp-primary" aria-hidden />
                <div>
                  <h2 id={`report-cat-${group.id}`} className="text-sm font-semibold text-erp-text">{group.label}</h2>
                  <p className="mt-0.5 text-[12px] text-erp-muted">{group.description}</p>
                </div>
              </header>
              <ul className="divide-y divide-erp-border">
                {group.reports.map((report) => {
                  const href = report.externalPath ?? `/inventory/reports/${report.id}`
                  const isExternal = Boolean(report.externalPath)
                  return (
                    <li key={report.id}>
                      <Link
                        to={href}
                        className="flex items-center gap-3 px-4 py-3 text-left transition hover:bg-erp-primary-soft/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-erp-primary"
                      >
                        <FileSpreadsheet className="h-4 w-4 shrink-0 text-erp-muted" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13px] font-medium text-erp-text">{report.title}</span>
                            {report.requiresCost ? (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                Cost
                              </span>
                            ) : null}
                            {isExternal ? (
                              <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                <ExternalLink className="h-3 w-3" aria-hidden />
                                Analytics Hub
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-[12px] text-erp-muted">{report.description}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-erp-muted" aria-hidden />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </OperationalPageShell>
  )
}
