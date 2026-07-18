import { Link } from 'react-router-dom'
import { BarChart3, ChevronRight, FileSpreadsheet } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { getPurchaseReportCatalog } from '@/services/purchase/purchaseReportsService'
import { purchaseBreadcrumbs } from '@/utils/purchaseNavigation'

export function PurchaseReportsHubPage() {
  const catalog = getPurchaseReportCatalog()

  return (
    <OperationalPageShell
      title="Purchase Reports & Analytics"
      description="Operational registers, conversion, quality, GST, and vendor performance — demo mock data."
      badge="Purchase"
      variant="dynamics"
      favoritePath="/purchase/reports"
      breadcrumbs={purchaseBreadcrumbs('Reports')}
      backLink={{ to: '/purchase', label: 'Back to Purchase' }}
    >
      <div className="space-y-6">
        {catalog.map((group) => (
          <section key={group.id} className="rounded border border-erp-border bg-white">
            <header className="flex items-start gap-3 border-b border-erp-border px-4 py-3">
              <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-erp-primary" />
              <div>
                <h2 className="text-sm font-semibold text-erp-text">{group.label}</h2>
                <p className="mt-0.5 text-[12px] text-erp-muted">{group.description}</p>
              </div>
            </header>
            <ul className="divide-y divide-erp-border">
              {group.reports.map((report) => (
                <li key={report.id}>
                  <Link
                    to={`/purchase/reports/${report.id}`}
                    className="flex items-center gap-3 px-4 py-3 text-left transition hover:bg-erp-primary-soft/50"
                  >
                    <FileSpreadsheet className="h-4 w-4 shrink-0 text-erp-muted" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-medium text-erp-text">{report.title}</span>
                        {report.isPlaceholder ? (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            Integration pending
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[12px] text-erp-muted">{report.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-erp-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </OperationalPageShell>
  )
}
