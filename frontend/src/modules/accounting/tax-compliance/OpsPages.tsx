import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, RefreshCw, Save } from 'lucide-react'
import { TaxComplianceShell, TaxStatusBadge } from '@/components/accounting/tax-compliance'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getComplianceCalendar,
  getTaxReports,
  getTaxSetup,
  loadPeriodFilter,
  saveTaxSetup,
} from '@/services/accounting/taxComplianceService'
import type {
  ComplianceCalendarItem,
  PeriodFilterState,
  TaxComplianceSetup,
  TaxReportCard,
} from '@/types/taxCompliance'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useTaxCompliancePermissions } from '@/utils/permissions/taxCompliance'

export function ComplianceCalendarPage() {
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const [items, setItems] = useState<ComplianceCalendarItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        setItems(await getComplianceCalendar())
      } finally {
        setLoading(false)
      }
    })()
  }, [filter])

  return (
    <TaxComplianceShell
      title="Compliance Calendar"
      description="Due dates from demo calendar config — not live government calendars."
      periodFilter={filter}
      onPeriodChange={setFilter}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => notify.info('Calendar refreshed from demo seed.') },
            { id: 'export', label: 'Export Preview', icon: Download, onClick: () => notify.info('Placeholder calendar export.') },
          ]}
        />
      }
    >
      {loading ? (
        <LoadingState />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-erp-border px-3 py-2 text-[12px]">
              <div>
                <div className="font-semibold text-erp-text">{item.title}</div>
                <div className="text-erp-muted">Due {formatDate(item.dueDate)} · {item.category}</div>
              </div>
              <div className="flex items-center gap-2">
                <TaxStatusBadge status={item.status} />
                {item.href ? (
                  <Link to={item.href} className="font-semibold text-erp-primary hover:underline">
                    Open
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </TaxComplianceShell>
  )
}

export function TaxReportsPage() {
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const [reports, setReports] = useState<TaxReportCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        setReports(await getTaxReports())
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <TaxComplianceShell
      title="Reports"
      description="Tax report launcher — each opens a preview register or workspace."
      periodFilter={filter}
      onPeriodChange={setFilter}
    >
      {loading ? (
        <LoadingState />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {reports.map((r) => (
            <Link
              key={r.id}
              to={r.href}
              className="rounded border border-erp-border p-3 transition-colors hover:border-erp-primary/40 hover:bg-erp-surface/60"
            >
              <div className="text-[11px] font-semibold uppercase text-erp-muted">{r.category}</div>
              <div className="mt-1 text-[13px] font-semibold text-erp-text">{r.title}</div>
              <p className="mt-1 text-[12px] text-erp-muted">{r.description}</p>
            </Link>
          ))}
        </div>
      )}
    </TaxComplianceShell>
  )
}

export function TaxSetupPage() {
  const perms = useTaxCompliancePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const [setup, setSetup] = useState<TaxComplianceSetup | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        setSetup(await getTaxSetup())
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const save = async () => {
    if (!setup || !perms.canSetup) return
    setSaving(true)
    try {
      const saved = await saveTaxSetup({
        filingFrequency: setup.filingFrequency,
        autoMatchHighOnly: setup.autoMatchHighOnly,
        companyTan: setup.companyTan,
      })
      setSetup(saved)
      notify.success('Setup saved in session (demo). Backend must persist when available.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <TaxComplianceShell
      title="Setup"
      description="Effective-dated GST/TDS/TCS configuration for frontend previews."
      periodFilter={filter}
      onPeriodChange={setFilter}
      showPeriodBar={false}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'save',
            label: saving ? 'Saving…' : 'Save Setup',
            icon: Save,
            disabled: saving || !perms.canSetup,
            onClick: () => void save(),
          }}
        />
      }
    >
      {loading || !setup ? (
        <LoadingState />
      ) : (
        <div className="space-y-4 text-[12px]">
          <section className="rounded border border-erp-border p-3">
            <h2 className="text-[13px] font-semibold">Organisation</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-0.5 font-semibold text-erp-muted">
                TAN
                <input
                  className="h-8 rounded border border-erp-border px-2 font-normal text-erp-text"
                  value={setup.companyTan}
                  onChange={(e) => setSetup({ ...setup, companyTan: e.target.value })}
                  disabled={!perms.canSetup}
                />
              </label>
              <label className="flex flex-col gap-0.5 font-semibold text-erp-muted">
                Filing frequency
                <select
                  className="h-8 rounded border border-erp-border px-2 font-normal"
                  value={setup.filingFrequency}
                  onChange={(e) => setSetup({ ...setup, filingFrequency: e.target.value as 'Monthly' | 'Quarterly' })}
                  disabled={!perms.canSetup}
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                </select>
              </label>
              <label className="flex items-center gap-2 font-semibold text-erp-muted sm:col-span-2">
                <input
                  type="checkbox"
                  checked={setup.autoMatchHighOnly}
                  onChange={(e) => setSetup({ ...setup, autoMatchHighOnly: e.target.checked })}
                  disabled={!perms.canSetup}
                />
                Auto-match high confidence only (never auto-apply low confidence)
              </label>
            </div>
          </section>

          <section className="rounded border border-erp-border p-3">
            <h2 className="text-[13px] font-semibold">GSTINs</h2>
            <ul className="mt-2 space-y-1">
              {setup.gstins.map((g) => (
                <li key={g.id}>
                  {g.gstin} — {g.tradeName} ({g.stateName}){g.isDefault ? ' · Default' : ''}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded border border-erp-border p-3">
            <h2 className="text-[13px] font-semibold">TDS sections (effective-dated setup)</h2>
            <table className="mt-2 min-w-full text-left">
              <thead className="text-[11px] uppercase text-erp-muted">
                <tr>
                  <th className="py-1">Code</th>
                  <th className="py-1">Label</th>
                  <th className="py-1">Rate %</th>
                  <th className="py-1">Threshold</th>
                  <th className="py-1">From</th>
                </tr>
              </thead>
              <tbody>
                {setup.tdsSections.map((r) => (
                  <tr key={r.id} className="border-t border-erp-border/70">
                    <td className="py-1">{r.code}</td>
                    <td className="py-1">{r.label}</td>
                    <td className="py-1">{r.ratePercent ?? '—'}</td>
                    <td className="py-1">{r.thresholdAmount != null ? formatCurrency(r.thresholdAmount) : '—'}</td>
                    <td className="py-1">{r.effectiveFrom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded border border-erp-border p-3">
            <h2 className="text-[13px] font-semibold">TCS / GST rate slabs (setup)</h2>
            <ul className="mt-2 space-y-1">
              {[...setup.tcsSections, ...setup.gstRateSlabs].map((r) => (
                <li key={r.id}>
                  {r.code}: {r.label}
                  {r.ratePercent != null ? ` · ${r.ratePercent}%` : ''}
                  {r.thresholdAmount != null ? ` · threshold ${formatCurrency(r.thresholdAmount)}` : ''}
                  {' · from '}
                  {r.effectiveFrom}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-erp-muted">{setup.previewDisclaimer}</p>
          </section>
        </div>
      )}
    </TaxComplianceShell>
  )
}
